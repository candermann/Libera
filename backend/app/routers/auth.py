from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Benutzer, Einstellungen
from app.security import (
    verify_password,
    create_access_token,
    ACCESS_TOKEN_EXPIRE_MINUTES,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

_INVALID = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Falscher Benutzername oder Passwort",
    headers={"WWW-Authenticate": "Bearer"},
)


@router.post("/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    username = form_data.username.strip()

    # Check benutzer table (lehrer, schulleiter, sekretariat, ...)
    benutzer = db.query(Benutzer).filter(Benutzer.benutzername == username).first()
    if benutzer:
        if not verify_password(form_data.password, benutzer.passwort_hash):
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
            raise _INVALID
    else:
        raise _INVALID

    access_token = create_access_token(
        data={"sub": username},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return {"access_token": access_token, "token_type": "bearer"}
