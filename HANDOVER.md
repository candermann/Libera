# Handover — Bibliomat

## Projekt
Schulbuch-Verwaltungssystem für ein Gymnasium. FastAPI-Backend + React-Frontend (kein Build-Step, Babel Standalone). SQLite-Datenbank.

**Repo**: https://github.com/candermann/Libera.git  
**Branch**: `dev` (Haupt-Arbeitsbranch)  
**Server**: root@46.225.119.204 — `/opt/libera/`  
**Lokales Projekt**: `C:\Users\keanu\dev\Bibliomat\`  
**Domain**: https://46.225.119.204.sslip.io

---

## Stack
- **Backend**: Python 3.12, FastAPI, SQLAlchemy, SQLite, WeasyPrint (PDF), uv
- **Frontend**: React 18 (CDN), Babel Standalone, kein Bundler
- **Server**: Docker + Caddy (Reverse Proxy + HTTPS)

---

## Starten (lokal)
```powershell
cd backend
uv sync
uv run --env-file .env uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

## Deploy auf Server
```bash
# Von WSL — backend/data ausschließen damit DB auf Server nicht überschrieben wird
rsync -avz --exclude='__pycache__' --exclude='.venv' --exclude='sonstiges/logs' --exclude='backend/data' /mnt/c/Users/keanu/dev/Bibliomat/ root@46.225.119.204:/opt/libera/

# Auf Server — immer --build, da Frontend-Dateien ins Image kopiert werden
cd /opt/libera
docker compose down
docker compose up -d --build
```

`.env` liegt auf dem Server unter `/opt/libera/.env` — wird nicht per rsync überschrieben (kein `backend/data` im rsync).

---

## Git-Workflow
- Lokaler Branch `master` trackt `origin/dev`
- Push: `git push origin master:dev`
- Pull von dev: `git pull origin dev`
- PowerShell unterstützt kein `&&` — Befehle einzeln oder mit `;` verketten

---

## Wichtige Fallstricke

- **`api.js` ≠ `api.ts`**: Browser lädt `api.js`. Änderungen immer in `api.js` vornehmen, nicht `api.ts`.
- **Versionsnummern `index.html`**: Jede `.jsx`/`.js` hat `?v=N` — nach Änderungen erhöhen, sonst Browser-Cache.
- **Immer `--build` beim Deploy**: Frontend-Dateien werden in den Docker-Container kopiert, `restart` allein reicht nicht.
- **Route für Einstellungen heißt `profil`**, nicht `einstellungen`.
- **Kein Build-Step**: Babel transpiliert JSX direkt im Browser.
- **SQLite WAL-Modus**: Beim Kopieren der DB immer alle drei Dateien (`schulbuch.db`, `schulbuch.db-wal`, `schulbuch.db-shm`) zusammen übertragen, sonst fehlen neuere Einträge.
- **Namen**: Überall „Nachname, Vorname" — Avatar-Komponenten sind bewusst Ausnahme (brauchen „Vorname Nachname" für Initialen).
- **Sensitive Settings**: `mail_smtp_password`, `admin_password_hash` etc. werden von der Einstellungs-API nicht zurückgegeben — nur `mail_smtp_password_set: true/false`.

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

Navigation: Klick auf Nav-Reiter mountet Komponente immer neu (Reset auf Hauptansicht) — via `navKey` in `app.jsx`.

---

## Datenbankpfade
- Lokal: `backend/data/schulbuch.db`
- Server aktiv: `/opt/libera/data/schulbuch.db` (Docker Volume via `${BIBLIOMAT_DATA_DIR:-./data}`)
- Server alt (ignorieren): `/opt/libera/backend/data/schulbuch.db`, `/opt/libera/backend/schulbuch.db`

---

## Aktuelle Versionsnummern (`frontend/index.html`)
| Datei | Version |
|---|---|
| `api.js` | v17 |
| `ui.jsx` | v9 |
| `layout.jsx` | v15 |
| `home.jsx` | v18 |
| `verkauf.jsx` | v34 |
| `schueler-detail.jsx` | v29 |
| `screens.jsx` | v28 |
| `inventory-overrides.jsx` | v17 |
| `app.jsx` | v16 |

---

## Offene Punkte
- **Durchlaufender Posten** — Bedeutung noch unklar (technisch als `RechnungVerrechnung` vorhanden)
- **Signatur erstellen** — unklar ob Bild-Upload oder Textblock gemeint
- **Windows Server Kunden** — Bibliomat läuft in Linux-Docker-Container, funktioniert auf Windows Server mit Docker + Hyper-V/WSL2

---

## Zuletzt geänderte Dateien (Stand 28.05.2026)
| Datei | Was |
|---|---|
| `frontend/app.jsx` | `navKey` — Nav-Reiter resettet auf Hauptansicht |
| `frontend/screens.jsx` | KlassenlisteTab, Archiv-Suche, Sortierung, Namen, Badge-Fix |
| `frontend/verkauf.jsx` | Oberstufe-Banner, Namen |
| `frontend/schueler-detail.jsx` | Namen |
| `frontend/inventory-overrides.jsx` | Namen |
| `frontend/ui.jsx` | Badge: style-Prop, fit-content |
| `frontend/profil.jsx` | SMTP-Passwort: Placeholder wenn gesetzt |
| `frontend/home.jsx` | Glocke gelb+pulsierend, Schuljahres-Erinnerung |
| `frontend/api.js` | `alleRechnungen`, Klassen 11+12 |
| `frontend/index.html` | Versionsnummern aktuell (s.o.) |
| `backend/app/routers/buchhaltung.py` | Namen, schuljahr optional |
| `backend/app/routers/dashboard.py` | Namen |
| `backend/app/routers/mahnungen.py` | Namen |
| `backend/app/routers/benachrichtigungen.py` | Namen, Schuljahres-Erinnerung |
| `backend/app/routers/verkauf.py` | Namen, NJ=0 Fix |
| `backend/app/routers/einstellungen.py` | Sensitive Keys werden nicht zurückgegeben |
| `backend/app/routers/klassenversetzung.py` | abgangs_stufe=12 |
| `backend/app/services/mail.py` | Namen |
| `backend/app/templates/rechnung.html` | Namen, Rückgaben Seite 2, keine Rechnungsnummer |
| `backend/app/templates/mahnung.html` | Namen |
| `backend/app/templates/auszahlung.html` | Namen |
| `backend/app/templates/gutschrift.html` | Namen |
| `docker-compose.yml` | im Root, `BIBLIOMAT_DATA_DIR` Variable |
| `Caddyfile` | im Root, bibliomat statt libera |
| `.gitignore` | neu — schließt `__pycache__`, `.venv`, `*.db`, `.env` aus |
