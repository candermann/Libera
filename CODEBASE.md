# Codebase-Übersicht — Bibliomat

Schulbuch-Verwaltungssystem: FastAPI-Backend + React-Frontend (Electron-ähnlich, kein Node-Build-Step).

---

## Projektstruktur

```
Bibliomat/
├── backend/
│   ├── app/
│   │   ├── main.py               — FastAPI-App, CORS, Router-Registrierung
│   │   ├── db.py                 — SQLite-Setup, Migrations-Logik, Seed-Funktionen
│   │   ├── models.py             — SQLAlchemy-Modelle
│   │   ├── schemas.py            — Pydantic-Schemas
│   │   ├── security.py           — JWT, Passwort-Hashing (bcrypt), SECRET_KEY
│   │   ├── routers/
│   │   │   ├── schueler.py       — Schüler CRUD, CSV-Import, Archiv
│   │   │   ├── verkauf.py        — Rechnungserstellung, Preisberechnung
│   │   │   ├── gutschrift.py     — Bücherrückgabe, Gutschriften
│   │   │   ├── buecher.py        — Buchkatalog CRUD
│   │   │   ├── buchhaltung.py    — Rechnungsübersicht nach Schuljahr
│   │   │   ├── klassenversetzung.py — Klassenaufstieg, Archivierung
│   │   │   ├── benachrichtigungen.py — System-Warnungen, Jahreserinnerung
│   │   │   ├── einstellungen.py  — Schuldaten, SMTP, Schuljahr
│   │   │   ├── auth.py           — Login (JWT), admin + benutzer-Tabelle
│   │   │   ├── lernmaterial.py   — Lernmaterial-Bestand
│   │   │   └── freiposten.py     — Manuelle Posten, Vorlagen
│   │   ├── services/
│   │   │   ├── pdf.py            — WeasyPrint: Rechnung→PDF/HTML
│   │   │   ├── zustand.py        — Preisberechnung, NJ-Abschläge, Schuljahr-Helfer
│   │   │   ├── ids.py            — ID-Generierung (S-0001, R-2025-0001, G-2025-0001)
│   │   │   └── mail.py           — SMTP-Versand
│   │   └── templates/
│   │       └── rechnung.html     — Jinja2-Template für Rechnungs-PDF
│   ├── data/
│   │   └── schulbuch.db          — SQLite-Datenbank (nicht im Repo)
│   ├── tests/
│   ├── pyproject.toml
│   └── .env                      — Umgebungsvariablen (nicht im Repo)
└── frontend/
    ├── api.js                    — Aktive API-Datei die der Browser lädt (wird von FastAPI als Static File served)
    ├── api.ts                    — TypeScript-Quelle (NICHT vom Browser geladen — Änderungen immer in api.js vornehmen!)
    ├── index.html                — Einstiegspunkt, lädt alle .jsx via Babel Standalone + Versionsnummern (?v=N)
    ├── app.jsx                   — Root-Komponente, Router (hash-basiert), Nav-Handler
    ├── screens.jsx               — Haupt-Screens: SchuelerListe, Buchhaltung, KlassenlisteTab, Archiv, Klassenversetzung …
    ├── home.jsx                  — Dashboard, GlockePanel, Benachrichtigungen
    ├── verkauf.jsx               — 3-Schritte-Verkaufsflow (Schüler → Bücher → Rechnung)
    ├── profil.jsx                — Einstellungen: Schuldaten, Schuljahr, SMTP, Passwörter
    └── schueler-detail.jsx       — Schüler-Detailansicht, Vorgänge, Kontosaldo
```

---

## Datenbank (SQLite)

| Tabelle | Beschreibung |
|---|---|
| `schueler` | Schüler (id: S-0001, soft-delete, archiviert_am) |
| `buecher` | Buchkatalog (preis_cents, schutzgebuehr_cents) |
| `buch_zustand_bestand` | Inventar-Buckets pro Buch × Nutzungsjahr |
| `rechnungen` | Rechnungen (id: R-YYYY-NNNN, status: offen/storniert) |
| `rechnungs_posten` | Positionen einer Rechnung, zurueckgegeben-Flag |
| `rechnung_freiposten` | Manuelle Posten auf Rechnungen |
| `rechnung_verrechnung` | Gutschrift-Verrechnung gegen Rechnungen |
| `gutschriften` | Gutschriftdokumente (id: G-YYYY-NNNN) |
| `gutschrift_posten` | Positionen einer Gutschrift mit Abschreibung |
| `lernmaterial` | Lernmaterial-Bestand |
| `freiposten_vorlagen` | Gespeicherte Freiposten-Vorlagen |
| `benutzer` | Nutzer: lehrer, schulleiter, sekretariat |
| `einstellungen` | Key-Value-Store: Schuljahr, Schuldaten, SMTP, admin_password_hash |

