"""
Database engine, session factory, and initialization.

Uses SQLite with WAL mode for better concurrent read performance.
"""

import os

from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import Connection
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///data/schulbuch.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False,
)


@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_connection, connection_record):
    """Enable WAL mode and foreign keys for every new SQLite connection."""
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """FastAPI dependency - yields a DB session and closes it afterwards."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


_VIEW_SALDO = """
CREATE VIEW IF NOT EXISTS v_schueler_saldo AS
SELECT
  s.id AS schueler_id,
  COALESCE(SUM(CASE
    WHEN q.typ = 'gutschrift'   THEN  q.betrag_cents
    WHEN q.typ = 'auszahlung'   THEN -q.betrag_cents
    WHEN q.typ = 'verrechnung'  THEN -q.betrag_cents
    ELSE 0
  END), 0) AS saldo_cents
FROM schueler s
LEFT JOIN (
  SELECT schueler_id, 'gutschrift' AS typ, summe_cents AS betrag_cents
    FROM gutschriften
  UNION ALL
  SELECT schueler_id, 'auszahlung' AS typ, betrag_cents
    FROM auszahlungen
  UNION ALL
  SELECT r.schueler_id, 'verrechnung' AS typ, rv.betrag_cents
    FROM rechnung_verrechnungen rv
    JOIN rechnungen r ON r.id = rv.rechnung_id
    WHERE r.status != 'storniert'
) q ON q.schueler_id = s.id
GROUP BY s.id;
"""

_VIEW_VORGAENGE = """
CREATE VIEW IF NOT EXISTS v_schueler_vorgaenge AS
SELECT id, schueler_id, datum, 'rechnung' AS typ, -summe_cents AS betrag_cents,
       CASE WHEN verrechnet_cents > 0
         THEN 'Schulbücher ' || schuljahr || ' (inkl. ' || CAST(verrechnet_cents / 100 AS TEXT) || ',' || SUBSTR('0' || CAST(verrechnet_cents % 100 AS TEXT), -2) || ' € Guthaben)'
         ELSE 'Schulbücher ' || schuljahr
       END AS bezeichnung,
       mail_versandt_am
  FROM rechnungen
  WHERE status != 'storniert'
UNION ALL
SELECT id, schueler_id, datum, 'gutschrift' AS typ, summe_cents AS betrag_cents,
       'Buchrückgabe' AS bezeichnung,
       NULL AS mail_versandt_am
  FROM gutschriften
UNION ALL
SELECT CAST(id AS TEXT), schueler_id, datum, 'auszahlung' AS typ, -betrag_cents AS betrag_cents,
       COALESCE('Auszahlung Schulguthaben' || CASE WHEN notizen IS NOT NULL AND notizen != '' THEN ' · ' || notizen ELSE '' END, 'Auszahlung Schulguthaben') AS bezeichnung,
       NULL AS mail_versandt_am
  FROM auszahlungen
UNION ALL
SELECT CAST(rv.id AS TEXT), r.schueler_id, r.datum, 'verrechnung' AS typ, -rv.betrag_cents AS betrag_cents,
       'Verrechnung mit Rechnung ' || r.id || CASE WHEN b.titel IS NOT NULL THEN ' · ' || b.titel ELSE '' END AS bezeichnung,
       NULL AS mail_versandt_am
  FROM rechnung_verrechnungen rv
  JOIN rechnungen r ON r.id = rv.rechnung_id
  LEFT JOIN gutschrift_posten gp ON gp.id = rv.gutschrift_posten_id
  LEFT JOIN rechnungs_posten rp ON rp.id = gp.rechnungs_posten_id
  LEFT JOIN buecher b ON b.id = rp.buch_id
  WHERE r.status != 'storniert';
