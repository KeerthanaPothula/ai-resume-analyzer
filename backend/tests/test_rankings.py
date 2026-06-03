"""
Rankings and applications endpoint tests.
"""

import io
import pytest
from unittest.mock import patch

from app.models.job import JobDescription
from app.models.resume import Resume
from app.models.job import CandidateRanking, ApplicationStatus
from tests.conftest import FAKE_ANALYSIS


# ── Helpers ────────────────────────────────────────────────────────────────────

_MINIMAL_PDF = (
    b"%PDF-1.4\n"
    b"1 0 obj\n<</Type /Catalog /Pages 2 0 R>>\nendobj\n"
    b"2 0 obj\n<</Type /Pages /Kids [3 0 R] /Count 1>>\nendobj\n"
    b"3 0 obj\n<</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]>>\nendobj\n"
    b"xref\n0 4\n0000000000 65535 f\n"
    b"trailer\n<</Size 4 /Root 1 0 R>>\nstartxref\n9\n%%EOF"
)


def _create_job(client, headers, title="Engineer", description="Python developer needed."):
    resp = client.post("/api/v1/jobs/", json={"title": title, "description": description},
                       headers=headers)
    assert resp.status_code == 201
    return resp.json()["id"]


def _upload_resume(client, headers):
    with patch("app.api.v1.endpoints.resumes._analyse_resume", return_value=FAKE_ANALYSIS):
        resp = client.post(
            "/api/v1/resumes/upload",
            files={"file": ("resume.pdf", io.BytesIO(_MINIMAL_PDF), "application/pdf")},
            headers=headers,
        )
    assert resp.status_code == 201
    return resp.json()["id"]


def _apply(client, headers, job_id, resume_id):
    resp = client.post("/api/v1/applications/apply",
                       json={"job_id": job_id, "resume_id": resume_id},
                       headers=headers)
    assert resp.status_code == 200
    return resp.json()


# ── GET /rankings/job/{id} — no applicants ─────────────────────────────────────

def test_rankings_empty_for_new_job(client, recruiter_user, recruiter_headers):
    job_id = _create_job(client, recruiter_headers)
    resp = client.get(f"/api/v1/rankings/job/{job_id}", headers=recruiter_headers)
    assert resp.status_code == 200
    assert resp.json() == []


def test_candidate_cannot_view_rankings(client, recruiter_user, recruiter_headers, candidate_headers):
    job_id = _create_job(client, recruiter_headers)
    resp = client.get(f"/api/v1/rankings/job/{job_id}", headers=candidate_headers)
    assert resp.status_code == 403


def test_rankings_nonexistent_job_returns_404(client, recruiter_headers):
    resp = client.get("/api/v1/rankings/job/99999", headers=recruiter_headers)
    assert resp.status_code == 404


# ── Applications → rankings pipeline ──────────────────────────────────────────

def test_apply_to_job_creates_ranking(client, recruiter_user, candidate_user,
                                      recruiter_headers, candidate_headers):
    job_id = _create_job(client, recruiter_headers)
    resume_id = _upload_resume(client, candidate_headers)

    result = _apply(client, candidate_headers, job_id, resume_id)
    assert result["job_id"] == job_id
    assert result["resume_id"] == resume_id
    assert "score" in result


def test_apply_shows_up_in_rankings(client, recruiter_user, candidate_user,
                                    recruiter_headers, candidate_headers):
    job_id = _create_job(client, recruiter_headers)
    resume_id = _upload_resume(client, candidate_headers)
    _apply(client, candidate_headers, job_id, resume_id)

    resp = client.get(f"/api/v1/rankings/job/{job_id}", headers=recruiter_headers)
    assert resp.status_code == 200
    rankings = resp.json()
    assert len(rankings) == 1
    assert rankings[0]["resume_id"] == resume_id


def test_duplicate_application_returns_409(client, recruiter_user, candidate_user,
                                           recruiter_headers, candidate_headers):
    job_id = _create_job(client, recruiter_headers)
    resume_id = _upload_resume(client, candidate_headers)
    _apply(client, candidate_headers, job_id, resume_id)

    second = client.post("/api/v1/applications/apply",
                         json={"job_id": job_id, "resume_id": resume_id},
                         headers=candidate_headers)
    assert second.status_code == 409


def test_my_applications_returns_applied_job(client, recruiter_user, candidate_user,
                                             recruiter_headers, candidate_headers):
    job_id = _create_job(client, recruiter_headers, title="My Applied Job")
    resume_id = _upload_resume(client, candidate_headers)
    _apply(client, candidate_headers, job_id, resume_id)

    resp = client.get("/api/v1/rankings/my-applications", headers=candidate_headers)
    assert resp.status_code == 200
    job_ids = [a["job_id"] for a in resp.json()]
    assert job_id in job_ids


# ── Rank candidates ────────────────────────────────────────────────────────────

def test_rank_with_no_applicants_returns_400(client, recruiter_user, recruiter_headers):
    job_id = _create_job(client, recruiter_headers)
    resp = client.post(f"/api/v1/rankings/rank/{job_id}", json=[], headers=recruiter_headers)
    assert resp.status_code == 400


def test_rank_candidates_after_apply(client, recruiter_user, candidate_user,
                                     recruiter_headers, candidate_headers):
    job_id = _create_job(client, recruiter_headers)
    resume_id = _upload_resume(client, candidate_headers)
    _apply(client, candidate_headers, job_id, resume_id)

    resp = client.post(f"/api/v1/rankings/rank/{job_id}",
                       json=[resume_id], headers=recruiter_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total_candidates"] == 1
    assert body["rankings"][0]["resume_id"] == resume_id


# ── PATCH ranking status ───────────────────────────────────────────────────────

def test_update_ranking_status_to_shortlisted(client, recruiter_user, candidate_user,
                                              recruiter_headers, candidate_headers, db):
    job_id = _create_job(client, recruiter_headers)
    resume_id = _upload_resume(client, candidate_headers)
    apply_resp = _apply(client, candidate_headers, job_id, resume_id)
    ranking_id = apply_resp["ranking_id"]

    resp = client.patch(f"/api/v1/rankings/{ranking_id}",
                        json={"application_status": "shortlisted"},
                        headers=recruiter_headers)
    assert resp.status_code == 200
    assert resp.json()["application_status"] == "shortlisted"


def test_candidate_cannot_update_ranking(client, recruiter_user, candidate_user,
                                         recruiter_headers, candidate_headers):
    job_id = _create_job(client, recruiter_headers)
    resume_id = _upload_resume(client, candidate_headers)
    apply_resp = _apply(client, candidate_headers, job_id, resume_id)
    ranking_id = apply_resp["ranking_id"]

    resp = client.patch(f"/api/v1/rankings/{ranking_id}",
                        json={"application_status": "accepted"},
                        headers=candidate_headers)
    assert resp.status_code == 403
