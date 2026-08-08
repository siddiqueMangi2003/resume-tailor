"""AI tailoring, safe LaTeX assembly, PDF compilation, and DOCX conversion."""

from __future__ import annotations

import json
import os
import re
import subprocess
import unicodedata
from pathlib import Path
from typing import Any

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
        "section_suffix": r"[\color{Accent}\titlerule]",
        "header": (
            r"\newcommand{\ResumeHeader}[2]{\begin{center}"
            r"{\LARGE\bfseries\color{Accent} #1}\\[2pt]{\small #2}\end{center}}"
        ),
        "item_label": r"\textbullet",
        "margin": "0.65in",
    },
    "template2": {
        "accent": "4338CA",
        "font": r"\renewcommand{\familydefault}{\sfdefault}",
        "section_style": r"\large\bfseries\sffamily\color{Accent}",
        "section_suffix": "",
        "header": (
            r"\newcommand{\ResumeHeader}[2]{\begin{flushleft}"
            r"{\Huge\bfseries\sffamily\color{Accent} #1}\\[3pt]{\small #2}\end{flushleft}}"
        ),
        "item_label": r"\textcolor{Accent}{\raisebox{1pt}{\rule{3pt}{3pt}}}",
        "margin": "0.7in",
    },
    "template3": {
        "accent": "7C2D12",
        "font": "",
        "section_style": r"\Large\bfseries\scshape\color{Accent}",
        "section_suffix": r"[\color{Accent}\titlerule[1.2pt]]",
        "header": (
            r"\newcommand{\ResumeHeader}[2]{\begin{center}"
            r"{\LARGE\bfseries\scshape\color{Accent} #1}\\[2pt]{\small #2}\end{center}}"
        ),
        "item_label": r"\textcolor{Accent}{\textbullet}",
        "margin": "0.6in",
    },
    # Original single-column adaptations of LPPL-licensed designs in the
    # Overleaf gallery. Source links and attribution are shown in the UI.
    "template4": {
        "accent": "0F766E",
        "font": r"\renewcommand{\familydefault}{\sfdefault}",
        "section_style": r"\Large\bfseries\sffamily\color{Accent}",
        "section_suffix": r"[\color{Accent}\titlerule[1.4pt]]",
        "header": (
            r"\newcommand{\ResumeHeader}[2]{\begin{flushleft}"
            r"{\Huge\bfseries\sffamily\color{Accent} #1}\\[4pt]"
            r"{\small\color{black} #2}\end{flushleft}}"
        ),
        "item_label": r"\textcolor{Accent}{\textbullet}",
        "margin": "0.62in",
    },
    "template5": {
        "accent": "1D4ED8",
        "font": r"\renewcommand{\familydefault}{\sfdefault}",
        "section_style": r"\large\bfseries\sffamily\color{Accent}",
        "section_suffix": "",
        "header": (
            r"\newcommand{\ResumeHeader}[2]{\begin{center}"
            r"{\Huge\bfseries\sffamily\color{Accent} #1}\\[3pt]"
            r"{\small\sffamily #2}\end{center}\vspace{2pt}}"
        ),
        "item_label": r"\textcolor{Accent}{\textbullet}",
        "margin": "0.68in",
    },
    "template6": {
        "accent": "713F12",
        "font": r"\renewcommand{\rmdefault}{ppl}\renewcommand{\familydefault}{\rmdefault}",
        "section_style": r"\large\bfseries\sffamily\color{Accent}",
        "section_suffix": r"[\color{Accent}\titlerule]",
        "header": (
            r"\newcommand{\ResumeHeader}[2]{\begin{center}"
            r"{\Huge\bfseries\color{Accent} #1}\\[3pt]{\small #2}\end{center}}"
        ),
        "item_label": r"\textcolor{Accent}{\textbullet}",
        "margin": "0.72in",
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


def _escape_latex(value: Any, max_chars: int = 2_000) -> str:
    """Convert untrusted model text into compact, ASCII-safe LaTeX text."""
    if not isinstance(value, str):
        return ""
    value = (
        value.replace("\u2013", "-")
        .replace("\u2014", "-")
        .replace("\u2018", "'")
        .replace("\u2019", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
        .replace("\u2022", "-")
    )
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    value = re.sub(r"\s+", " ", value).strip()[:max_chars]
    replacements = {
        "\\": r"\textbackslash{}",
        "{": r"\{",
        "}": r"\}",
        "$": r"\$",
        "&": r"\&",
        "#": r"\#",
        "%": r"\%",
        "_": r"\_",
        "~": r"\textasciitilde{}",
        "^": r"\textasciicircum{}",
    }
    return "".join(replacements.get(character, character) for character in value)


def _text_list(value: Any, *, max_items: int = 20, max_chars: int = 500) -> list[str]:
    if not isinstance(value, list):
        return []
    return [
        escaped
        for item in value[:max_items]
        if (escaped := _escape_latex(item, max_chars))
    ]


def _render_items(items: list[str]) -> list[str]:
    if not items:
        return []
    return [r"\begin{itemize}", *(rf"\item {item}" for item in items), r"\end{itemize}"]


def _render_entry(entry: Any, *, primary_key: str, secondary_key: str) -> list[str]:
    if not isinstance(entry, dict):
        return []
    primary = _escape_latex(entry.get(primary_key), 500)
    secondary = _escape_latex(entry.get(secondary_key), 500)
    dates = _escape_latex(entry.get("dates"), 200)
    location = _escape_latex(entry.get("location"), 300)
    bullets = _text_list(entry.get("bullets"), max_items=12, max_chars=1_000)
    if not any((primary, secondary, dates, location, bullets)):
        return []

    lines: list[str] = []
    heading = primary or secondary
    if heading:
        line = rf"\textbf{{{heading}}}"
        if dates:
            line += rf"\hfill {dates}"
        lines.append(line + r"\\")
    elif dates:
        lines.append(dates + r"\\")

    detail_parts = [part for part in (secondary if secondary != heading else "", location) if part]
    if detail_parts:
        lines.append(rf"\textit{{{' | '.join(detail_parts)}}}")
    lines.extend(_render_items(bullets))
    return lines


def render_structured_resume(payload: Any) -> str:
    """Render model JSON through a fixed LaTeX template with escaped text fields."""
    if not isinstance(payload, dict):
        raise ValueError("The AI response was not a JSON object.")

    name = _escape_latex(payload.get("name"), 300) or "Candidate"
    contact = _text_list(payload.get("contact"), max_items=10, max_chars=300)
    contact_line = r"\enspace|\enspace ".join(contact)
    lines = [rf"\ResumeHeader{{{name}}}{{{contact_line}}}"]

    summary = _escape_latex(payload.get("summary"), 2_500)
    if summary:
        lines.extend([r"\section*{Professional Summary}", summary])

    skills = _text_list(payload.get("skills"), max_items=40, max_chars=200)
    if skills:
        lines.extend([r"\section*{Skills}", ", ".join(skills)])

    section_specs = (
        ("Experience", "experience", "company", "role"),
        ("Education", "education", "institution", "degree"),
        ("Projects", "projects", "name", "context"),
    )
    for title, key, primary_key, secondary_key in section_specs:
        entries = payload.get(key)
        if not isinstance(entries, list):
            continue
        rendered_entries = [
            rendered
            for entry in entries[:20]
            if (
                rendered := _render_entry(
                    entry,
                    primary_key=primary_key,
                    secondary_key=secondary_key,
                )
            )
        ]
        if rendered_entries:
            lines.append(rf"\section*{{{title}}}")
            for rendered in rendered_entries:
                lines.extend(rendered)

    additional_sections = payload.get("additional_sections")
    if isinstance(additional_sections, list):
        for section in additional_sections[:10]:
            if not isinstance(section, dict):
                continue
            title = _escape_latex(section.get("title"), 200)
            items = _text_list(section.get("items"), max_items=20, max_chars=800)
            if title and items:
                lines.append(rf"\section*{{{title}}}")
                lines.extend(_render_items(items))

    body = "\n".join(lines)
    return validate_generated_latex(body)


def tailor_resume_content(resume_text: str, job_description: str) -> str:
    """Tailor a resume into structured data and deterministically render LaTeX."""
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not configured.")

    model = os.getenv("GROQ_MODEL", DEFAULT_MODEL)
    timeout_seconds = float(os.getenv("GROQ_TIMEOUT_SECONDS", "90"))
    client = Groq(api_key=api_key, timeout=timeout_seconds)

    system_prompt = """
You are an expert resume editor. Tailor the supplied resume to the job description.

Truthfulness is mandatory:
- Use only facts, employers, dates, education, skills, metrics, and contact details
  explicitly present in the source resume.
- Never invent experience, qualifications, numbers, links, employers, titles, or achievements.
- You may rephrase, prioritize, and shorten existing facts.
- If the job requests a skill not supported by the source resume, do not add it.

Return one JSON object and no Markdown. Use exactly these top-level keys:
- name: string
- contact: array of strings
- summary: string
- skills: array of strings
- experience: array of objects with company, role, dates, location, bullets
- education: array of objects with institution, degree, dates, location, bullets
- projects: array of objects with name, context, dates, location, bullets
- additional_sections: array of objects with title and items

Every named key must be present. Use empty strings or arrays when the source resume has no
corresponding data. Values must be plain text without Markdown, HTML, or LaTeX. Keep the
result concise, ATS-readable, and normally within two pages.
""".strip()

    user_prompt = (
        "SOURCE RESUME\n"
        "-------------\n"
        f"{resume_text}\n\n"
        "TARGET JOB DESCRIPTION\n"
        "----------------------\n"
        f"{job_description}\n\n"
        "Return only the truthful structured JSON resume."
    )

    completion = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.2,
        max_tokens=5_000,
        response_format={"type": "json_object"},
    )
    content = completion.choices[0].message.content or ""
    try:
        payload = json.loads(content)
    except json.JSONDecodeError as exc:
        raise ValueError("The AI returned invalid JSON.") from exc
    return render_structured_resume(payload)


def build_latex_document(body: str, template_id: str) -> str:
    """Insert validated resume content into a deterministic template."""
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
\setlist[itemize]{{leftmargin=1.2em,itemsep=1pt,topsep=2pt,label={{{style['item_label']}}}}}
{style['header']}
\titleformat{{\section}}{{{style['section_style']}}}{{}}{{0pt}}{{}}{style['section_suffix']}
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