Views: `v_schueler_saldo` (aggregierter Kontostand je Schüler)

---

## Authentifizierung

- JWT-Token (HS256), `SECRET_KEY` aus Env (mind. 32 Zeichen)
- Nutzer `admin`: Passwort-Hash in `einstellungen.admin_password_hash`
- Nutzer `lehrer`, `schulleiter`, `sekretariat`: Passwort-Hash in `benutzer`-Tabelle
- Token-Lebensdauer: 8 Stunden

---

## Preisberechnung (`services/zustand.py`)

- **NJ=0** (Neu): Buchpreis = `basispreis_cents`, kein Aufschlag
- **NJ=1–5**: `basispreis * (100 - abschlag) / 100`, Abschläge konfigurierbar in Einstellungen
- **NJ≥6**: nur `schutzgebuehr_cents`
- **Rückgabe-Aufschlag** (`rueckgabe_aufschlag_prozent`): wird nur bei NJ>0 UND wenn Preis < Basispreis aufgeschlagen (in `routers/verkauf.py`)
- **Effektives NJ** (`effective_nutzungsjahr`): NJ altert automatisch um 1 pro Schuljahr; NJ=0 altert nie

---

## Klassen / Oberstufe

- Standard-Klassen: `5, 6, 7, 8, 9, 10, 11, 12` — definiert in `frontend/api.js: CONSTANTS.KLASSEN`
- Abgangsstufe: Klasse 12 — nach Klassenversetzung aus 12 werden Schüler archiviert (`routers/klassenversetzung.py: abgangs_stufe = 12`)
- Oberstufe (11, 12): im Verkauf-Flow keine Buchauswahl — nur Lernmaterial und Freiposten (`verkauf.jsx`)
- Unbekannte Klassenformate (EF, Q1, Q2): werden unverändert durchgereicht

---

## PDF-Generierung

- Template: `backend/app/templates/rechnung.html` (Jinja2)
- Renderer: WeasyPrint (`services/pdf.py`)
- Seitenaufbau: Seite 1 = Ausgabe + Summen + Unterschrift; Seite 2 (falls Rückgaben) = Zurückgegebene Bücher
- Rechnungsnummer erscheint **nicht** im PDF

---

## Benachrichtigungen (`GET /api/benachrichtigungen`)

| Typ | Auslöser |
|---|---|
| `archiv_abgelaufen` | Archivierte Schüler mit abgelaufener 10-Jahres-Aufbewahrungsfrist |
| `schuljahr_wechsel` | Eingestelltes Schuljahr passt nicht zum kalendarischen Schuljahr |

---

## Frontend — wichtige Fallstricke

- **`api.js` ≠ `api.ts`**: Der Browser lädt `api.js`. TypeScript-Änderungen in `api.ts` haben keine Wirkung — immer `api.js` editieren.
- **Versionsnummern in `index.html`**: Jede `.jsx`/`.js`-Datei wird mit `?v=N` geladen. Nach Änderungen die Nummer erhöhen damit der Browser nicht cached.
- **Routen** (`app.jsx`): Hash-basiertes Routing (`#home`, `#schueler`, etc.). Verfügbare Routen: `home`, `verkauf`, `rueckgabe`, `kombiniert`, `schueler`, `buecher`, `lernmaterial`, `buchhaltung`, `klassenversetzung`, `archiv`, `profil`. Einstellungen = `profil` (nicht `einstellungen`).
- **Kein Build-Step**: Babel Standalone transpiliert JSX direkt im Browser. Kein Webpack, kein Vite.

---

## Start

```powershell
cd backend
uv sync
uv run --env-file .env uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Env-Variablen: `SECRET_KEY` (Pflicht, ≥32 Zeichen), `CORS_ORIGINS` (Pflicht), `DATABASE_URL`, `ADMIN_INITIAL_PASSWORD` (≥10 Zeichen, wird bei jedem Start gesetzt), `EXTRA_USERS_PASSWORD`.
