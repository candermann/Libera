# 02 · Datenmodell

SQL im SQLite-Dialekt. Sollte mit minimalen Anpassungen auch auf Postgres laufen.

## Tabellen-Übersicht

```
schueler         ─┬─< rechnungen ─< rechnungs_posten >─ buecher
                  └─< gutschriften ─< gutschrift_posten >─ rechnungs_posten
                  └─< zahlungen
buecher          (Stammdaten + Bestand)
einstellungen    (Schul-Stammdaten, aktuelles Schuljahr)
```

## DDL

```sql
-- Schüler
CREATE TABLE schueler (
  id            TEXT PRIMARY KEY,                     -- "S-0001"
  vorname       TEXT NOT NULL,
  nachname      TEXT NOT NULL,
  klasse        TEXT NOT NULL,                        -- "7a", "Q1", "EF"
  strasse       TEXT,
  plz           TEXT,
  ort           TEXT,
  email_eltern  TEXT,
  notizen       TEXT,
  angelegt_am   TEXT NOT NULL DEFAULT (datetime('now')),
  geloescht_am  TEXT                                  -- soft delete
);
CREATE INDEX idx_schueler_klasse ON schueler(klasse);
CREATE INDEX idx_schueler_name   ON schueler(nachname, vorname);

-- Bücher
CREATE TABLE buecher (
  id              TEXT PRIMARY KEY,                   -- "B-0001"
  titel           TEXT NOT NULL,
  untertitel      TEXT,
  isbn            TEXT,
  fach            TEXT NOT NULL,
  stufe           INTEGER NOT NULL,                   -- Klassenstufe 5..13
  verlag          TEXT,
  preis_cents     INTEGER NOT NULL,                   -- Geld in Cents speichern!
  gutschrift_cents INTEGER NOT NULL,                  -- aktuell = preis_cents
  bestand_gesamt  INTEGER NOT NULL DEFAULT 0,         -- physisch vorhanden
  bestand_ausgegeben INTEGER NOT NULL DEFAULT 0,      -- aktuell ausgeliehen
  angelegt_am     TEXT NOT NULL DEFAULT (datetime('now')),
  geloescht_am    TEXT
);
CREATE INDEX idx_buecher_fach  ON buecher(fach);
CREATE INDEX idx_buecher_stufe ON buecher(stufe);

-- Rechnungen (Verkaufsvorgänge)
CREATE TABLE rechnungen (
  id            TEXT PRIMARY KEY,                     -- "R-2025-1042"
  schueler_id   TEXT NOT NULL REFERENCES schueler(id),
  schuljahr     TEXT NOT NULL,                        -- "2025/2026"
  datum         TEXT NOT NULL,                        -- "2025-08-15"
  summe_cents   INTEGER NOT NULL,                     -- Bruttosumme aller Posten
  verrechnet_cents INTEGER NOT NULL DEFAULT 0,        -- ggf. Schulguthaben angerechnet
  status        TEXT NOT NULL DEFAULT 'offen',        -- offen | bezahlt | storniert
  storniert_am  TEXT,
  notizen       TEXT,
  erstellt_am   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_rechnungen_schueler ON rechnungen(schueler_id);
CREATE INDEX idx_rechnungen_status   ON rechnungen(status);

-- Posten einer Rechnung — referenzieren ein konkretes Buch
CREATE TABLE rechnungs_posten (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  rechnung_id     TEXT NOT NULL REFERENCES rechnungen(id),
  buch_id         TEXT NOT NULL REFERENCES buecher(id),
  preis_cents     INTEGER NOT NULL,                   -- Snapshot des Preises zum Verkaufszeitpunkt
  zurueckgegeben  INTEGER NOT NULL DEFAULT 0,         -- 0/1 — wurde dieser Posten bereits zurückgegeben?
  zurueckgegeben_am TEXT
);
CREATE INDEX idx_posten_rechnung ON rechnungs_posten(rechnung_id);
CREATE INDEX idx_posten_buch     ON rechnungs_posten(buch_id);

-- Gutschriften (Rückgabevorgänge)
CREATE TABLE gutschriften (
  id            TEXT PRIMARY KEY,                     -- "G-2026-0231"
  schueler_id   TEXT NOT NULL REFERENCES schueler(id),
  schuljahr     TEXT NOT NULL,
  datum         TEXT NOT NULL,
  summe_cents   INTEGER NOT NULL,
  ausgezahlt    INTEGER NOT NULL DEFAULT 0,           -- 0 = Schulguthaben, 1 = ausgezahlt
  ausgezahlt_am TEXT,
  notizen       TEXT,
  erstellt_am   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_gutschriften_schueler ON gutschriften(schueler_id);

-- Posten einer Gutschrift — verknüpft mit dem ursprünglichen Verkaufsposten
CREATE TABLE gutschrift_posten (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  gutschrift_id        TEXT NOT NULL REFERENCES gutschriften(id),
  rechnungs_posten_id  INTEGER NOT NULL REFERENCES rechnungs_posten(id),
  betrag_cents         INTEGER NOT NULL                -- Gutschriftbetrag = Snapshot
);
CREATE INDEX idx_gposten_gutschrift ON gutschrift_posten(gutschrift_id);

-- Zahlungseingänge (manuell erfasst nach Überweisung)
CREATE TABLE zahlungen (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  schueler_id   TEXT NOT NULL REFERENCES schueler(id),
  rechnung_id   TEXT REFERENCES rechnungen(id),       -- optional: gegen welche Rechnung gebucht
  datum         TEXT NOT NULL,
  betrag_cents  INTEGER NOT NULL,
  notizen       TEXT,
  erstellt_am   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_zahlungen_schueler ON zahlungen(schueler_id);

-- Schul-Stammdaten + globale Konfiguration (Key/Value)
CREATE TABLE einstellungen (
  schluessel TEXT PRIMARY KEY,
  wert       TEXT NOT NULL
);
-- Initiale Werte:
-- schule_name, schule_strasse, schule_plz, schule_ort, schule_telefon,
-- schule_iban, schule_bic, schule_bank, schuljahr_aktuell
```

