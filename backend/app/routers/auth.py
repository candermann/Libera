import logging
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Benutzer, Einstellungen
from app.security import (
    AUTH_COOKIE_NAME,
    verify_password,
    create_access_token,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    get_current_user,
    is_admin_user,
)
from app.limiter import limiter

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["auth"])

_INVALID = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Falscher Benutzername oder Passwort",
    headers={"WWW-Authenticate": "Bearer"},
)


@router.post("/login")
@limiter.limit("10/minute")
def login(
    request: Request,
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    username = form_data.username.strip()

    # Check benutzer table (lehrer, schulleiter, sekretariat, ...)
    benutzer = db.query(Benutzer).filter(Benutzer.benutzername == username).first()
    if benutzer:
        if not verify_password(form_data.password, benutzer.passwort_hash):
            logger.warning("Login fehlgeschlagen: Benutzer '%s'", username)
            raise _INVALID
    elif username == "admin":
        # Admin password stored in einstellungen for backward compatibility
        hash_record = db.query(Einstellungen).filter(
            Einstellungen.schluessel == "admin_password_hash"
        ).first()
        if not hash_record or not (hash_record.wert or "").strip():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Admin-Passwort ist nicht initialisiert. Bitte Setup ausfuehren.",
            )
        if not verify_password(form_data.password, hash_record.wert):
            logger.warning("Login fehlgeschlagen: Benutzer '%s'", username)
            raise _INVALID
    else:
        logger.warning("Login fehlgeschlagen: unbekannter Benutzer '%s'", username)
        raise _INVALID

    logger.info("Login erfolgreich: Benutzer '%s'", username)
    access_token = create_access_token(
        data={"sub": username},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    response.set_cookie(
        key=AUTH_COOKIE_NAME,
        value=access_token,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        httponly=True,
        samesite="lax",
        # Keep this False for plain HTTP deployments; switch to True only behind HTTPS.
        secure=False,
        path="/",
    )
    # Auth is carried by the httpOnly cookie set above; the frontend doesn't read
    # this body, so the raw token isn't echoed here to avoid needless exposure.
    return {"status": "ok"}


@router.post("/logout", status_code=204)
def logout(response: Response):
    response.delete_cookie(AUTH_COOKIE_NAME, path="/")


@router.get("/me")
def me(current_user: str = Depends(get_current_user), db: Session = Depends(get_db)):
    return {"username": current_user, "ist_admin": is_admin_user(db, current_user)}