"""

_DEFAULT_EINSTELLUNGEN = {
    "schule_name": "Staedtisches Gymnasium",
    "schule_strasse": "Schulstrasse 12",
    "schule_plz": "52538",
    "schule_ort": "Gangelt",
    "schule_telefon": "02454 / 12345",
    "schule_email": "sekretariat@example-schule.de",
    "schule_iban": "DE12 3704 0044 0532 0130 00",
    "schule_bic": "COBADEFFXXX",
    "schule_bank": "Sparkasse Heinsberg",
    "schuljahr_aktuell": "2025/2026",
    "zustand_abschlag_sehr_gut_prozent": "0",
    "zustand_abschlag_gut_prozent": "10",
    "zustand_abschlag_mangelhaft_prozent": "25",
    "zustand_abschlag_beschaedigt_prozent": "50",
    "nutzungsjahr_abschlag_1_prozent": "0",
    "nutzungsjahr_abschlag_2_prozent": "10",
    "nutzungsjahr_abschlag_3_prozent": "20",
    "nutzungsjahr_abschlag_4_prozent": "30",
    "nutzungsjahr_abschlag_5_prozent": "40",
    "rueckgabe_aufschlag_prozent": "0",
    "mail_smtp_host": "",
    "mail_smtp_port": "587",
    "mail_smtp_username": "",
    "mail_smtp_password": "",
    "mail_smtp_use_starttls": "true",
    "mail_smtp_use_ssl": "false",
    "mail_from_email": "",
    "mail_from_name": "",
    "mail_reply_to": "",
    "mail_subject_template": "Rechnung {{ rechnung.id }} fuer {{ schueler.name }}",
    "mail_body_template": (
        "Sehr geehrte Familie {{ schueler.nachname }},\n\n"
        "im Anhang dieser Nachricht senden wir Ihnen die Rechnung der Schulbuecher "
        "von {{ schueler.vorname }}, {{ schueler.nachname }} in Hoehe von "
        "{{ rechnung.zu_zahlen_eur }}.\n\n"
        "Den Rechnungsbetrag werden wir in **acht Tagen** von dem zwischen uns "
        "vertraglich vereinbarten Konto abbuchen. Bitte die Buecher in einem "
        "Umschlag versehen."
    ),
}

_OLD_DEFAULT_MAIL_BODY_TEMPLATE = (
    "Guten Tag,\n\n"
    "anbei erhalten Sie die Rechnung {{ rechnung.id }} fuer {{ schueler.name }} "
    "(Klasse {{ schueler.klasse }}).\n"
    "Gesamtbetrag: {{ rechnung.summe_eur }}.\n\n"
    "Mit freundlichen Gruessen\n"
    "{{ schule.name }}"
)


def _table_columns(conn: Connection, table_name: str) -> set[str]:
    rows = conn.execute(text(f"PRAGMA table_info({table_name})")).fetchall()
    return {row.name for row in rows}


def _create_or_update_views(conn: Connection):
    conn.execute(text("DROP VIEW IF EXISTS v_schueler_saldo"))
    conn.execute(text("DROP VIEW IF EXISTS v_schueler_vorgaenge"))
    conn.execute(text(_VIEW_SALDO))
    conn.execute(text(_VIEW_VORGAENGE))


def _ensure_performance_indexes(conn: Connection):
    conn.execute(text(
        "CREATE INDEX IF NOT EXISTS idx_gutschriften_erstellt "
        "ON gutschriften (erstellt_am)"
    ))
    conn.execute(text(
        "CREATE INDEX IF NOT EXISTS idx_zahlungen_erstellt "
        "ON zahlungen (erstellt_am)"
    ))
    conn.execute(text(
        "CREATE INDEX IF NOT EXISTS idx_auszahlungen_erstellt "
        "ON auszahlungen (erstellt_am)"
    ))


def _ensure_inventory_table(conn: Connection):
    conn.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS buch_zustand_bestand (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                buch_id TEXT NOT NULL REFERENCES buecher(id),
                zustand TEXT NOT NULL DEFAULT 'sehr_gut',
                verkaufspreis_cents INTEGER NOT NULL,
                bestand_verfuegbar INTEGER NOT NULL DEFAULT 0
            )
            """
        )
    )
    conn.execute(
        text(
            """
            CREATE INDEX IF NOT EXISTS idx_buch_zustand_buch
            ON buch_zustand_bestand (buch_id)
            """
        )
    )


