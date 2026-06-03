"""
Forgot-password, reset-password, and resend-verification flow tests.
"""

import pytest
from app.core.security import hash_token
from app.models.user import User


# ── Forgot password ────────────────────────────────────────────────────────────

def test_forgot_password_registered_email_returns_200(client, candidate_user):
    resp = client.post("/api/v1/auth/forgot-password", json={"email": candidate_user.email})
    assert resp.status_code == 200
    # Generic message — does not reveal whether the user exists
    assert "message" in resp.json()


def test_forgot_password_unknown_email_returns_same_200(client):
    """Must return 200 with the same generic message for unknown emails (enumeration resistance)."""
    resp = client.post("/api/v1/auth/forgot-password", json={"email": "nobody@example.com"})
    assert resp.status_code == 200
    assert "message" in resp.json()


def test_forgot_password_no_email_transport_returns_dev_url(client, candidate_user):
    """
    Email is disabled in the test environment (SMTP_HOST='' and RESEND_API_KEY='').
    The backend must return dev_reset_url so the test user can actually reset their password.
    """
    resp = client.post("/api/v1/auth/forgot-password", json={"email": candidate_user.email})
    assert resp.status_code == 200
    body = resp.json()
    assert "dev_reset_url" in body
    assert "/reset-password?token=" in body["dev_reset_url"]


def test_forgot_password_fallback_sets_email_delivery_failed(client, candidate_user):
    """No transport configured in test env — forgot-password must set email_delivery_failed=True."""
    resp = client.post("/api/v1/auth/forgot-password", json={"email": candidate_user.email})
    assert resp.status_code == 200
    body = resp.json()
    assert body.get("email_delivery_failed") is True
    assert "dev_reset_url" in body


def test_forgot_password_dev_url_contains_valid_token(client, candidate_user, db):
    """Token embedded in dev_reset_url must match the hashed value stored on the user."""
    resp = client.post("/api/v1/auth/forgot-password", json={"email": candidate_user.email})
    url: str = resp.json()["dev_reset_url"]
    raw_token = url.split("token=")[1]

    db.expire_all()
    user = db.query(User).filter(User.id == candidate_user.id).first()
    assert user.reset_token_hash == hash_token(raw_token)


# ── Reset password ─────────────────────────────────────────────────────────────

def test_reset_password_with_valid_token_succeeds(client, candidate_user):
    # Step 1: request a reset link
    resp = client.post("/api/v1/auth/forgot-password", json={"email": candidate_user.email})
    token = resp.json()["dev_reset_url"].split("token=")[1]

    # Step 2: reset the password
    reset_resp = client.post("/api/v1/auth/reset-password", json={
        "token": token,
        "new_password": "NewSecurePass99!",
    })
    assert reset_resp.status_code == 200
    assert "successfully" in reset_resp.json()["message"].lower()


def test_reset_password_then_login_with_new_password(client, candidate_user):
    resp = client.post("/api/v1/auth/forgot-password", json={"email": candidate_user.email})
    token = resp.json()["dev_reset_url"].split("token=")[1]
    client.post("/api/v1/auth/reset-password", json={
        "token": token,
        "new_password": "BrandNewPass42!",
    })

    login = client.post("/api/v1/auth/login", data={
        "username": candidate_user.email,
        "password": "BrandNewPass42!",
    })
    assert login.status_code == 200
    assert "access_token" in login.json()


def test_reset_password_with_invalid_token_returns_400(client):
    resp = client.post("/api/v1/auth/reset-password", json={
        "token": "totally-invalid-token",
        "new_password": "SomePass123!",
    })
    assert resp.status_code == 400


def test_reset_token_cannot_be_reused(client, candidate_user):
    resp = client.post("/api/v1/auth/forgot-password", json={"email": candidate_user.email})
    token = resp.json()["dev_reset_url"].split("token=")[1]

    # First use — succeeds
    client.post("/api/v1/auth/reset-password", json={
        "token": token,
        "new_password": "FirstNewPass1!",
    })

    # Second use with the same token — must fail
    second = client.post("/api/v1/auth/reset-password", json={
        "token": token,
        "new_password": "SecondNewPass2!",
    })
    assert second.status_code == 400


# ── Resend verification ────────────────────────────────────────────────────────

def test_resend_verification_returns_200(client, candidate_user_unverified):
    resp = client.post("/api/v1/auth/resend-verification", json={
        "email": candidate_user_unverified.email,
    })
    assert resp.status_code == 200


def test_resend_verification_no_transport_returns_dev_verify_url(client, candidate_user_unverified):
    """Email disabled in test env — dev_verify_url must be present."""
    resp = client.post("/api/v1/auth/resend-verification", json={
        "email": candidate_user_unverified.email,
    })
    assert resp.status_code == 200
    body = resp.json()
    assert "dev_verify_url" in body
    assert "/verify-email?token=" in body["dev_verify_url"]


def test_resend_verification_fallback_sets_email_delivery_failed(client, candidate_user_unverified):
    """No transport configured in test env — resend-verification must set email_delivery_failed=True."""
    resp = client.post("/api/v1/auth/resend-verification", json={
        "email": candidate_user_unverified.email,
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body.get("email_delivery_failed") is True
    assert "dev_verify_url" in body


def test_resend_verification_already_verified_returns_generic(client, candidate_user):
    """Already-verified users get the same generic 200 — no information leak."""
    resp = client.post("/api/v1/auth/resend-verification", json={
        "email": candidate_user.email,
    })
    assert resp.status_code == 200
    # Must NOT include a verify URL — user is already verified
    assert "dev_verify_url" not in resp.json()


def test_resend_verification_unknown_email_returns_generic(client):
    resp = client.post("/api/v1/auth/resend-verification", json={
        "email": "doesnotexist@example.com",
    })
    assert resp.status_code == 200