## Saldo-Berechnung (View)

Saldo wird **nicht gespeichert** — immer aus den Vorgängen aggregiert. Das vermeidet Inkonsistenzen.

```sql
CREATE VIEW v_schueler_saldo AS
SELECT
  s.id AS schueler_id,
  COALESCE(SUM(CASE
    WHEN q.typ = 'rechnung'    THEN -q.betrag_cents
    WHEN q.typ = 'gutschrift'  THEN  q.betrag_cents
    WHEN q.typ = 'zahlung'     THEN  q.betrag_cents
    WHEN q.typ = 'verrechnung' THEN  q.betrag_cents
    ELSE 0
  END), 0) AS saldo_cents
FROM schueler s
LEFT JOIN (
  SELECT schueler_id, 'rechnung'   AS typ, summe_cents - verrechnet_cents AS betrag_cents
    FROM rechnungen WHERE status != 'storniert'
  UNION ALL
  SELECT schueler_id, 'gutschrift' AS typ, summe_cents AS betrag_cents
    FROM gutschriften
  UNION ALL
  SELECT schueler_id, 'zahlung'    AS typ, betrag_cents
    FROM zahlungen
) q ON q.schueler_id = s.id
GROUP BY s.id;
```

## Vorgangs-Historie (View)

```sql
CREATE VIEW v_schueler_vorgaenge AS
SELECT id, schueler_id, datum, 'rechnung'   AS typ, -summe_cents AS betrag_cents,
       'Schulbücher ' || schuljahr AS bezeichnung
  FROM rechnungen WHERE status != 'storniert'
UNION ALL
SELECT id, schueler_id, datum, 'gutschrift' AS typ,  summe_cents AS betrag_cents,
       'Buchrückgabe' AS bezeichnung
  FROM gutschriften
UNION ALL
SELECT CAST(id AS TEXT), schueler_id, datum, 'zahlung' AS typ,  betrag_cents,
       'Zahlungseingang' AS bezeichnung
  FROM zahlungen;
-- ORDER BY datum  (clientseitig sortieren)
```

## Geld in Cents

**Wichtig**: alle Geldbeträge als Integer-Cents speichern (`preis_cents`, `summe_cents`). Niemals `FLOAT`/`REAL` für Geld — Rundungsfehler. Im API-Layer dann nach `EUR` umrechnen (`/100`, dt. Komma-Format).

## ID-Generierung

- `S-NNNN` und `B-NNNN`: laufender Zähler, 4-stellig zero-padded.
- `R-YYYY-NNNN` und `G-YYYY-NNNN`: pro Schuljahr-Beginn-Jahr fortlaufend.

Implementierung über kleine Helper-Tabelle oder einfach `MAX(...)+1` in Transaktion.
