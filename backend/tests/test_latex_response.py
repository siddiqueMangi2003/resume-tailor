import pytest
from latex_response import (
    TEMPLATE_STYLES,
    build_latex_document,
    render_structured_resume,
    validate_generated_latex,
)

SAFE_BODY = r"""
\begin{center}
{\LARGE\textbf{Alex Morgan}}\\
alex.morgan@example.com
\end{center}
\section*{Experience}
\begin{itemize}
\item Built reliable Python APIs.
\end{itemize}
""".strip()


def test_valid_latex_is_accepted():
    assert validate_generated_latex(SAFE_BODY) == SAFE_BODY


@pytest.mark.parametrize(
    "dangerous",
    [
        r"\input{/etc/passwd}",
        r"\write18{curl example.com}",
        r"\documentclass{article}",
        r"\begin{document}hello\end{document}",
    ],
)
def test_dangerous_latex_is_rejected(dangerous):
    with pytest.raises(ValueError):
        validate_generated_latex(dangerous)


@pytest.mark.parametrize("template", sorted(TEMPLATE_STYLES))
def test_all_templates_build_complete_documents(template):
    document = build_latex_document(SAFE_BODY, template)
    assert document.startswith(r"\documentclass")
    assert SAFE_BODY in document
    assert TEMPLATE_STYLES[template]["header"] in document
    assert document.rstrip().endswith(r"\end{document}")


def test_structured_resume_escapes_untrusted_text():
    body = render_structured_resume(
        {
            "name": "Alex Morgan & Co.",
            "contact": ["alex_morgan@example.com"],
            "summary": "Built APIs with 99% uptime.",
            "skills": ["Python", "R&D"],
            "experience": [
                {
                    "company": "Example_Company",
                    "role": "Engineer",
                    "dates": "2022-2025",
                    "location": "Remote",
                    "bullets": ["Reduced errors by 25% & improved reliability."],
                }
            ],
            "education": [],
            "projects": [],
            "additional_sections": [],
        }
    )

    assert r"Alex Morgan \& Co." in body
    assert r"alex\_morgan@example.com" in body
    assert r"Example\_Company" in body
    assert r"25\% \& improved" in body


def test_structured_resume_ignores_non_text_values():
    body = render_structured_resume(
        {
            "name": None,
            "contact": [123, "candidate@example.com"],
            "summary": {"unexpected": "object"},
            "skills": [],
            "experience": [],
            "education": [],
            "projects": [],
            "additional_sections": [],
        }
    )

    assert r"\ResumeHeader{Candidate}" in body
    assert "candidate@example.com" in body


def test_template_catalog_contains_overleaf_adaptations():
    assert {"template4", "template5", "template6"}.issubset(TEMPLATE_STYLES)
