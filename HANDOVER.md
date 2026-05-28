# Handover — Bibliomat

## Projekt
Schulbuch-Verwaltungssystem für ein Gymnasium. FastAPI-Backend + React-Frontend (kein Build-Step, Babel Standalone). SQLite-Datenbank.

**Repo**: https://github.com/candermann/Libera.git  
**Server**: root@46.225.119.204 — `/opt/libera/`  
**Lokales Projekt**: `C:\Users\keanu\dev\Bibliomat\`

---

## Stack
- **Backend**: Python 3.12, FastAPI, SQLAlchemy, SQLite, WeasyPrint (PDF), uv
- **Frontend**: React 18 (CDN), Babel Standalone, kein Bundler
- **Server**: Docker + Caddy (Reverse Proxy + HTTPS)
- **Domain**: https://46.225.119.204.sslip.io

---

## Starten (lokal)
```powershell
cd backend
uv sync
uv run --env-file .env uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

## Deploy auf Server
```bash
# Von WSL
rsync -avz --exclude='__pycache__' --exclude='.venv' --exclude='sonstiges/logs' /mnt/c/Users/keanu/dev/Bibliomat/ root@46.225.119.204:/opt/libera/

# Auf Server
cd /opt/libera
docker compose down
docker compose up -d --build
```

`.env` liegt auf dem Server unter `/opt/libera/.env` — wird nicht per rsync überschrieben.

---

## Wichtige Fallstricke

- **`api.js` ≠ `api.ts`**: Browser lädt `api.js`. Änderungen immer in `api.js` vornehmen, nicht `api.ts`.
- **Versionsnummern `index.html`**: Jede `.jsx`/`.js` hat `?v=N` — nach Änderungen erhöhen.
- **Route für Einstellungen heißt `profil`**, nicht `einstellungen`.
- **Kein Build-Step**: Babel transpiliert JSX direkt im Browser.
- **3 DBs auf dem Server** — aktive ist `/opt/libera/data/schulbuch.db` (Docker Volume).

---

## Env-Variablen (`backend/.env` lokal, `/opt/libera/.env` Server)
```
SECRET_KEY=...                    # mind. 32 Zeichen, nicht ändern nach erstem Start
CORS_ORIGINS=...                  # kommagetrennte Origins
DATABASE_URL=sqlite:///data/schulbuch.db
ADMIN_INITIAL_PASSWORD=...        # mind. 10 Zeichen, wird bei jedem Start gesetzt
EXTRA_USERS_PASSWORD=...          # für lehrer, schulleiter, sekretariat
```

---

## Nutzer
- `admin` — Passwort aus `ADMIN_INITIAL_PASSWORD`
- `lehrer`, `schulleiter`, `sekretariat` — Passwort aus `EXTRA_USERS_PASSWORD`

---

## Frontend-Routen (app.jsx)
`home`, `verkauf`, `rueckgabe`, `kombiniert`, `schueler`, `buecher`, `lernmaterial`, `buchhaltung`, `klassenversetzung`, `archiv`, `profil`

---

## Offene Punkte / In Arbeit
- **Klassenliste auf Server zeigt keine Daten** — unklar ob Tab leer oder Tab fehlt, noch nicht debuggt
- **Durchlaufender Posten** — Nutzer hat nachgefragt, Bedeutung noch unklar (technisch als `RechnungVerrechnung` vorhanden)
- **Signatur erstellen** — Nutzer hat nachgefragt, ob Bild-Upload oder nur Textblock gemeint

---

## Zuletzt geänderte Dateien
| Datei | Was |
|---|---|
| `frontend/api.js` | `alleRechnungen`, Klassen 11+12 |
| `frontend/screens.jsx` | KlassenlisteTab, Archiv-Suche, Sortierung |
| `frontend/home.jsx` | Glocke gelb+pulsierend, Schuljahres-Erinnerung |
| `frontend/verkauf.jsx` | Oberstufe-Banner |
| `frontend/index.html` | Versionsnummern aktuell: api v17, home v18, screens v26, verkauf v33 |
| `backend/app/routers/benachrichtigungen.py` | Schuljahres-Erinnerung |
| `backend/app/routers/verkauf.py` | NJ=0 Fix |
| `backend/app/routers/buchhaltung.py` | schuljahr optional |
| `backend/app/routers/klassenversetzung.py` | abgangs_stufe=12 |
| `backend/app/templates/rechnung.html` | Rückgaben Seite 2, keine Rechnungsnummer |
| `docker-compose.yml` | neu im Root (war in sonstiges/) |
| `Caddyfile` | neu im Root, bibliomat statt libera |

---

## Datenbankpfade
- Lokal: `backend/data/schulbuch.db`
- Server aktiv: `/opt/libera/data/schulbuch.db` (Docker Volume)
- Server alt (ignorieren): `/opt/libera/backend/data/schulbuch.db`, `/opt/libera/backend/schulbuch.db`
