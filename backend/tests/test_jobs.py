"""
Job CRUD endpoint tests.
"""

import pytest


# ── Create ─────────────────────────────────────────────────────────────────────

def test_recruiter_creates_job_returns_201(client, recruiter_headers):
    resp = client.post("/api/v1/jobs/", json={
        "title": "Backend Engineer",
        "description": "Build APIs with Python FastAPI and PostgreSQL.",
    }, headers=recruiter_headers)
    assert resp.status_code == 201
    body = resp.json()
    assert body["title"] == "Backend Engineer"
    assert isinstance(body["required_skills"], list)


def test_create_job_auto_extracts_skills(client, recruiter_headers):
    resp = client.post("/api/v1/jobs/", json={
        "title": "ML Engineer",
        "description": "Work with Python, TensorFlow, PyTorch and scikit-learn on production models.",
    }, headers=recruiter_headers)
    assert resp.status_code == 201
    skills = [s.lower() for s in resp.json()["required_skills"]]
    assert any(s in skills for s in ("python", "tensorflow", "pytorch", "scikit-learn"))


def test_candidate_cannot_create_job(client, candidate_headers):
    resp = client.post("/api/v1/jobs/", json={
        "title": "Job",
        "description": "Description.",
    }, headers=candidate_headers)
    assert resp.status_code == 403


def test_unauthenticated_cannot_create_job(client):
    resp = client.post("/api/v1/jobs/", json={
        "title": "Job",
        "description": "Description.",
    })
    assert resp.status_code == 401


# ── List ───────────────────────────────────────────────────────────────────────

def test_recruiter_lists_own_jobs_only(client, recruiter_user, recruiter_user2,
                                       recruiter_headers, recruiter2_headers):
    client.post("/api/v1/jobs/", json={"title": "Job A", "description": "Python backend role."},
                headers=recruiter_headers)
    client.post("/api/v1/jobs/", json={"title": "Job B", "description": "React frontend role."},
                headers=recruiter2_headers)

    resp = client.get("/api/v1/jobs/", headers=recruiter_headers)
    assert resp.status_code == 200
    titles = [j["title"] for j in resp.json()]
    assert "Job A" in titles
    assert "Job B" not in titles


def test_list_jobs_pagination(client, recruiter_headers):
    for i in range(5):
        client.post("/api/v1/jobs/", json={
            "title": f"Paginated Job {i}",
            "description": "Python developer needed.",
        }, headers=recruiter_headers)

    page1 = client.get("/api/v1/jobs/?skip=0&limit=3", headers=recruiter_headers)
    page2 = client.get("/api/v1/jobs/?skip=3&limit=3", headers=recruiter_headers)
    assert page1.status_code == 200
    assert page2.status_code == 200
    assert len(page1.json()) <= 3
    # Combined should not duplicate
    ids1 = {j["id"] for j in page1.json()}
    ids2 = {j["id"] for j in page2.json()}
    assert ids1.isdisjoint(ids2)


# ── Get by ID ──────────────────────────────────────────────────────────────────

def test_get_job_by_id_returns_job(client, recruiter_headers):
    create = client.post("/api/v1/jobs/", json={
        "title": "DevOps Engineer",
        "description": "Docker, Kubernetes, CI/CD pipelines.",
    }, headers=recruiter_headers)
    job_id = create.json()["id"]

    resp = client.get(f"/api/v1/jobs/{job_id}", headers=recruiter_headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == job_id


def test_get_nonexistent_job_returns_404(client, recruiter_headers):
    resp = client.get("/api/v1/jobs/99999", headers=recruiter_headers)
    assert resp.status_code == 404


# ── Update ─────────────────────────────────────────────────────────────────────

def test_recruiter_updates_own_job(client, recruiter_headers):
    create = client.post("/api/v1/jobs/", json={
        "title": "Old Title",
        "description": "Original description with Python.",
    }, headers=recruiter_headers)
    job_id = create.json()["id"]

    resp = client.put(f"/api/v1/jobs/{job_id}", json={
        "title": "New Title",
        "description": "Updated description with FastAPI and PostgreSQL.",
    }, headers=recruiter_headers)
    assert resp.status_code == 200
    assert resp.json()["title"] == "New Title"


def test_recruiter_cannot_update_other_recruiters_job(
        client, recruiter_headers, recruiter2_headers):
    create = client.post("/api/v1/jobs/", json={
        "title": "Owned Job",
        "description": "Python role.",
    }, headers=recruiter2_headers)
    job_id = create.json()["id"]

    resp = client.put(f"/api/v1/jobs/{job_id}", json={
        "title": "Hijacked",
        "description": "Takeover attempt.",
    }, headers=recruiter_headers)
    assert resp.status_code == 403


# ── Delete ─────────────────────────────────────────────────────────────────────

def test_recruiter_deletes_own_job(client, recruiter_headers):
    create = client.post("/api/v1/jobs/", json={
        "title": "Delete Me",
        "description": "Temporary job posting.",
    }, headers=recruiter_headers)
    job_id = create.json()["id"]

    resp = client.delete(f"/api/v1/jobs/{job_id}", headers=recruiter_headers)
    assert resp.status_code == 204

    confirm = client.get(f"/api/v1/jobs/{job_id}", headers=recruiter_headers)
    assert confirm.status_code == 404


def test_recruiter_cannot_delete_other_recruiters_job(
        client, recruiter_headers, recruiter2_headers):
    create = client.post("/api/v1/jobs/", json={
        "title": "Protected Job",
        "description": "Python developer.",
    }, headers=recruiter2_headers)
    job_id = create.json()["id"]

    resp = client.delete(f"/api/v1/jobs/{job_id}", headers=recruiter_headers)
    assert resp.status_code == 403
