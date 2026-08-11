from pathlib import Path

import main
from fastapi.testclient import TestClient

client = TestClient(main.app)


def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["health"] == "/health"


def test_invalid_download_is_not_exposed():
    response = client.get("/download/not-a-job/pdf")
    assert response.status_code == 404


def test_extract_resume_returns_plain_text():
    main.request_history.clear()
    response = client.post(
        "/extract_resume",
        files={"resume": ("resume.txt", b"Alex Morgan\nPython engineer", "text/plain")},
    )
    assert response.status_code == 200
    assert response.json() == {
        "success": True,
        "text": "Alex Morgan\nPython engineer",
        "characters": 27,
    }


def test_tailor_endpoint_returns_temporary_downloads(monkeypatch, tmp_path: Path):
    monkeypatch.setattr(main, "RUNTIME_DIR", tmp_path)
    main.request_history.clear()

    def fake_process(resume_text, job_description, template, job_dir):
        assert "Alex Morgan" in resume_text
        assert "FastAPI" in job_description
        assert template == "template1"
        tex_path = job_dir / "tailored_resume.tex"
        pdf_path = job_dir / "tailored_resume.pdf"
        docx_path = job_dir / "tailored_resume.docx"
        tex_path.write_text("synthetic tex", encoding="utf-8")
        pdf_path.write_bytes(b"%PDF-synthetic")
        docx_path.write_bytes(b"synthetic docx")
        return tex_path, pdf_path, docx_path, []

    monkeypatch.setattr(main, "_process_resume", fake_process)
    response = client.post(
        "/tailor_resume",
        files={"resume": ("resume.txt", b"Alex Morgan\nPython engineer", "text/plain")},
        data={"job_desc": "Build FastAPI services", "template": "template1"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["pdf_url"].endswith("/pdf")
    assert payload["doc_url"].endswith("/docx")

    download_response = client.get(payload["tex_url"])
    assert download_response.status_code == 200
    assert download_response.content == b"synthetic tex"
