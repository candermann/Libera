"""
Migration: nutzungsjahr-Spalte in gutschrift_posten hinzufügen und befüllen.

Formel: nutzungsjahr = MIN(6, nutzungsjahr_beim_kauf + schuljahr_diff)
Schuljahr-Start: 1. August; schuljahr_diff = schuljahr_start(gutschrift.datum) - schuljahr_start(rechnung.datum)
"""

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent.parent / "backend" / "schulbuch.db"


def schuljahr_start(date_str: str) -> int:
    from datetime import date
    d = date.fromisoformat(date_str[:10])
    return d.year if d.month >= 8 else d.year - 1


def run():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # Spalte hinzufügen falls noch nicht vorhanden
    cols = [row[1] for row in cur.execute("PRAGMA table_info(gutschrift_posten)")]
    if "nutzungsjahr" not in cols:
        cur.execute("ALTER TABLE gutschrift_posten ADD COLUMN nutzungsjahr INTEGER")
        print("Spalte 'nutzungsjahr' hinzugefügt.")
    else:
        print("Spalte 'nutzungsjahr' existiert bereits.")

    # Bestehende Zeilen befüllen
    rows = cur.execute("""
        SELECT gp.id,
               rp.nutzungsjahr_beim_kauf,
               r.datum  AS kauf_datum,
               g.datum  AS rueckgabe_datum
        FROM gutschrift_posten gp
        JOIN rechnungs_posten rp ON rp.id = gp.rechnungs_posten_id
        JOIN rechnungen r        ON r.id  = rp.rechnung_id
        JOIN gutschriften g      ON g.id  = gp.gutschrift_id
        WHERE gp.nutzungsjahr IS NULL
    """).fetchall()

    updated = 0
    for row in rows:
        nj_beim_kauf = row["nutzungsjahr_beim_kauf"] if row["nutzungsjahr_beim_kauf"] is not None else 1
        diff = schuljahr_start(row["rueckgabe_datum"]) - schuljahr_start(row["kauf_datum"])
        nj = min(6, max(0, nj_beim_kauf) + max(0, diff))
        cur.execute("UPDATE gutschrift_posten SET nutzungsjahr = ? WHERE id = ?", (nj, row["id"]))
        updated += 1

    conn.commit()
    conn.close()
    print(f"{updated} Zeilen befüllt.")


if __name__ == "__main__":
    run()
