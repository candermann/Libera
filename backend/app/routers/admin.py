"""
Admin router — Benutzerverwaltung und Backup/Restore.
"""

import logging
import os
from datetime import date
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Benutzer, Einstellungen
from app.security import get_current_user, get_password_hash, is_admin_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin", tags=["Admin"])

ROLLEN = ("standard", "admin")


def require_admin(
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not is_admin_user(db, current_user):
        raise HTTPException(status_code=403, detail="Nur für Administratoren.")
    return current_user


# ── Schemas ──────────────────────────────────────────────────────────────────

class BenutzerCreate(BaseModel):
    benutzername: str
    passwort: str
    rolle: str = "standard"


class PasswortChange(BaseModel):
    passwort: str


class RolleChange(BaseModel):
    rolle: str


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/benutzer")
def list_benutzer(
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
    """Gibt Liste aller Benutzer zurück (benutzername + rolle, kein Passwort)."""
    benutzer = db.query(Benutzer).all()
    return [{"benutzername": b.benutzername, "rolle": b.rolle} for b in benutzer]


@router.post("/benutzer", status_code=201)
def create_benutzer(
    data: BenutzerCreate,
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
    """Neuen Benutzer anlegen."""
    name = (data.benutzername or "").strip()
    if not name:
        raise HTTPException(status_code=422, detail="Benutzername darf nicht leer sein.")
    if name == "admin":
        raise HTTPException(status_code=422, detail="Benutzername 'admin' ist reserviert.")
    if not data.passwort:
        raise HTTPException(status_code=422, detail="Passwort darf nicht leer sein.")
    rolle = data.rolle if data.rolle in ROLLEN else "standard"
    existing = db.query(Benutzer).filter(Benutzer.benutzername == name).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Benutzer '{name}' existiert bereits.")
    neuer = Benutzer(benutzername=name, passwort_hash=get_password_hash(data.passwort), rolle=rolle)
    db.add(neuer)
    db.commit()
    logger.info("Benutzer angelegt: '%s' (Rolle: %s)", name, rolle)
    return {"benutzername": name, "rolle": rolle}


@router.delete("/benutzer/{benutzername}", status_code=204)
def delete_benutzer(
    benutzername: str,
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
    """Benutzer löschen."""
    if benutzername == "admin":
        raise HTTPException(status_code=403, detail="Admin-Konto kann nicht gelöscht werden.")
    benutzer = db.query(Benutzer).filter(Benutzer.benutzername == benutzername).first()
    if not benutzer:
        raise HTTPException(status_code=404, detail=f"Benutzer '{benutzername}' nicht gefunden.")
    db.delete(benutzer)
    db.commit()
    logger.warning("Benutzer gelöscht: '%s'", benutzername)
    return None


@router.patch("/benutzer/{benutzername}/passwort")
def change_benutzer_passwort(
    benutzername: str,
    data: PasswortChange,
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
    """Passwort eines normalen Benutzers ändern."""
    if not data.passwort:
        raise HTTPException(status_code=422, detail="Passwort darf nicht leer sein.")
    benutzer = db.query(Benutzer).filter(Benutzer.benutzername == benutzername).first()
    if not benutzer:
        raise HTTPException(status_code=404, detail=f"Benutzer '{benutzername}' nicht gefunden.")
    benutzer.passwort_hash = get_password_hash(data.passwort)
    db.commit()
    return {"status": "ok"}


@router.patch("/benutzer/{benutzername}/rolle")
def change_benutzer_rolle(
    benutzername: str,
    data: RolleChange,
    db: Session = Depends(get_db),
    current_user: str = Depends(require_admin),
):
    """Rolle eines Benutzers ändern ('standard' oder 'admin')."""
    if data.rolle not in ROLLEN:
        raise HTTPException(status_code=422, detail=f"Rolle muss eine von {ROLLEN} sein.")
    benutzer = db.query(Benutzer).filter(Benutzer.benutzername == benutzername).first()
    if not benutzer:
        raise HTTPException(status_code=404, detail=f"Benutzer '{benutzername}' nicht gefunden.")
    benutzer.rolle = data.rolle
    db.commit()
    logger.info("Rolle geändert: '%s' -> '%s' (durch '%s')", benutzername, data.rolle, current_user)
    return {"benutzername": benutzername, "rolle": benutzer.rolle}


@router.patch("/passwort")
def change_admin_passwort(
    data: PasswortChange,
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
    """Admin-Passwort in der einstellungen-Tabelle speichern."""
    if not data.passwort:
        raise HTTPException(status_code=422, detail="Passwort darf nicht leer sein.")
    hashed = get_password_hash(data.passwort)
    eintrag = db.query(Einstellungen).filter(
        Einstellungen.schluessel == "admin_password_hash"
    ).first()
    if eintrag:
        eintrag.wert = hashed
    else:
        eintrag = Einstellungen(schluessel="admin_password_hash", wert=hashed)
        db.add(eintrag)
    db.commit()
    return {"status": "ok"}


# ── Backup & Restore ─────────────────────────────────────────────────────────

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///data/schulbuch.db")


def _db_path() -> Path:
    """Parse DATABASE_URL to a filesystem path."""
    # sqlite:///data/schulbuch.db  → relative: ./data/schulbuch.db
    # sqlite:////opt/data/schulbuch.db → absolute: /opt/data/schulbuch.db
    url = DATABASE_URL
    if url.startswith("sqlite:////"):
        return Path(url[len("sqlite:///"):])
    elif url.startswith("sqlite:///"):
        return Path(url[len("sqlite:///"):])
    raise RuntimeError(f"Unbekanntes DATABASE_URL-Format: {url}")


@router.get("/backup")
def backup_db(
    db: Session = Depends(get_db),
    current_user: str = Depends(require_admin),
):
    """SQLite-Datenbankdatei zum Download."""
    db.execute(text("PRAGMA wal_checkpoint(FULL)"))
    db_path = _db_path()
    if not db_path.exists():
        raise HTTPException(status_code=404, detail="Datenbankdatei nicht gefunden.")
    filename = f"bibliomat-backup-{date.today().isoformat()}.db"
    logger.info("Backup heruntergeladen von Benutzer '%s'", current_user)
    return FileResponse(
        path=str(db_path),
        media_type="application/octet-stream",
        filename=filename,
    )


SQLITE_MAGIC = b"SQLite format 3\x00"


@router.post("/restore")
async def restore_db(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: str = Depends(require_admin),
):
    """Datenbank aus Upload-Datei wiederherstellen."""
    header = await file.read(16)
    if header != SQLITE_MAGIC:
        raise HTTPException(status_code=422, detail="Keine gültige SQLite-Datei.")

    rest = await file.read()
    content = header + rest

    db_path = _db_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    db_path.write_bytes(content)

    logger.warning("Datenbank-Restore ausgeführt von Benutzer '%s'", current_user)
    return {"status": "restored"}
