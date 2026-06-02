"""
Resume upload and file-access tests.
"""

import io
import pytest
from unittest.mock import patch

from tests.conftest import FAKE_ANALYSIS

# Minimal but structurally valid PDF bytes
_MINIMAL_PDF = (
    b"%PDF-1.4\n"
    b"1 0 obj\n<</Type /Catalog /Pages 2 0 R>>\nendobj\n"
    b"2 0 obj\n<</Type /Pages /Kids [3 0 R] /Count 1>>\nendobj\n"
    b"3 0 obj\n<</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]>>\nendobj\n"
    b"xref\n0 4\n0000000000 65535 f\n"
    b"trailer\n<</Size 4 /Root 1 0 R>>\nstartxref\n9\n%%EOF"
)


# ── Upload ─────────────────────────────────────────────────────────────────────

def test_upload_pdf_returns_201_and_analysis(client, candidate_headers):
    with patch("app.api.v1.endpoints.resumes._analyse_resume", return_value=FAKE_ANALYSIS):
        resp = client.post(
            "/api/v1/resumes/upload",
            files={"file": ("resume.pdf", io.BytesIO(_MINIMAL_PDF), "application/pdf")},
            headers=candidate_headers,
        )
    assert resp.status_code == 201
    body = resp.json()
    assert body["candidate_name"] == "John Doe"
    assert body["ats_score"] == 75.0
    assert "Python" in body["extracted_skills"]
    assert body["file_type"] == "pdf"


def test_upload_unsupported_type_returns_400(client, candidate_headers):
    resp = client.post(
        "/api/v1/resumes/upload",
        files={"file": ("notes.txt", io.BytesIO(b"plain text"), "text/plain")},
        headers=candidate_headers,
    )
    assert resp.status_code == 400


def test_upload_file_too_large_returns_400(client, candidate_headers):
    # 11 MB exceeds the 10 MB limit
    oversized = io.BytesIO(b"X" * (11 * 1024 * 1024))
    resp = client.post(
        "/api/v1/resumes/upload",
        files={"file": ("big.pdf", oversized, "application/pdf")},
        headers=candidate_headers,
    )
    assert resp.status_code == 400


def test_upload_requires_authentication(client):
    resp = client.post(
        "/api/v1/resumes/upload",
        files={"file": ("resume.pdf", io.BytesIO(_MINIMAL_PDF), "application/pdf")},
    )
    assert resp.status_code == 401


# ── List ───────────────────────────────────────────────────────────────────────

def test_candidate_lists_only_own_resumes(client, candidate_headers):
    with patch("app.api.v1.endpoints.resumes._analyse_resume", return_value=FAKE_ANALYSIS):
        upload = client.post(
            "/api/v1/resumes/upload",
            files={"file": ("r.pdf", io.BytesIO(_MINIMAL_PDF), "application/pdf")},
            headers=candidate_headers,
        )
    resume_id = upload.json()["id"]

    resp = client.get("/api/v1/resumes/", headers=candidate_headers)
    assert resp.status_code == 200
    ids = [r["id"] for r in resp.json()]
    assert resume_id in ids


# ── Authenticated file download ────────────────────────────────────────────────

def test_download_own_resume_returns_file(client, candidate_user, candidate_headers, db, tmp_path):
    from app.models.resume import Resume

    # Write a real file the endpoint can serve
    fake_file = tmp_path / "fake_resume.pdf"
    fake_file.write_bytes(_MINIMAL_PDF)

    resume = Resume(
        user_id=candidate_user.id,
        filename="fake_resume.pdf",
        file_path=str(fake_file),
        file_type="pdf",
        original_name="My Resume.pdf",
    )
    db.add(resume)
    db.commit()

    resp = client.get(f"/api/v1/resumes/{resume.id}/file", headers=candidate_headers)
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("application/pdf")


def test_download_other_users_resume_returns_403(client, candidate_user,
                                                  candidate_user2,
                                                  candidate_headers,
                                                  candidate2_headers,
                                                  db, tmp_path):
    from app.models.resume import Resume

    fake_file = tmp_path / "other.pdf"
    fake_file.write_bytes(_MINIMAL_PDF)

    resume = Resume(
        user_id=candidate_user2.id,
        filename="other.pdf",
        file_path=str(fake_file),
        file_type="pdf",
        original_name="Other Resume.pdf",
    )
    db.add(resume)
    db.commit()

    # candidate1 tries to download candidate2's file
    resp = client.get(f"/api/v1/resumes/{resume.id}/file", headers=candidate_headers)
    assert resp.status_code == 403


def test_download_nonexistent_resume_returns_404(client, candidate_headers):
    resp = client.get("/api/v1/resumes/99999/file", headers=candidate_headers)
    assert resp.status_code == 404
