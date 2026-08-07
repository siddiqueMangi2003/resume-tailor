"""AI tailoring, safe LaTeX assembly, PDF compilation, and DOCX conversion."""

from __future__ import annotations

import os
import re
import subprocess
from pathlib import Path

from asposewordscloud.apis.words_api import WordsApi
from asposewordscloud.models.requests import ConvertDocumentRequest
from asposewordscloud.rest import ApiException
from groq import Groq

DEFAULT_MODEL = "openai/gpt-oss-120b"
MAX_GENERATED_LATEX_CHARS = 60_000
FORBIDDEN_LATEX = re.compile(
    r"""\\(?:
        input|include|includeonly|usepackage|documentclass|
        openin|openout|read|write|write18|immediate|special|
        catcode|csname|newread|newwrite|loop|repeat|
        def|edef|gdef|xdef|directlua|luaexec|
        pdfobj|pdfstream|pdfxform|pdfrefobj|pdfcatalog|pdfinfo
    )\b|\\(?:begin|end)\s*\{\s*document\s*\}""",
    re.IGNORECASE | re.VERBOSE,
)

TEMPLATE_STYLES = {
    "template1": {
        "accent": "155E75",
        "font": "",
        "section_style": r"\large\bfseries\color{Accent}",
        "margin": "0.65in",
    },
    "template2": {
        "accent": "4338CA",
        "font": r"\renewcommand{\familydefault}{\sfdefault}",
        "section_style": r"\large\bfseries\sffamily\color{Accent}",
        "margin": "0.7in",
    },
    "template3": {
        "accent": "7C2D12",
        "font": "",
        "section_style": r"\Large\bfseries\scshape\color{Accent}",
        "margin": "0.6in",
    },
}


def _strip_markdown_fences(content: str) -> str:
    content = content.strip()
    content = re.sub(r"^\x60{3}(?:latex|tex)?\s*", "", content, flags=re.IGNORECASE)
    content = re.sub(r"\s*\x60{3}$", "", content)
    return content.strip()


def validate_generated_latex(content: str) -> str:
    """Reject document-level and file/system-access commands from model output."""
    content = _strip_markdown_fences(content)
    if not content:
        raise ValueError("The AI returned an empty resume.")
    if len(content) > MAX_GENERATED_LATEX_CHARS:
        raise ValueError("The generated resume is unexpectedly large.")
    match = FORBIDDEN_LATEX.search(content)
    if match:
        command = match.group(0)
        raise ValueError(f"The generated resume contains a forbidden LaTeX command: {command}")
    if content.count("{") != content.count("}"):
        raise ValueError("The generated LaTeX has unbalanced braces.")
    return content


def tailor_resume_content(resume_text: str, job_description: str) -> str:
    """Tailor a resume without inventing facts and return a LaTeX body fragment."""
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not configured.")

    model = os.getenv("GROQ_MODEL", DEFAULT_MODEL)
    timeout_seconds = float(os.getenv("GROQ_TIMEOUT_SECONDS", "90"))
    client = Groq(api_key=api_key, timeout=timeout_seconds)

    system_prompt = r"""
You are an expert resume editor. Tailor the supplied resume to the job description.

Truthfulness is mandatory:
- Use only facts, employers, dates, education, skills, metrics, and contact details
  explicitly present in the source resume.
- Never invent experience, qualifications, numbers, links, employers, titles, or achievements.
- You may rephrase, prioritize, and shorten existing facts.
- If the job requests a skill not supported by the source resume, do not add it.

Return only a LaTeX body fragment, never a complete document and never Markdown.
Use this structure where data exists:
\begin{center}
{\LARGE\textbf{Candidate Name}}\\
contact details separated by \enspace|\enspace
\end{center}
\section*{Professional Summary}
...
\section*{Experience}
\textbf{Employer}\hfill Dates\\
\textit{Role}\hfill Location
\begin{itemize}
\item ...
\end{itemize}

Allowed formatting includes center, section*, itemize, item, textbf, textit, emph, hfill,
line breaks, and escaped LaTeX special characters. Do not use file access, package loading,
custom command definitions, document declarations, scripts, external images, or embedded files.
Keep the output concise, ATS-readable, and normally within two pages.
""".strip()

    user_prompt = (
        "SOURCE RESUME\n"
        "-------------\n"
        f"{resume_text}\n\n"
        "TARGET JOB DESCRIPTION\n"
        "----------------------\n"
        f"{job_description}\n\n"
        "Return only the truthful tailored LaTeX body fragment."
    )

    completion = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.2,
        max_tokens=5_000,
    )
    content = completion.choices[0].message.content or ""
    return validate_generated_latex(content)


