import logging
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.limiter import limiter
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_active_user,
    get_password_hash,
    hash_token,
    verify_password,
)
from app.db.database import get_db
from app.models.user import User
from app.schemas.user import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    ResendVerificationRequest,
    ResetPasswordRequest,
    Token,
    TokenPair,
    TokenRefresh,
    UserCreate,
    UserResponse,
    VerifyEmailRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Internal helpers ───────────────────────────────────────────────────────────

def _issue_token_pair(user: User, db: Session) -> dict:
    """Create a fresh access + refresh pair, persist the refresh hash, return dict."""
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(user_id=user.id)

    user.refresh_token_hash = hash_token(refresh_token)
    user.last_login = datetime.now(timezone.utc)
    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": user,
    }


def _create_verification_token(user: User, db: Session) -> str:
    """Generate a verification token, store its hash on the user, return the raw token."""
    raw_token = secrets.token_urlsafe(32)
    user.email_verification_token_hash = hash_token(raw_token)
    user.email_verification_token_expires = (
        datetime.now(timezone.utc)
        + timedelta(hours=settings.VERIFICATION_TOKEN_EXPIRE_HOURS)
    )
    db.add(user)
    db.commit()
    return raw_token


# ── POST /register ─────────────────────────────────────────────────────────────

@router.post("/register", status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def register(request: Request, user_data: UserCreate, db: Session = Depends(get_db)):
    if user_data.role.value not in settings.ALLOWED_REGISTRATION_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Role '{user_data.role.value}' cannot be self-assigned during registration.",
        )

    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    user = User(
        email=user_data.email,
        full_name=user_data.full_name,
        role=user_data.role,
        hashed_password=get_password_hash(user_data.password),
        email_verified=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    raw_token = _create_verification_token(user, db)
    verify_url = f"{settings.FRONTEND_URL}/verify-email?token={raw_token}"

    logger.info("New user registered: %s (role=%s)", user.email, user.role.value)
    # Always log the URL — recoverable from Render logs even when email is enabled
    logger.info(
        "[VERIFY-URL] email=%s  expires_hours=%d  url=%s",
        user.email, settings.VERIFICATION_TOKEN_EXPIRE_HOURS, verify_url,
    )

    email_delivery_failed = False
    if settings.email_enabled:
        try:
            from app.services.email import send_verification_email
            await send_verification_email(user.email, user.full_name, verify_url)
            logger.info("Verification email dispatched OK — to=%s", user.email)
        except Exception as exc:
            email_delivery_failed = True
            logger.error(
                "[EMAIL-FAIL] register — to=%s  error=%s: %s",
                user.email, type(exc).__name__, exc,
            )
    else:
        logger.info(
            "[DEV] RESEND_API_KEY not set — skipping email delivery for %s",
            user.email,
        )

    response: dict = {
        "message": "Account created! Please check your email to verify your account before signing in.",
        "email": user.email,
    }
    if email_delivery_failed:
        response["email_delivery_failed"] = True
        response["message"] = (
            "Account created! Email delivery is currently unavailable. "
            "Use the verification link to activate your account."
        )
        if settings.fallback_url_enabled:
            response["dev_verify_url"] = verify_url
    elif not settings.email_enabled:
        # No transport configured — always signal delivery failure so the
        # frontend shows the amber UI and the Verify Account button.
        response["email_delivery_failed"] = True
        response["message"] = (
            "Account created! Email delivery is currently unavailable. "
            "Use the verification link to activate your account."
        )
        response["dev_verify_url"] = verify_url
    return response


# ── POST /login ────────────────────────────────────────────────────────────────

@router.post("/login", response_model=Token)
@limiter.limit("10/minute")
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == form_data.username).first()

    # Use constant-time comparison to resist timing attacks
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")

    if not user.email_verified:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="email_not_verified")

    return _issue_token_pair(user, db)


# ── POST /refresh ──────────────────────────────────────────────────────────────

