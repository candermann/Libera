"""
Security functions for authentication.
"""
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from fastapi import HTTPException, Request, status
from sqlalchemy.orm import Session

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8  # 8 hours — reduced for DSGVO compliance
AUTH_COOKIE_NAME = "bibliomat_session"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def _load_secret_key() -> str:
    secret_key = (os.getenv("SECRET_KEY") or "").strip()
    if not secret_key:
        raise RuntimeError("SECRET_KEY environment variable is required.")
    if len(secret_key) < 32:
        raise RuntimeError("SECRET_KEY must be at least 32 characters long.")
    return secret_key


def ensure_security_config() -> None:
    """Fail fast on startup if required security env vars are missing."""
    _load_secret_key()


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, _load_secret_key(), algorithm=ALGORITHM)
    return encoded_jwt


def get_current_user(request: Request):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    token = None
    auth_header = request.headers.get("Authorization", "").strip()
    if auth_header.lower().startswith("bearer "):
        token = auth_header[7:].strip()
    if not token:
        token = (request.cookies.get(AUTH_COOKIE_NAME) or "").strip()
    if not token:
        raise credentials_exception
    try:
        payload = jwt.decode(token, _load_secret_key(), algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except jwt.InvalidTokenError:
        raise credentials_exception

    return username


def is_admin_user(db: Session, username: str) -> bool:
    """The literal 'admin' account is always admin; any Benutzer can be promoted
    via `rolle = 'admin'` (see backend/app/routers/admin.py)."""
    if username == "admin":
        return True
    from app.models import Benutzer  # local import: avoids a models -> security cycle

    benutzer = db.query(Benutzer).filter(Benutzer.benutzername == username).first()
    return bool(benutzer and benutzer.rolle == "admin")
