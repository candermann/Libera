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

## DB auf Server übertragen (lokal → Server, überschreibt Server-DB!)
```bash
# Server zuerst stoppen
ssh root@46.225.119.204 "cd /opt/libera && docker compose down"
# Alle drei DB-Dateien übertragen (WAL-Modus: immer alle drei zusammen!)
rsync -avz --delete /mnt/c/Users/keanu/dev/Bibliomat/backend/data/ root@46.225.119.204:/opt/libera/data/
# Code deployen + neu starten
rsync -avz --exclude='__pycache__' --exclude='.venv' --exclude='sonstiges/logs' --exclude='backend/data' /mnt/c/Users/keanu/dev/Bibliomat/ root@46.225.119.204:/opt/libera/
ssh root@46.225.119.204 "cd /opt/libera && docker compose up -d --build"
```

`.env` liegt auf dem Server unter `/opt/libera/.env` — wird nicht per rsync überschrieben.

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
- **Admin-Passwort**: `ADMIN_INITIAL_PASSWORD` aus `.env` wird nur beim ersten Start gesetzt (INSERT OR IGNORE). Im Admin-Panel geänderte Passwörter bleiben nach Neustart erhalten. Zurücksetzen: Eintrag `admin_password_hash` aus `einstellungen`-Tabelle löschen + neu starten.

---

## Env-Variablen (`backend/.env` lokal, `/opt/libera/.env` Server)
```
SECRET_KEY=...                    # mind. 32 Zeichen, nicht ändern nach erstem Start
CORS_ORIGINS=...                  # kommagetrennte Origins
DATABASE_URL=sqlite:///data/schulbuch.db
ADMIN_INITIAL_PASSWORD=...        # mind. 10 Zeichen, nur beim ersten Start gesetzt
EXTRA_USERS_PASSWORD=...          # für lehrer, schulleiter, sekretariat
```

---

## Nutzer & Passwörter
- `admin` — Passwort-Hash in `einstellungen.admin_password_hash`; initialer Wert aus `ADMIN_INITIAL_PASSWORD`
- Alle anderen Nutzer — Passwort-Hash in `benutzer`-Tabelle; verwaltbar im Admin-Panel (Profil → Konten)

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
| `api.js` | v18 |
| `ui.jsx` | v9 |
| `layout.jsx` | v15 |
| `home.jsx` | v18 |
| `verkauf.jsx` | v35 |
| `schueler-detail.jsx` | v33 |
| `screens.jsx` | v29 |
| `profil.jsx` | v5 |
| `lernmaterial.jsx` | v5 |
| `inventory-overrides.jsx` | v17 |
| `login.jsx` | v11 |
| `app.jsx` | v17 |
| `tweaks-panel.jsx` | v2 |
| `print.js` | v9 |

---

## Offene Punkte
- **Gutschrift-Auszahlung semantischer Bug**: `POST /api/gutschriften/{id}/auszahlen` setzt nur `ausgezahlt=True`, legt aber keinen `auszahlungen`-Datensatz an → Saldo wird nicht reduziert. Prüfen ob aktiv genutzt.
- **Durchlaufender Posten** — Bedeutung noch unklar (technisch als `RechnungVerrechnung` vorhanden)
- **Signatur erstellen** — unklar ob Bild-Upload oder Textblock gemeint
- **Windows Server Kunden** — Bibliomat läuft in Linux-Docker-Container, funktioniert auf Windows Server mit Docker + Hyper-V/WSL2

---

## Zuletzt geänderte Dateien (Stand 29.05.2026)
| Datei | Was |
|---|---|
| `backend/app/routers/admin.py` | NEU: Benutzerverwaltung (anlegen/löschen/Passwort), Backup-Download, Restore-Upload |
| `backend/app/db.py` | Migration behalten-Spalte; Admin-Passwort nur beim ersten Start (INSERT OR IGNORE) |
| `backend/app/models.py` | behalten-Feld in RechnungsPosten |
| `backend/app/schemas.py` | ArchivierungRequest.buecher_behalten, KontoSummary.anzahl_behalten_buecher |
| `backend/app/routers/schueler.py` | Archivierung mit Büchern: behalten=1 + bestand dekrementieren |
| `backend/app/routers/klassenversetzung.py` | behalten-Logik für Kl.-12-Abgänger; abgangs_stufe=12 Kommentar bereinigt |
| `backend/app/routers/buecher.py` | bestand_frei aus Bucket-Summe statt gesamt-ausgegeben |
| `backend/app/services/saldo.py` | count_aktive_buecher/get_aktive_buecher schließen behalten aus; count_behalten_buecher neu |
| `backend/app/services/pdf.py` | 0-EUR-Rückgabeposten nicht auf Seite 2; Gutschrift-Template ohne ID |
| `backend/app/templates/gutschrift.html` | Gutschrift-ID aus Header entfernt |
| `frontend/app.jsx` | document.title je Route |
| `frontend/verkauf.jsx` | Oberstufe: optionale Buchausgabe per Checkbox |
| `frontend/profil.jsx` | Tabs Konten (Admin: Benutzerverwaltung) + System (Backup/Restore) |
| `frontend/schueler-detail.jsx` | Archivierungs-Dialog: behalten-Hinweis; „X behalten" in Kontostand-Karte |
| `frontend/api.js` | admin.*-Methoden; archivieren mit buecherBehalten-Parameter |
| `frontend/index.html` | Versionsnummern aktuell (s.o.) |
