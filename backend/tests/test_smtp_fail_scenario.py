"""
Tests for the email-configured-but-failing scenario — exactly what happens when
Resend rejects a message (invalid API key, domain not verified, rate-limited, etc.).

The email functions are lazy-imported inside each endpoint function, so they must be
patched at the app.services.email module level (not on the auth module).
"""

import pytest
from unittest.mock import patch, AsyncMock


def test_register_resend_fail_with_fallback_enabled(client):
    """Resend configured + delivery fails + EMAIL_FALLBACK_ENABLED=True → both fields present."""
    from app.core import config as cfg

    with patch.object(type(cfg.settings), "email_enabled", new_callable=lambda: property(lambda self: True)), \
         patch.object(type(cfg.settings), "fallback_url_enabled", new_callable=lambda: property(lambda self: True)), \
         patch("app.services.email.send_verification_email",
               new_callable=AsyncMock,
               side_effect=Exception("Resend API error: 403 Forbidden")):

        resp = client.post("/api/v1/auth/register", json={
            "email": "resend_fail_fallback@test.com",
            "full_name": "Resend Fail Fallback",
            "password": "SecurePass1!",
            "role": "candidate",
        })

    assert resp.status_code == 201
    body = resp.json()
    assert body.get("email_delivery_failed") is True, f"email_delivery_failed missing: {body}"
    assert "dev_verify_url" in body, f"dev_verify_url missing: {body}"
    assert "/verify-email?token=" in body["dev_verify_url"]


def test_register_resend_fail_without_fallback_enabled(client):
    """Resend configured + delivery fails + fallback disabled → email_delivery_failed set, no URL."""
    from app.core import config as cfg

    with patch.object(type(cfg.settings), "email_enabled", new_callable=lambda: property(lambda self: True)), \
         patch.object(type(cfg.settings), "fallback_url_enabled", new_callable=lambda: property(lambda self: False)), \
         patch("app.services.email.send_verification_email",
               new_callable=AsyncMock,
               side_effect=Exception("Resend API error: 403 Forbidden")):

        resp = client.post("/api/v1/auth/register", json={
            "email": "resend_fail_no_fallback@test.com",
            "full_name": "Resend Fail No Fallback",
            "password": "SecurePass1!",
            "role": "candidate",
        })

    assert resp.status_code == 201
    body = resp.json()
    # email_delivery_failed is STILL set — frontend shows amber "contact support" UI (no button)
    assert body.get("email_delivery_failed") is True, f"email_delivery_failed should be True: {body}"
    assert "dev_verify_url" not in body, f"dev_verify_url should be absent: {body}"


def test_forgot_password_resend_fail_with_fallback_enabled(client, candidate_user):
    """Resend configured + delivery fails + fallback enabled → both fields present."""
    from app.core import config as cfg

    with patch.object(type(cfg.settings), "email_enabled", new_callable=lambda: property(lambda self: True)), \
         patch.object(type(cfg.settings), "fallback_url_enabled", new_callable=lambda: property(lambda self: True)), \
         patch("app.services.email.send_reset_email",
               new_callable=AsyncMock,
               side_effect=Exception("Resend API error: 403 Forbidden")):

        resp = client.post("/api/v1/auth/forgot-password", json={"email": candidate_user.email})

    assert resp.status_code == 200
    body = resp.json()
    assert body.get("email_delivery_failed") is True, f"email_delivery_failed missing: {body}"
    assert "dev_reset_url" in body, f"dev_reset_url missing: {body}"
    assert "/reset-password?token=" in body["dev_reset_url"]


def test_forgot_password_resend_fail_without_fallback_enabled(client, candidate_user):
    """Resend configured + delivery fails + fallback disabled → email_delivery_failed set, no URL."""
    from app.core import config as cfg

    with patch.object(type(cfg.settings), "email_enabled", new_callable=lambda: property(lambda self: True)), \
         patch.object(type(cfg.settings), "fallback_url_enabled", new_callable=lambda: property(lambda self: False)), \
         patch("app.services.email.send_reset_email",
               new_callable=AsyncMock,
               side_effect=Exception("Resend API error: 403 Forbidden")):

        resp = client.post("/api/v1/auth/forgot-password", json={"email": candidate_user.email})

    assert resp.status_code == 200
    body = resp.json()
    # email_delivery_failed is STILL set — frontend shows amber "contact support" UI (no button)
    assert body.get("email_delivery_failed") is True, f"email_delivery_failed should be True: {body}"
    assert "dev_reset_url" not in body, f"dev_reset_url should be absent: {body}"


def test_resend_verification_resend_fail_with_fallback_enabled(client, candidate_user_unverified):
    """Resend configured + delivery fails + fallback enabled → both fields present."""
    from app.core import config as cfg

    with patch.object(type(cfg.settings), "email_enabled", new_callable=lambda: property(lambda self: True)), \
         patch.object(type(cfg.settings), "fallback_url_enabled", new_callable=lambda: property(lambda self: True)), \
         patch("app.services.email.send_verification_email",
               new_callable=AsyncMock,
               side_effect=Exception("Resend API error: 403 Forbidden")):

        resp = client.post("/api/v1/auth/resend-verification", json={
            "email": candidate_user_unverified.email,
        })

    assert resp.status_code == 200
    body = resp.json()
    assert body.get("email_delivery_failed") is True, f"email_delivery_failed missing: {body}"
    assert "dev_verify_url" in body, f"dev_verify_url missing: {body}"
    assert "/verify-email?token=" in body["dev_verify_url"]


def test_resend_verification_resend_fail_without_fallback_enabled(client, candidate_user_unverified):
    """Resend configured + delivery fails + fallback disabled → email_delivery_failed set, no URL."""
    from app.core import config as cfg

    with patch.object(type(cfg.settings), "email_enabled", new_callable=lambda: property(lambda self: True)), \
         patch.object(type(cfg.settings), "fallback_url_enabled", new_callable=lambda: property(lambda self: False)), \
         patch("app.services.email.send_verification_email",
               new_callable=AsyncMock,
               side_effect=Exception("Resend API error: 403 Forbidden")):

        resp = client.post("/api/v1/auth/resend-verification", json={
            "email": candidate_user_unverified.email,
        })

    assert resp.status_code == 200
    body = resp.json()
    assert body.get("email_delivery_failed") is True, f"email_delivery_failed should be True: {body}"
    assert "dev_verify_url" not in body, f"dev_verify_url should be absent: {body}"
