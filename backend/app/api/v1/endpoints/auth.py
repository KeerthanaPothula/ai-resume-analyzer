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
    ResetPasswordRequest,
    Token,
    TokenPair,
    TokenRefresh,
    UserCreate,
    UserResponse,
)

router = APIRouter()


# ── Internal helper ────────────────────────────────────────────────────────────

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


# ── POST /register ─────────────────────────────────────────────────────────────

@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def register(request: Request, user_data: UserCreate, db: Session = Depends(get_db)):
    # Guard: users cannot self-assign privileged roles (e.g. admin)
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
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return _issue_token_pair(user, db)


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

    if settings.SMTP_HOST:
        # Production: send real email, never expose the token in the response
        try:
            from app.services.email import send_reset_email
            await send_reset_email(user.email, reset_url, settings.RESET_TOKEN_EXPIRE_MINUTES)
        except Exception as exc:
            # Log the error but don't reveal it to the caller (prevents info leakage)
            print(f"[ERROR] Failed to send reset email to {user.email}: {exc}")
        return generic_response
    else:
        # Dev fallback: print to terminal and include URL in response body
        print(f"\n{'='*60}")
        print(f"[DEV] Password reset requested for: {user.email}")
        print(f"[DEV] Reset URL (valid {settings.RESET_TOKEN_EXPIRE_MINUTES} min):")
        print(f"      {reset_url}")
        print(f"{'='*60}\n")
        return {**generic_response, "dev_reset_url": reset_url}


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