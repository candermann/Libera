"""
Einstellungen (settings) endpoints.

GET   /api/einstellungen
PATCH /api/einstellungen
"""

from fastapi import APIRouter, Body, Depends, HTTPException
from jinja2 import Environment, BaseLoader, TemplateSyntaxError
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Einstellungen

router = APIRouter(prefix="/api/einstellungen", tags=["Einstellungen"])
_template_env = Environment(loader=BaseLoader(), autoescape=False)
_SENSITIVE_KEY_PARTS = (
    "password",
    "passwort",
    "secret",
    "token",
    "api_key",
    "apikey",
    "private_key",
    "credential",
    "hash",
)


def _is_sensitive_key(key: str) -> bool:
    lowered = key.lower()
    return any(part in lowered for part in _SENSITIVE_KEY_PARTS)


_SET_FLAG_KEYS = {
    "mail_smtp_password": "mail_smtp_password_set",
    "mail_oauth2_client_secret": "mail_oauth2_client_secret_set",
}


def _public_settings(rows):
    data = {}
    for row in rows:
        if _is_sensitive_key(row.schluessel):
            flag_key = _SET_FLAG_KEYS.get(row.schluessel)
            if flag_key:
                data[flag_key] = bool((row.wert or "").strip())
            continue
        data[row.schluessel] = row.wert
    return data


@router.get("")
def get_einstellungen(db: Session = Depends(get_db)):
    """Get all settings as a flat key-value object."""
    rows = db.query(Einstellungen).all()
    return _public_settings(rows)


@router.patch("")
def update_einstellungen(data: dict = Body(...), db: Session = Depends(get_db)):
    """
    Update settings — accepts arbitrary key-value pairs.

    Existing keys are updated, new keys are inserted.
    """
    for template_key in ("mail_subject_template", "mail_body_template"):
        if template_key not in data:
            continue
        value = str(data.get(template_key) or "")
        try:
            _template_env.from_string(value)
        except TemplateSyntaxError as exc:
            raise HTTPException(
                status_code=422,
                detail=f"Ungueltiges Template in '{template_key}': {exc}",
            ) from exc

    _allowed_sensitive = set(_SET_FLAG_KEYS.keys())

    for key, value in data.items():
        if _is_sensitive_key(key):
            if key not in _allowed_sensitive:
                raise HTTPException(
                    status_code=400,
                    detail=f"'{key}' darf nicht ueber Einstellungen geaendert werden.",
                )
            if not str(value or "").strip():
                continue
        existing = db.query(Einstellungen).filter(
            Einstellungen.schluessel == key
        ).first()
        if existing:
            existing.wert = str(value)
        else:
            db.add(Einstellungen(schluessel=key, wert=str(value)))

    db.commit()

    # Return updated settings
    rows = db.query(Einstellungen).all()
    return _public_settings(rows)
