"""FastAPI application for secure, temporary resume tailoring."""

from __future__ import annotations

import asyncio
import logging
import os
import re
import shutil
import time
from collections import defaultdict, deque
from io import BytesIO
from pathlib import Path
from typing import Annotated
from uuid import uuid4

from docx import Document
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from latex_response import (
    TEMPLATE_STYLES,
    aspose_is_configured,
    build_latex_document,
    compile_latex_to_pdf,
    convert_pdf_to_docx,
    save_text,
    tailor_resume_content,
)
from pdfminer.high_level import extract_text
from pydantic import BaseModel, Field

load_dotenv()
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger("resume_tailor")

APP_DIR = Path(__file__).resolve().parent
RUNTIME_DIR = Path(os.getenv("RUNTIME_DIR", APP_DIR / "runtime")).resolve()
RUNTIME_DIR.mkdir(parents=True, exist_ok=True)

MAX_UPLOAD_BYTES = int(float(os.getenv("MAX_UPLOAD_MB", "5")) * 1024 * 1024)
MAX_JOB_DESCRIPTION_CHARS = int(os.getenv("MAX_JOB_DESCRIPTION_CHARS", "15000"))
RESULT_TTL_SECONDS = int(os.getenv("RESULT_TTL_SECONDS", "600"))
RATE_LIMIT_REQUESTS = int(os.getenv("RATE_LIMIT_REQUESTS", "5"))
RATE_LIMIT_WINDOW_SECONDS = int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "900"))

ALLOWED_UPLOADS = {
    ".txt": {"text/plain"},
    ".pdf": {"application/pdf"},
    ".docx": {"application/vnd.openxmlformats-officedocument.wordprocessingml.document"},
}
DOWNLOADS = {
    "tex": ("tailored_resume.tex", "application/x-tex"),
    "pdf": ("tailored_resume.pdf", "application/pdf"),
    "docx": (
        "tailored_resume.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ),
}
JOB_ID_PATTERN = re.compile(r"^[0-9a-f]{32}$")
request_history: dict[str, deque[float]] = defaultdict(deque)
rate_limit_lock = asyncio.Lock()
cleanup_tasks: set[asyncio.Task[None]] = set()


class TailorResponse(BaseModel):
    success: bool
    tex_url: str
    pdf_url: str
    doc_url: str | None
    expires_in_seconds: int
    warnings: list[str] = Field(default_factory=list)


def _frontend_origins() -> list[str]:
    configured = os.getenv("FRONTEND_ORIGINS", "http://localhost:3000")
    return [origin.strip().rstrip("/") for origin in configured.split(",") if origin.strip()]


app = FastAPI(
    title="Resume Tailor API",
    version="1.0.0",
    description="Temporarily processes resumes and returns tailored TEX, PDF, and DOCX files.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_frontend_origins(),
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)


def _client_identifier(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",", maxsplit=1)[0].strip()
    return request.client.host if request.client else "unknown"


async def _enforce_rate_limit(request: Request) -> None:
    now = time.monotonic()
    client = _client_identifier(request)
    async with rate_limit_lock:
        history = request_history[client]
        while history and now - history[0] > RATE_LIMIT_WINDOW_SECONDS:
            history.popleft()
        if len(history) >= RATE_LIMIT_REQUESTS:
            raise HTTPException(
                status_code=429,
                detail="Too many resume requests. Please try again later.",
                headers={"Retry-After": str(RATE_LIMIT_WINDOW_SECONDS)},
            )
        history.append(now)


def _extract_resume_text(content: bytes, extension: str) -> str:
    if extension == ".txt":
        try:
            text = content.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise HTTPException(
                status_code=400,
                detail="The text file must use UTF-8 encoding.",
            ) from exc
    elif extension == ".pdf":
        text = extract_text(BytesIO(content))
    elif extension == ".docx":
        document = Document(BytesIO(content))
        text = "\n".join(
            paragraph.text for paragraph in document.paragraphs if paragraph.text.strip()
        )
    else:
        raise HTTPException(status_code=400, detail="Unsupported resume format.")

    text = text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="No readable text was found in the resume.")
    return text


def _process_resume(
    resume_text: str,
    job_description: str,
    template: str,
    job_dir: Path,
) -> tuple[Path, Path, Path | None, list[str]]:
    body = tailor_resume_content(resume_text, job_description)
    document = build_latex_document(body, template)

    tex_path = job_dir / "tailored_resume.tex"
    save_text(document, tex_path)
    compiled_pdf = compile_latex_to_pdf(tex_path, job_dir)
    pdf_path = job_dir / "tailored_resume.pdf"
    if compiled_pdf != pdf_path:
        compiled_pdf.replace(pdf_path)

    warnings: list[str] = []
    docx_path: Path | None = job_dir / "tailored_resume.docx"
    try:
        convert_pdf_to_docx(pdf_path, docx_path)
    except RuntimeError as exc:
        logger.warning("DOCX conversion unavailable for job %s: %s", job_dir.name, exc)
        docx_path = None
        warnings.append(
            "The PDF and TEX files are ready, but DOCX conversion is temporarily unavailable."
        )

    return tex_path, pdf_path, docx_path, warnings


