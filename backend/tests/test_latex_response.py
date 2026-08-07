import pytest
from latex_response import build_latex_document, validate_generated_latex

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


@pytest.mark.parametrize("template", ["template1", "template2", "template3"])
def test_all_templates_build_complete_documents(template):
    document = build_latex_document(SAFE_BODY, template)
    assert document.startswith(r"\documentclass")
    assert SAFE_BODY in document
    assert document.rstrip().endswith(r"\end{document}")
