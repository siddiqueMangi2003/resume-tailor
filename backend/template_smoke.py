"""Compile every deterministic template during the container build."""

from __future__ import annotations

from pathlib import Path
from tempfile import TemporaryDirectory

from latex_response import (
    TEMPLATE_STYLES,
    build_latex_document,
    compile_latex_to_pdf,
    render_structured_resume,
    save_text,
)

SYNTHETIC_RESUME = {
    "name": "Aisha Rahman",
    "contact": ["aisha@example.com", "Rotterdam, NL"],
    "summary": "Backend engineer building reliable APIs and data services.",
    "skills": ["Python", "FastAPI", "PostgreSQL", "Docker"],
    "experience": [
        {
            "company": "Northstar Labs",
            "role": "Backend Engineer",
            "dates": "2023-Present",
            "location": "Remote",
            "bullets": ["Built tested APIs for data-intensive products."],
        }
    ],
    "education": [],
    "projects": [],
    "additional_sections": [],
}


def _latex_errors(log_path: Path) -> str:
    if not log_path.is_file():
        return "No LaTeX log was produced."
    lines = log_path.read_text(encoding="utf-8", errors="replace").splitlines()
    useful = [line for line in lines if line.startswith(("!", "l."))]
    return "\n".join(useful[-12:]) or "LaTeX failed without a concise error line."


def main() -> None:
    body = render_structured_resume(SYNTHETIC_RESUME)
    with TemporaryDirectory(prefix="resume-template-smoke-") as directory:
        output_dir = Path(directory)
        for template_id in sorted(TEMPLATE_STYLES):
            tex_path = output_dir / f"{template_id}.tex"
            save_text(build_latex_document(body, template_id), tex_path)
            try:
                compile_latex_to_pdf(tex_path, output_dir)
            except RuntimeError:
                print(f"Template smoke test failed: {template_id}")
                print(_latex_errors(tex_path.with_suffix(".log")))
                raise
            print(f"Template smoke test passed: {template_id}")


if __name__ == "__main__":
    main()
