"""
Role-based access-control tests.

Covers: candidate / recruiter / admin permission boundaries.
"""

import pytest
from app.models.job import JobDescription
from app.models.resume import Resume


# ── Job creation permissions ───────────────────────────────────────────────────

def test_candidate_cannot_create_job(client, candidate_headers):
    resp = client.post("/api/v1/jobs/", json={
        "title": "Software Engineer",
        "description": "Build great software with Python.",
    }, headers=candidate_headers)
    assert resp.status_code == 403


def test_recruiter_can_create_job(client, recruiter_headers):
    resp = client.post("/api/v1/jobs/", json={
        "title": "Software Engineer",
        "description": "Build great software with Python FastAPI.",
    }, headers=recruiter_headers)
    assert resp.status_code == 201
    assert resp.json()["title"] == "Software Engineer"


def test_unauthenticated_cannot_create_job(client):
    resp = client.post("/api/v1/jobs/", json={
        "title": "Software Engineer",
        "description": "Build great software.",
    })
    assert resp.status_code == 401


# ── Resume access permissions ──────────────────────────────────────────────────

def test_candidate_can_only_see_own_resumes(
    client, candidate_user, candidate_user2, candidate_headers, db
):
    # Give candidate2 a resume
    resume = Resume(
        user_id=candidate_user2.id,
        filename="other.pdf",
        file_path="./test_uploads/other.pdf",
        file_type="pdf",
        original_name="other.pdf",
    )
    db.add(resume)
    db.commit()

    # Candidate1 lists resumes — should NOT see candidate2's resume
    resp = client.get("/api/v1/resumes/", headers=candidate_headers)
    assert resp.status_code == 200
    ids = [r["id"] for r in resp.json()]
    assert resume.id not in ids


def test_candidate_cannot_access_other_users_resume_by_id(
    client, candidate_user, candidate_user2, candidate_headers, db
):
    resume = Resume(
        user_id=candidate_user2.id,
        filename="private.pdf",
        file_path="./test_uploads/private.pdf",
        file_type="pdf",
        original_name="private.pdf",
    )
    db.add(resume)
    db.commit()

    resp = client.get(f"/api/v1/resumes/{resume.id}", headers=candidate_headers)
    assert resp.status_code == 403


def test_admin_can_access_all_resumes(client, candidate_user, admin_headers, db):
    resume = Resume(
        user_id=candidate_user.id,
        filename="cand.pdf",
        file_path="./test_uploads/cand.pdf",
        file_type="pdf",
        original_name="cand.pdf",
    )
    db.add(resume)
    db.commit()

    resp = client.get("/api/v1/resumes/", headers=admin_headers)
    assert resp.status_code == 200
    ids = [r["id"] for r in resp.json()]
    assert resume.id in ids


# ── Ranking permissions ────────────────────────────────────────────────────────

def test_candidate_cannot_rank_candidates(client, recruiter_user, candidate_headers, db):
    job = JobDescription(
        recruiter_id=recruiter_user.id,
        title="Engineer",
        description="Python developer role.",
    )
    db.add(job)
    db.commit()

    resp = client.post(f"/api/v1/rankings/rank/{job.id}",
                       json=[], headers=candidate_headers)
    assert resp.status_code == 403


def test_recruiter_cannot_view_other_recruiters_rankings(
    client, recruiter_user, recruiter_user2, recruiter_headers, db
):
    # Job owned by recruiter2
    job = JobDescription(
        recruiter_id=recruiter_user2.id,
        title="Designer",
        description="UI/UX design role.",
    )
    db.add(job)
    db.commit()

    resp = client.get(f"/api/v1/rankings/job/{job.id}", headers=recruiter_headers)
    assert resp.status_code == 403


def test_recruiter_can_view_own_job_rankings(client, recruiter_user, recruiter_headers, db):
    job = JobDescription(
        recruiter_id=recruiter_user.id,
        title="My Job",
        description="Python FastAPI developer.",
    )
    db.add(job)
    db.commit()

    # No applicants yet — should return empty list, not 403
    resp = client.get(f"/api/v1/rankings/job/{job.id}", headers=recruiter_headers)
    assert resp.status_code == 200
    assert resp.json() == []


# ── Admin permissions ──────────────────────────────────────────────────────────

def test_admin_can_delete_any_resume(client, candidate_user, admin_headers, db):
    resume = Resume(
        user_id=candidate_user.id,
        filename="todel.pdf",
        file_path="./test_uploads/todel.pdf",
        file_type="pdf",
        original_name="todel.pdf",
    )
    db.add(resume)
    db.commit()

    resp = client.delete(f"/api/v1/resumes/{resume.id}", headers=admin_headers)
    assert resp.status_code == 204


def test_candidate_cannot_delete_other_users_resume(
    client, candidate_user, candidate_user2, candidate_headers, db
):
    resume = Resume(
        user_id=candidate_user2.id,
        filename="keep.pdf",
        file_path="./test_uploads/keep.pdf",
        file_type="pdf",
        original_name="keep.pdf",
    )
    db.add(resume)
    db.commit()

    resp = client.delete(f"/api/v1/resumes/{resume.id}", headers=candidate_headers)
    assert resp.status_code == 403
