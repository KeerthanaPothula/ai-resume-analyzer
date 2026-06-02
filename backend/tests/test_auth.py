"""
Authentication endpoint tests.

Covers: register, login, invalid-login, token refresh, /me, logout.
"""

import pytest


# ── Registration ───────────────────────────────────────────────────────────────

def test_register_candidate_success(client):
    resp = client.post("/api/v1/auth/register", json={
        "email": "new_candidate@test.com",
        "full_name": "New Candidate",
        "password": "SecurePass1!",
        "role": "candidate",
    })
    assert resp.status_code == 201
    body = resp.json()
    assert body["email"] == "new_candidate@test.com"
    # Email is disabled in test env — dev_verify_url must be returned
    assert "dev_verify_url" in body


def test_register_recruiter_success(client):
    resp = client.post("/api/v1/auth/register", json={
        "email": "new_recruiter@test.com",
        "full_name": "New Recruiter",
        "password": "SecurePass1!",
        "role": "recruiter",
    })
    assert resp.status_code == 201


def test_register_admin_role_forbidden(client):
    """Admin role must never be self-assigned during registration."""
    resp = client.post("/api/v1/auth/register", json={
        "email": "hacker@test.com",
        "full_name": "Hacker",
        "password": "SecurePass1!",
        "role": "admin",
    })
    assert resp.status_code == 403


def test_register_duplicate_email(client, candidate_user):
    resp = client.post("/api/v1/auth/register", json={
        "email": candidate_user.email,
        "full_name": "Duplicate",
        "password": "SecurePass1!",
        "role": "candidate",
    })
    assert resp.status_code == 400


# ── Login ──────────────────────────────────────────────────────────────────────

def test_login_verified_user_success(client, candidate_user):
    resp = client.post("/api/v1/auth/login", data={
        "username": candidate_user.email,
        "password": "Password123!",
    })
    assert resp.status_code == 200
    body = resp.json()
    assert "access_token" in body
    assert "refresh_token" in body
    assert body["token_type"] == "bearer"


def test_login_wrong_password_returns_401(client, candidate_user):
    resp = client.post("/api/v1/auth/login", data={
        "username": candidate_user.email,
        "password": "WrongPassword99!",
    })
    assert resp.status_code == 401


def test_login_nonexistent_user_returns_401(client):
    resp = client.post("/api/v1/auth/login", data={
        "username": "ghost@test.com",
        "password": "SomePassword1!",
    })
    assert resp.status_code == 401


def test_login_unverified_email_blocked(client, candidate_user_unverified):
    """Users who haven't verified their email must be blocked from logging in."""
    resp = client.post("/api/v1/auth/login", data={
        "username": candidate_user_unverified.email,
        "password": "Password123!",
    })
    assert resp.status_code == 403
    assert resp.json()["detail"] == "email_not_verified"


# ── /me ────────────────────────────────────────────────────────────────────────

def test_get_me_with_valid_token(client, candidate_user, candidate_headers):
    resp = client.get("/api/v1/auth/me", headers=candidate_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["email"] == candidate_user.email
    assert body["role"] == "candidate"


def test_get_me_without_token_returns_401(client):
    resp = client.get("/api/v1/auth/me")
    assert resp.status_code == 401


def test_get_me_with_invalid_token_returns_401(client):
    resp = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer not.a.valid.token"})
    assert resp.status_code == 401


# ── Token refresh ──────────────────────────────────────────────────────────────

def test_refresh_token_rotation(client, candidate_user):
    """Refresh should issue a new pair; the old refresh token must be invalidated."""
    login = client.post("/api/v1/auth/login", data={
        "username": candidate_user.email,
        "password": "Password123!",
    })
    old_refresh = login.json()["refresh_token"]

    refresh_resp = client.post("/api/v1/auth/refresh", json={"refresh_token": old_refresh})
    assert refresh_resp.status_code == 200
    body = refresh_resp.json()
    # Refresh tokens embed a unique jti (uuid4) — they are always different.
    assert body["refresh_token"] != old_refresh

    # Old refresh token must now be revoked (token rotation).
    revoked_resp = client.post("/api/v1/auth/refresh", json={"refresh_token": old_refresh})
    assert revoked_resp.status_code == 401


def test_refresh_with_invalid_token_returns_401(client):
    resp = client.post("/api/v1/auth/refresh", json={"refresh_token": "invalid.token.here"})
    assert resp.status_code == 401


# ── Logout ─────────────────────────────────────────────────────────────────────

def test_logout_revokes_refresh_token(client, candidate_user, candidate_headers, db):
    login = client.post("/api/v1/auth/login", data={
        "username": candidate_user.email,
        "password": "Password123!",
    })
    refresh_token = login.json()["refresh_token"]
    access_token = login.json()["access_token"]

    # Logout
    client.post("/api/v1/auth/logout", headers={"Authorization": f"Bearer {access_token}"})

    # Attempt to use the old refresh token — must fail
    resp = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert resp.status_code == 401