@router.post("/refresh", response_model=TokenPair)
@limiter.limit("20/minute")
async def refresh_tokens(request: Request, body: TokenRefresh, db: Session = Depends(get_db)):
    try:
        payload = decode_token(body.refresh_token)
    except HTTPException:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Wrong token type")

    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Malformed token")

    user = db.query(User).filter(User.id == int(sub)).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

    # Verify the token hasn't been revoked (hash comparison)
    if not user.refresh_token_hash or user.refresh_token_hash != hash_token(body.refresh_token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token revoked")

    # Token rotation: issue a brand-new pair and invalidate the old refresh token
    new_access = create_access_token(data={"sub": str(user.id)})
    new_refresh = create_refresh_token(user_id=user.id)
    user.refresh_token_hash = hash_token(new_refresh)
    db.add(user)
    db.commit()

    return {"access_token": new_access, "refresh_token": new_refresh, "token_type": "bearer"}


# ── POST /logout ───────────────────────────────────────────────────────────────

@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    """Revoke the refresh token so it cannot be used again after logout."""
    current_user.refresh_token_hash = None
    db.add(current_user)
    db.commit()


# ── POST /change-password ──────────────────────────────────────────────────────

@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("5/minute")
async def change_password(
    request: Request,
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    current_user.hashed_password = get_password_hash(body.new_password)
    db.add(current_user)
    db.commit()


# ── GET /me ────────────────────────────────────────────────────────────────────

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_active_user)):
    return current_user


# ── POST /forgot-password ──────────────────────────────────────────────────────

@router.post("/forgot-password", status_code=status.HTTP_200_OK)
@limiter.limit("3/minute")
async def forgot_password(
    request: Request,
    body: ForgotPasswordRequest,
    db: Session = Depends(get_db),
):
    # Generic message always returned — prevents email enumeration
    generic_response = {"message": "If that email is registered, you will receive a reset link shortly."}

    user = db.query(User).filter(User.email == body.email).first()
    if not user or not user.is_active:
        return generic_response

    raw_token = secrets.token_urlsafe(32)
    user.reset_token_hash = hash_token(raw_token)
    user.reset_token_expires = datetime.now(timezone.utc) + timedelta(minutes=settings.RESET_TOKEN_EXPIRE_MINUTES)
    db.add(user)
    db.commit()

    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={raw_token}"

    logger.info("Password reset requested for: %s", user.email)
    # Always log the URL — recoverable from Render logs even when email is enabled
    logger.info(
        "[RESET-URL] email=%s  expires_minutes=%d  url=%s",
        user.email, settings.RESET_TOKEN_EXPIRE_MINUTES, reset_url,
    )

    if settings.email_enabled:
        email_delivery_failed = False
        try:
            from app.services.email import send_reset_email
            await send_reset_email(user.email, reset_url, settings.RESET_TOKEN_EXPIRE_MINUTES)
            logger.info("Password reset email dispatched OK — to=%s", user.email)
        except Exception as exc:
            email_delivery_failed = True
            logger.error(
                "[EMAIL-FAIL] forgot-password — to=%s  error=%s: %s  url=%s",
                user.email, type(exc).__name__, exc, reset_url,
            )
        if email_delivery_failed:
            result = {**generic_response, "email_delivery_failed": True}
            if settings.fallback_url_enabled:
                result["dev_reset_url"] = reset_url
            return result
        return generic_response
    else:
        logger.info(
            "[DEV] email not configured — skipping email delivery for %s",
            user.email,
        )
        return {**generic_response, "email_delivery_failed": True, "dev_reset_url": reset_url}


# ── POST /reset-password ───────────────────────────────────────────────────────

