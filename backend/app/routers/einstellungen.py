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


@router.get("")
def get_einstellungen(db: Session = Depends(get_db)):
    """Get all settings as a flat key-value object."""
    rows = db.query(Einstellungen).all()
    return {r.schluessel: r.wert for r in rows}


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

    for key, value in data.items():
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
    return {r.schluessel: r.wert for r in rows}