async def _delete_job_later(job_dir: Path) -> None:
    await asyncio.sleep(RESULT_TTL_SECONDS)
    try:
        if job_dir.parent == RUNTIME_DIR and job_dir.is_dir():
            shutil.rmtree(job_dir)
    except OSError:
        logger.exception("Could not remove expired job directory %s", job_dir)


def _public_base_url(request: Request) -> str:
    configured = os.getenv("PUBLIC_BACKEND_URL", "").strip().rstrip("/")
    return configured or str(request.base_url).rstrip("/")


@app.post("/tailor_resume", response_model=TailorResponse)
@app.post("/tailor_resume/", response_model=TailorResponse, include_in_schema=False)
async def tailor_resume(
    request: Request,
    resume: Annotated[UploadFile, File()],
    job_desc: Annotated[str, Form()],
    template: Annotated[str, Form()] = "template1",
) -> TailorResponse:
    await _enforce_rate_limit(request)

    if template not in TEMPLATE_STYLES:
        raise HTTPException(status_code=400, detail="Unknown resume template.")
    job_desc = job_desc.strip()
    if not job_desc:
        raise HTTPException(status_code=400, detail="A job description is required.")
    if len(job_desc) > MAX_JOB_DESCRIPTION_CHARS:
        raise HTTPException(status_code=413, detail="The job description is too long.")

    filename = resume.filename or ""
    extension = Path(filename).suffix.lower()
    allowed_mime_types = ALLOWED_UPLOADS.get(extension)
    if not allowed_mime_types or resume.content_type not in allowed_mime_types:
        raise HTTPException(status_code=400, detail="Upload a UTF-8 TXT, PDF, or DOCX resume.")

    content = await resume.read(MAX_UPLOAD_BYTES + 1)
    await resume.close()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="The resume file is too large.")

    resume_text = _extract_resume_text(content, extension)
    job_id = uuid4().hex
    job_dir = RUNTIME_DIR / job_id
    job_dir.mkdir(mode=0o700)

    try:
        tex_path, pdf_path, docx_path, warnings = await asyncio.to_thread(
            _process_resume,
            resume_text,
            job_desc,
            template,
            job_dir,
        )
    except HTTPException:
        shutil.rmtree(job_dir, ignore_errors=True)
        raise
    except Exception:
        shutil.rmtree(job_dir, ignore_errors=True)
        logger.exception("Resume processing failed for job %s", job_id)
        raise HTTPException(
            status_code=500,
            detail="The resume could not be generated. Please try again.",
        ) from None

    cleanup_task = asyncio.create_task(_delete_job_later(job_dir))
    cleanup_tasks.add(cleanup_task)
    cleanup_task.add_done_callback(cleanup_tasks.discard)
    base_url = _public_base_url(request)
    return TailorResponse(
        success=True,
        tex_url=f"{base_url}/download/{job_id}/tex",
        pdf_url=f"{base_url}/download/{job_id}/pdf",
        doc_url=f"{base_url}/download/{job_id}/docx" if docx_path else None,
        expires_in_seconds=RESULT_TTL_SECONDS,
        warnings=warnings,
    )


@app.get("/download/{job_id}/{file_type}")
async def download(job_id: str, file_type: str) -> FileResponse:
    if not JOB_ID_PATTERN.fullmatch(job_id) or file_type not in DOWNLOADS:
        raise HTTPException(status_code=404, detail="File not found.")

    filename, media_type = DOWNLOADS[file_type]
    file_path = (RUNTIME_DIR / job_id / filename).resolve()
    expected_parent = (RUNTIME_DIR / job_id).resolve()
    if file_path.parent != expected_parent or not file_path.is_file():
        raise HTTPException(status_code=404, detail="File not found or expired.")

    return FileResponse(
        file_path,
        media_type=media_type,
        filename=filename,
        headers={"Cache-Control": "private, no-store, max-age=0"},
    )


@app.get("/")
async def root() -> dict[str, str]:
    return {"message": "Resume Tailor API is running.", "docs": "/docs", "health": "/health"}


@app.get("/health")
async def health() -> JSONResponse:
    checks = {
        "groq_configured": bool(os.getenv("GROQ_API_KEY")),
        "pdflatex_available": shutil.which("pdflatex") is not None,
        "runtime_writable": os.access(RUNTIME_DIR, os.W_OK),
        "aspose_configured": aspose_is_configured(),
    }
    ready = (
        checks["groq_configured"]
        and checks["pdflatex_available"]
        and checks["runtime_writable"]
    )
    return JSONResponse(
        status_code=200 if ready else 503,
        content={"status": "healthy" if ready else "not_ready", "checks": checks},
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8000")),
        reload=os.getenv("ENVIRONMENT", "development") == "development",
    )