def _ensure_schueler_archiv_column(conn: Connection):
    cols = _table_columns(conn, "schueler")
    if "archiviert_am" not in cols:
        conn.execute(text("ALTER TABLE schueler ADD COLUMN archiviert_am TEXT"))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_schueler_archiviert ON schueler (archiviert_am)"
        ))
    if "klasse_seit" not in cols:
        conn.execute(text("ALTER TABLE schueler ADD COLUMN klasse_seit TEXT"))
    if "erstes_schuljahr" not in cols:
        conn.execute(text("ALTER TABLE schueler ADD COLUMN erstes_schuljahr TEXT"))

    # Backfill for existing students: infer school year from creation timestamp.
    conn.execute(text("""
        UPDATE schueler
        SET erstes_schuljahr = CASE
            WHEN CAST(strftime('%m', COALESCE(substr(angelegt_am, 1, 10), date('now'))) AS INTEGER) >= 8
                THEN printf(
                    '%04d/%04d',
                    CAST(strftime('%Y', COALESCE(substr(angelegt_am, 1, 10), date('now'))) AS INTEGER),
                    CAST(strftime('%Y', COALESCE(substr(angelegt_am, 1, 10), date('now'))) AS INTEGER) + 1
                )
            ELSE printf(
                '%04d/%04d',
                CAST(strftime('%Y', COALESCE(substr(angelegt_am, 1, 10), date('now'))) AS INTEGER) - 1,
                CAST(strftime('%Y', COALESCE(substr(angelegt_am, 1, 10), date('now'))) AS INTEGER)
            )
        END
        WHERE erstes_schuljahr IS NULL OR TRIM(erstes_schuljahr) = ''
    """))


def _ensure_freiposten_tables(conn: Connection):
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS freiposten_vorlagen (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bezeichnung TEXT NOT NULL,
            betrag_cents INTEGER NOT NULL,
            typ TEXT NOT NULL DEFAULT 'Pauschal',
            angelegt_am TEXT NOT NULL DEFAULT (datetime('now'))
        )
    """))
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS rechnung_freiposten (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            rechnung_id TEXT NOT NULL REFERENCES rechnungen(id),
            bezeichnung TEXT NOT NULL,
            betrag_cents INTEGER NOT NULL,
            typ TEXT NOT NULL DEFAULT 'Pauschal'
        )
    """))
    conn.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_freiposten_rechnung
        ON rechnung_freiposten (rechnung_id)
    """))


def _ensure_lernmaterial_tables(conn: Connection):
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS lernmaterial (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            kategorie TEXT NOT NULL,
            preis_cents INTEGER NOT NULL,
            bestand_gesamt INTEGER NOT NULL DEFAULT 0,
            bestand_ausgegeben INTEGER NOT NULL DEFAULT 0,
            angelegt_am TEXT NOT NULL DEFAULT (datetime('now')),
            geloescht_am TEXT
        )
    """))
    conn.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_lernmaterial_kategorie
        ON lernmaterial (kategorie)
    """))
    conn.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_lernmaterial_name
        ON lernmaterial (name)
    """))
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS lernmaterial_posten (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            rechnung_id TEXT NOT NULL REFERENCES rechnungen(id),
            lernmaterial_id TEXT NOT NULL REFERENCES lernmaterial(id),
            preis_cents INTEGER NOT NULL
        )
    """))
    conn.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_lm_posten_rechnung
        ON lernmaterial_posten (rechnung_id)
    """))
    conn.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_lm_posten_material
        ON lernmaterial_posten (lernmaterial_id)
    """))


def _ensure_rechnung_verrechnung_table(conn: Connection):
    conn.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS rechnung_verrechnungen (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                rechnung_id TEXT NOT NULL REFERENCES rechnungen(id),
                gutschrift_posten_id INTEGER REFERENCES gutschrift_posten(id),
                quelle_typ TEXT NOT NULL DEFAULT 'rueckgabe',
                betrag_cents INTEGER NOT NULL
            )
            """
        )
    )
    conn.execute(
        text(
            """
            CREATE INDEX IF NOT EXISTS idx_rechnung_verrechnung_rechnung
            ON rechnung_verrechnungen (rechnung_id)
            """
        )
    )
    conn.execute(
        text(
            """
            CREATE INDEX IF NOT EXISTS idx_rechnung_verrechnung_gutschrift
            ON rechnung_verrechnungen (gutschrift_posten_id)
            """
        )
    )


def _ensure_lernmaterial_menge_column(conn: Connection):
    cols = _table_columns(conn, "lernmaterial_posten")
    if "menge" not in cols:
        conn.execute(text("ALTER TABLE lernmaterial_posten ADD COLUMN menge INTEGER NOT NULL DEFAULT 1"))