@router.post("/reset-password", status_code=status.HTTP_200_OK)
@limiter.limit("5/minute")
async def reset_password(
    request: Request,
    body: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    token_hash = hash_token(body.token)
    user = db.query(User).filter(User.reset_token_hash == token_hash).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )

    now = datetime.now(timezone.utc)
    expires = user.reset_token_expires
    # SQLite stores naive datetimes; treat them as UTC
    if expires is not None and expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires is None or now > expires:
        user.reset_token_hash = None
        user.reset_token_expires = None
        db.add(user)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token has expired. Please request a new one.",
        )

    user.hashed_password = get_password_hash(body.new_password)
    user.reset_token_hash = None
    user.reset_token_expires = None
    user.refresh_token_hash = None  # Revoke all active sessions
    db.add(user)
    db.commit()

    return {"message": "Password reset successfully. You can now log in with your new password."}


# ── POST /verify-email ─────────────────────────────────────────────────────────

@router.post("/verify-email", status_code=status.HTTP_200_OK)
@limiter.limit("10/minute")
async def verify_email(
    request: Request,
    body: VerifyEmailRequest,
    db: Session = Depends(get_db),
):
    token_hash = hash_token(body.token)
    user = db.query(User).filter(User.email_verification_token_hash == token_hash).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification link.",
        )

    if user.email_verified:
        user.email_verification_token_hash = None
        user.email_verification_token_expires = None
        db.add(user)
        db.commit()
        return {"message": "Email already verified. You can sign in."}

    now = datetime.now(timezone.utc)
    expires = user.email_verification_token_expires
    if expires is not None and expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires is None or now > expires:
        user.email_verification_token_hash = None
        user.email_verification_token_expires = None
        db.add(user)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification link has expired. Please request a new one.",
        )

    user.email_verified = True
    user.email_verification_token_hash = None
    user.email_verification_token_expires = None
    db.add(user)
    db.commit()

    return {"message": "Email verified successfully. You can now sign in."}


# ── POST /resend-verification ──────────────────────────────────────────────────

@router.post("/resend-verification", status_code=status.HTTP_200_OK)
@limiter.limit("3/minute")
async def resend_verification(
    request: Request,
    body: ResendVerificationRequest,
    db: Session = Depends(get_db),
):
    generic_response = {
        "message": "If that email is registered and unverified, a new verification link has been sent."
    }

    user = db.query(User).filter(User.email == body.email).first()
    if not user or not user.is_active or user.email_verified:
        return generic_response

    # Per-user cooldown: don't resend if the last token is less than 60 seconds old
    if user.email_verification_token_expires is not None:
        expires = user.email_verification_token_expires
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        issued_at = expires - timedelta(hours=settings.VERIFICATION_TOKEN_EXPIRE_HOURS)
        if datetime.now(timezone.utc) - issued_at < timedelta(seconds=60):
            return generic_response  # Silently rate-limited

    raw_token = _create_verification_token(user, db)
    verify_url = f"{settings.FRONTEND_URL}/verify-email?token={raw_token}"

    # Always log the URL — recoverable from Render logs even when email is enabled
    logger.info(
        "[VERIFY-URL] email=%s  expires_hours=%d  url=%s",
        user.email, settings.VERIFICATION_TOKEN_EXPIRE_HOURS, verify_url,
    )

    if settings.email_enabled:
        email_delivery_failed = False
        try:
            from app.services.email import send_verification_email
            await send_verification_email(user.email, user.full_name, verify_url)
            logger.info("Verification email re-dispatched OK — to=%s", user.email)
        except Exception as exc:
            email_delivery_failed = True
            logger.error(
                "[EMAIL-FAIL] resend-verification — to=%s  error=%s: %s  url=%s",
                user.email, type(exc).__name__, exc, verify_url,
            )
        if email_delivery_failed:
            response = dict(generic_response)
            response["email_delivery_failed"] = True
            if settings.fallback_url_enabled:
                response["dev_verify_url"] = verify_url
            return response
        return generic_response
    else:
        logger.info(
            "[DEV] email not configured — skipping email delivery for %s",
            user.email,
        )
        return {**generic_response, "email_delivery_failed": True, "dev_verify_url": verify_url}