def build_latex_document(body: str, template_id: str) -> str:
    """Insert validated resume content into one of three deterministic templates."""
    body = validate_generated_latex(body)
    style = TEMPLATE_STYLES.get(template_id)
    if style is None:
        raise ValueError(f"Unknown template: {template_id}")

    return rf"""\documentclass[10pt,letterpaper]{{article}}
\usepackage[T1]{{fontenc}}
\usepackage{{lmodern}}
\usepackage[margin={style['margin']}]{{geometry}}
\usepackage{{enumitem}}
\usepackage{{titlesec}}
\usepackage{{xcolor}}
\usepackage[hidelinks]{{hyperref}}
\definecolor{{Accent}}{{HTML}}{{{style['accent']}}}
{style['font']}
\pagestyle{{empty}}
\setlength{{\parindent}}{{0pt}}
\setlength{{\parskip}}{{3pt}}
\setlist[itemize]{{leftmargin=1.2em,itemsep=1pt,topsep=2pt}}
\titleformat{{\section}}{{{style['section_style']}}}{{}}{{0pt}}{{}}[\color{{Accent}}\titlerule]
\titlespacing*{{\section}}{{0pt}}{{7pt}}{{3pt}}
\begin{{document}}
{body}
\end{{document}}
"""


def save_text(content: str, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def compile_latex_to_pdf(tex_path: Path, output_dir: Path) -> Path:
    """Compile a trusted document with shell escape disabled and a strict timeout."""
    output_dir.mkdir(parents=True, exist_ok=True)
    timeout = int(os.getenv("LATEX_TIMEOUT_SECONDS", "45"))
    command = [
        "pdflatex",
        "-no-shell-escape",
        "-interaction=nonstopmode",
        "-halt-on-error",
        "-file-line-error",
        f"-output-directory={output_dir}",
        str(tex_path),
    ]

    result: subprocess.CompletedProcess[str] | None = None
    for _ in range(2):
        try:
            result = subprocess.run(
                command,
                cwd=output_dir,
                capture_output=True,
                text=True,
                timeout=timeout,
                check=False,
            )
        except FileNotFoundError as exc:
            raise RuntimeError("pdflatex is not installed in the backend runtime.") from exc
        except subprocess.TimeoutExpired as exc:
            raise RuntimeError("LaTeX compilation timed out.") from exc

        if result.returncode != 0:
            break

    pdf_path = output_dir / f"{tex_path.stem}.pdf"
    if result is None or not pdf_path.is_file() or result.returncode != 0:
        raise RuntimeError("LaTeX compilation failed.")
    return pdf_path


def aspose_is_configured() -> bool:
    return bool(os.getenv("ASPOSE_CLIENT_ID") and os.getenv("ASPOSE_CLIENT_SECRET"))


def convert_pdf_to_docx(pdf_path: Path, output_path: Path) -> Path:
    """Convert PDF to DOCX through Aspose Cloud while keeping credentials server-side."""
    client_id = os.getenv("ASPOSE_CLIENT_ID")
    client_secret = os.getenv("ASPOSE_CLIENT_SECRET")
    if not client_id or not client_secret:
        raise RuntimeError("Aspose credentials are not configured.")

    api = WordsApi(client_id, client_secret)
    try:
        with pdf_path.open("rb") as document:
            request = ConvertDocumentRequest(document=document, format="docx")
            result = api.convert_document(request)
        output_path.write_bytes(result)
    except ApiException as exc:
        raise RuntimeError("Aspose could not convert the PDF to DOCX.") from exc
    return output_path