def _ensure_mail_versandt_column(conn: Connection):
    cols = _table_columns(conn, "rechnungen")
    if "mail_versandt_am" not in cols:
        conn.execute(text("ALTER TABLE rechnungen ADD COLUMN mail_versandt_am TEXT"))
    if "mail_versandt_an" not in cols:
        conn.execute(text("ALTER TABLE rechnungen ADD COLUMN mail_versandt_an TEXT"))


def _ensure_additional_columns(conn: Connection):
    posten_columns = _table_columns(conn, "rechnungs_posten")
    if "zustand" not in posten_columns:
        conn.execute(
            text(
                """
                ALTER TABLE rechnungs_posten
                ADD COLUMN zustand TEXT NOT NULL DEFAULT 'sehr_gut'
                """
            )
        )

    gutschrift_columns = _table_columns(conn, "gutschrift_posten")
    if "zustand" not in gutschrift_columns:
        conn.execute(
            text(
                """
                ALTER TABLE gutschrift_posten
                ADD COLUMN zustand TEXT NOT NULL DEFAULT 'sehr_gut'
                """
            )
        )
    if "abschreibung_prozent" not in gutschrift_columns:
        conn.execute(
            text(
                """
                ALTER TABLE gutschrift_posten
                ADD COLUMN abschreibung_prozent INTEGER NOT NULL DEFAULT 0
                """
            )
        )
    if "ursprungs_preis_cents" not in gutschrift_columns:
        conn.execute(
            text(
                """
                ALTER TABLE gutschrift_posten
                ADD COLUMN ursprungs_preis_cents INTEGER NOT NULL DEFAULT 0
                """
            )
        )

    buecher_columns = _table_columns(conn, "buecher")
    if "schutzgebuehr_cents" not in buecher_columns:
        conn.execute(text("ALTER TABLE buecher ADD COLUMN schutzgebuehr_cents INTEGER"))


def _merge_duplicate_bestand_buckets(conn: Connection):
    """Collapse rows that share (buch_id, nutzungsjahr) into one."""
    conn.execute(text("""
        UPDATE buch_zustand_bestand
        SET bestand_verfuegbar = (
            SELECT SUM(bestand_verfuegbar)
            FROM buch_zustand_bestand b2
            WHERE b2.buch_id = buch_zustand_bestand.buch_id
              AND (b2.nutzungsjahr IS buch_zustand_bestand.nutzungsjahr)
        )
        WHERE id IN (
            SELECT MIN(id)
            FROM buch_zustand_bestand
            GROUP BY buch_id, nutzungsjahr
            HAVING COUNT(*) > 1
        )
    """))
    conn.execute(text("""
        DELETE FROM buch_zustand_bestand
        WHERE id NOT IN (
            SELECT MIN(id)
            FROM buch_zustand_bestand
            GROUP BY buch_id, nutzungsjahr
        )
    """))


