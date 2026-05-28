"""
Fortlaufende ID-Generierung mit Thread-Safety.

- S-NNNN, B-NNNN: laufender Zähler 4-stellig zero-padded
- R-YYYY-NNNN, G-YYYY-NNNN: Schuljahr-Beginn-Jahr + laufende Nummer
"""

import threading
from sqlalchemy import text
from sqlalchemy.orm import Session

# Module-level lock — SQLite is single-writer anyway, but this prevents
# race conditions when two requests try to generate IDs concurrently.
_id_lock = threading.Lock()


def _next_counter(db: Session, table: str, prefix: str, pattern: str) -> int:
    """
    Find the current max counter for a given prefix pattern and return next.

    For S-NNNN / B-NNNN: pattern = 'S-%' or 'B-%'
    For R-YYYY-NNNN / G-YYYY-NNNN: pattern = 'R-2025-%' or 'G-2025-%'
    """
    row = db.execute(
        text(f"SELECT MAX(id) FROM {table} WHERE id LIKE :pattern"),
        {"pattern": pattern},
    ).scalar()

    if row is None:
        return 1

    # Extract the numeric suffix
    # e.g. "S-0042" → "0042" → 42, or "R-2025-0017" → "0017" → 17
    parts = row.rsplit("-", 1)
    try:
        return int(parts[-1]) + 1
    except (ValueError, IndexError):
        return 1


def generate_schueler_id(db: Session) -> str:
    """Generate next S-NNNN id."""
    with _id_lock:
        counter = _next_counter(db, "schueler", "S", "S-%")
        return f"S-{counter:04d}"


def generate_buch_id(db: Session) -> str:
    """Generate next B-NNNN id."""
    with _id_lock:
        counter = _next_counter(db, "buecher", "B", "B-%")
        return f"B-{counter:04d}"


def generate_rechnungs_id(db: Session, schuljahr: str) -> str:
    """
    Generate next R-YYYY-NNNN id for the given school year.

    schuljahr is e.g. "2025/2026" → year = "2025"
    """
    year = schuljahr.split("/")[0]
    with _id_lock:
        counter = _next_counter(
            db, "rechnungen", f"R-{year}", f"R-{year}-%"
        )
        return f"R-{year}-{counter:04d}"


def generate_lernmaterial_id(db: Session) -> str:
    """Generate next M-NNNN id."""
    with _id_lock:
        counter = _next_counter(db, "lernmaterial", "M", "M-%")
        return f"M-{counter:04d}"


def generate_gutschrift_id(db: Session, schuljahr: str) -> str:
    """
    Generate next G-YYYY-NNNN id for the given school year.

    schuljahr is e.g. "2025/2026" → year = "2025"
    """
    year = schuljahr.split("/")[0]
    with _id_lock:
        counter = _next_counter(
            db, "gutschriften", f"G-{year}", f"G-{year}-%"
        )
        return f"G-{year}-{counter:04d}"