def _migrate_nutzungsjahr_constraint(conn: Connection):
    """
    Einmalige Migration:
    1. NULL-Nutzungsjahre → 0 (Neu).
    2. Altes Unique-Constraint (buch_id, zustand, preis) entfernen —
       falls es als Inline-Constraint im CREATE TABLE steckt, wird die Tabelle
       neu erstellt (SQLite-typischer Workaround für ALTER TABLE DROP CONSTRAINT).
    3. Neues Unique-Index (buch_id, nutzungsjahr) anlegen.

    Läuft idempotent.
    """
    # Schritt 1: NULL → 0
    conn.execute(text(
        "UPDATE buch_zustand_bestand SET nutzungsjahr = 0 WHERE nutzungsjahr IS NULL"
    ))

    # Schritt 2: Prüfen ob der alte Inline-Constraint noch im Schema steckt
    table_sql = conn.execute(text(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='buch_zustand_bestand'"
    )).scalar() or ""

    if "uq_buch_zustand_preis" in table_sql or "CONSTRAINT" in table_sql:
        # Tabelle ohne alten Constraint neu erstellen (FK-Prüfung kurzzeitig deaktivieren)
        conn.execute(text("PRAGMA foreign_keys = OFF"))
        conn.execute(text("""
            CREATE TABLE buch_zustand_bestand_v2 (
                id INTEGER NOT NULL,
                buch_id TEXT NOT NULL,
                zustand TEXT NOT NULL DEFAULT 'sehr_gut',
                verkaufspreis_cents INTEGER NOT NULL,
                bestand_verfuegbar INTEGER NOT NULL DEFAULT 0,
                nutzungsjahr INTEGER,
                PRIMARY KEY (id),
                FOREIGN KEY(buch_id) REFERENCES buecher (id)
            )
        """))
        conn.execute(text("""
            INSERT INTO buch_zustand_bestand_v2
                (id, buch_id, zustand, verkaufspreis_cents, bestand_verfuegbar, nutzungsjahr)
            SELECT id, buch_id, zustand, verkaufspreis_cents, bestand_verfuegbar, nutzungsjahr
            FROM buch_zustand_bestand
        """))
        conn.execute(text("DROP TABLE buch_zustand_bestand"))
        conn.execute(text("ALTER TABLE buch_zustand_bestand_v2 RENAME TO buch_zustand_bestand"))
        conn.execute(text("CREATE INDEX idx_buch_zustand_buch ON buch_zustand_bestand (buch_id)"))
        conn.execute(text("CREATE INDEX idx_buch_zustand_zustand ON buch_zustand_bestand (zustand)"))
        conn.execute(text("PRAGMA foreign_keys = ON"))

    # Schritt 3: Alten Standalone-Index entfernen (falls noch vorhanden) und neuen anlegen
    conn.execute(text("DROP INDEX IF EXISTS uq_buch_zustand_preis"))
    conn.execute(text("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_buch_nutzungsjahr
        ON buch_zustand_bestand (buch_id, nutzungsjahr)
    """))


def _seed_default_settings(conn: Connection):
    for key, value in _DEFAULT_EINSTELLUNGEN.items():
        conn.execute(
            text(
                "INSERT OR IGNORE INTO einstellungen (schluessel, wert) "
                "VALUES (:key, :value)"
            ),
            {"key": key, "value": value},
        )


def _seed_initial_admin_password(conn: Connection):
    initial_password = (os.getenv("ADMIN_INITIAL_PASSWORD") or "").strip()
    if not initial_password:
        return
    if len(initial_password) < 10:
        raise RuntimeError("ADMIN_INITIAL_PASSWORD must be at least 10 characters long.")

    from app.security import get_password_hash

    conn.execute(
        text(
            """
            INSERT OR IGNORE INTO einstellungen (schluessel, wert)
            VALUES ('admin_password_hash', :password_hash)
            """
        ),
        {"password_hash": get_password_hash(initial_password)},
    )


def _ensure_mail_template_defaults(conn: Connection):
    current = conn.execute(
        text(
            """
            SELECT wert
            FROM einstellungen
            WHERE schluessel = 'mail_body_template'
            """
        )
    ).scalar()

    if current is None:
        return

    if (not current.strip()) or current.strip() == _OLD_DEFAULT_MAIL_BODY_TEMPLATE.strip():
        conn.execute(
            text(
                """
                UPDATE einstellungen
                SET wert = :new_template
                WHERE schluessel = 'mail_body_template'
                """
            ),
            {"new_template": _DEFAULT_EINSTELLUNGEN["mail_body_template"]},
        )


def _ensure_benutzer_table(conn: Connection):
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS benutzer (
            benutzername TEXT PRIMARY KEY,
            passwort_hash TEXT NOT NULL
        )
    """))


def _seed_initial_benutzer(conn: Connection):
    from app.security import get_password_hash

    initial_password = (os.getenv("EXTRA_USERS_PASSWORD") or "").strip()
    needs_seed = any(
        not conn.execute(
            text("SELECT benutzername FROM benutzer WHERE benutzername = :u"),
            {"u": u},
        ).first()
        for u in ("lehrer", "schulleiter", "sekretariat")
    )
    if needs_seed and not initial_password:
        raise RuntimeError(
            "EXTRA_USERS_PASSWORD muss in der .env gesetzt sein, "
            "bevor der Server zum ersten Mal gestartet wird."
        )
    for username in ("lehrer", "schulleiter", "sekretariat"):
        existing = conn.execute(
            text("SELECT benutzername FROM benutzer WHERE benutzername = :u"),
            {"u": username},
        ).first()
        if not existing:
            conn.execute(
                text("INSERT INTO benutzer (benutzername, passwort_hash) VALUES (:u, :h)"),
                {"u": username, "h": get_password_hash(initial_password)},
            )


def _seed_inventory_rows(conn: Connection):
    rows = conn.execute(
        text(
            """
            SELECT id, preis_cents, bestand_gesamt, bestand_ausgegeben
            FROM buecher
            """
        )
    ).fetchall()
    for row in rows:
        existing_count = conn.execute(
            text(
                """
                SELECT COUNT(*) AS cnt
                FROM buch_zustand_bestand
                WHERE buch_id = :buch_id
                """
            ),
            {"buch_id": row.id},
        ).scalar() or 0
        if existing_count > 0:
            continue

        verfuegbar = max(0, row.bestand_gesamt - row.bestand_ausgegeben)
        conn.execute(
            text(
                """
                INSERT INTO buch_zustand_bestand
                    (buch_id, zustand, verkaufspreis_cents, bestand_verfuegbar, nutzungsjahr)
                VALUES
                    (:buch_id, 'sehr_gut', :preis_cents, :bestand_verfuegbar, 0)
                """
            ),
            {
                "buch_id": row.id,
                "preis_cents": row.preis_cents,
                "bestand_verfuegbar": verfuegbar,
            },
        )


def _ensure_bestand_schuljahr_eingestellt(conn: Connection):
    cols = _table_columns(conn, "buch_zustand_bestand")
    if "schuljahr_eingestellt" not in cols:
        conn.execute(text("ALTER TABLE buch_zustand_bestand ADD COLUMN schuljahr_eingestellt INTEGER"))
    from datetime import date
    d = date.today()
    current_sj = d.year if d.month >= 8 else d.year - 1
    conn.execute(text(
        "UPDATE buch_zustand_bestand SET schuljahr_eingestellt = :sj "
        "WHERE schuljahr_eingestellt IS NULL AND nutzungsjahr > 0"
    ), {"sj": current_sj})


def _ensure_gutschrift_beschaedigt_column(conn: Connection):
    cols = [r[1] for r in conn.execute(text("PRAGMA table_info(gutschrift_posten)")).fetchall()]
    if "beschaedigt" not in cols:
        conn.execute(text("ALTER TABLE gutschrift_posten ADD COLUMN beschaedigt INTEGER NOT NULL DEFAULT 0"))


def _ensure_archiviert_schuljahr_column(conn: Connection):
    cols = _table_columns(conn, "schueler")
    if "archiviert_schuljahr" not in cols:
        conn.execute(text("ALTER TABLE schueler ADD COLUMN archiviert_schuljahr TEXT"))


def _ensure_rechnungs_posten_behalten_column(conn: Connection):
    cols = _table_columns(conn, "rechnungs_posten")
    if "behalten" not in cols:
        conn.execute(text("ALTER TABLE rechnungs_posten ADD COLUMN behalten INTEGER NOT NULL DEFAULT 0"))


def prepare_schema(conn: Connection):
    """Create additive schema objects needed by the current app version."""
    _ensure_benutzer_table(conn)
    _seed_initial_benutzer(conn)
    _ensure_inventory_table(conn)
    _ensure_schueler_archiv_column(conn)
    _ensure_mail_versandt_column(conn)
    _ensure_additional_columns(conn)
    _merge_duplicate_bestand_buckets(conn)
    _migrate_nutzungsjahr_constraint(conn)
    _ensure_lernmaterial_menge_column(conn)
    _ensure_lernmaterial_tables(conn)
    _ensure_freiposten_tables(conn)
    _ensure_rechnung_verrechnung_table(conn)
    _seed_default_settings(conn)
    _seed_initial_admin_password(conn)
    _ensure_mail_template_defaults(conn)
    _seed_inventory_rows(conn)
    _create_or_update_views(conn)
    _ensure_performance_indexes(conn)
    _ensure_gutschrift_beschaedigt_column(conn)
    _ensure_bestand_schuljahr_eingestellt(conn)
    _ensure_archiviert_schuljahr_column(conn)
    _ensure_rechnungs_posten_behalten_column(conn)


def init_db():
    """
    Create all tables, indices, views, and default settings.

    Safe to call multiple times.
    """
    from app.models import Base  # noqa: avoid circular imports

    Base.metadata.create_all(bind=engine)

    with engine.begin() as conn:
        prepare_schema(conn)
