# Bibliomat

> Schulbuch-Verwaltung für Verkauf, Rückgabe, Gutschriften, Rechnungen, PDF-Erzeugung und E-Mail-Versand.

![Python](https://img.shields.io/badge/Python-3.12-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-Backend-009688)
![SQLite](https://img.shields.io/badge/Database-SQLite-lightgrey)
![Docker](https://img.shields.io/badge/Deployment-Docker-2496ED)
![Status](https://img.shields.io/badge/Status-Internal%20App-orange)

---

## Live-System

### [Bibliomat öffnen](https://46.225.119.204.sslip.io)

```text
https://46.225.119.204.sslip.io
```

Die Anwendung läuft aktuell auf einem Server unter dieser Adresse. Der Zugriff erfolgt per HTTPS über Caddy als Reverse Proxy.

---

## Überblick

**Bibliomat** ist eine interne Webanwendung für das Schulbuch-Büro der Schule Panketal.

Die Anwendung unterstützt den vollständigen Verwaltungsprozess rund um Schulbücher:

- Schüler verwalten, importieren, archivieren und reaktivieren
- Klassen verwalten und zum Schuljahreswechsel versetzen
- Bücher und Lernmaterial verwalten
- Bestände nach Nutzungsjahr führen
- Bücher verkaufen und zurücknehmen
- Rechnungen, Gutschriften und Auszahlungsbelege erzeugen
- PDFs und HTML-Vorschauen generieren
- Rechnungen per SMTP-E-Mail versenden
- Schüler-Salden und Vorgangsverläufe verfolgen
- Zahlungen und Auszahlungen erfassen
- Buchhaltungsübersichten nach Schuljahr erstellen

Die App ist bewusst einfach gehalten:

| Eigenschaft | Beschreibung |
|---|---|
| Benutzerkonzept | Einzelner Admin-Login |
| Frontend | JSX direkt im Browser, kein Build-Schritt |
| Backend | FastAPI |
| Datenbank | SQLite mit WAL-Modus |
| Deployment | Docker oder Docker Compose mit Caddy |
| Zielgruppe | Schulbuch-Büro / interne Verwaltung |

---

## Inhaltsverzeichnis

- [Features](#features)
- [Tech-Stack](#tech-stack)
- [Architektur](#architektur)
- [Projektstruktur](#projektstruktur)
- [Lokale Entwicklung](#lokale-entwicklung)
- [Umgebungsvariablen](#umgebungsvariablen)
- [Datenmodell](#datenmodell)
- [Preislogik](#preislogik)
- [API](#api)
- [Authentifizierung](#authentifizierung)
- [Tests](#tests)
- [Deployment](#deployment)
- [Aktuelles Hosting](#aktuelles-hosting)
- [Backup und Betrieb](#backup-und-betrieb)
- [Bekannte Einschränkungen](#bekannte-einschränkungen)
- [Changelog](#changelog)

---

## Features

### Schülerverwaltung

- Schüler anlegen, bearbeiten und löschen
- CSV-Import mit Vorschau und Fehlerliste
- Klassenübersicht und Klassenversetzung
- Archivierung von Abgangsschülern
- Reaktivierung archivierter Schüler
- Saldo je Schüler
- Vorgangsverlauf je Schüler
- Anzeige aktiver, noch nicht zurückgegebener Bücher

### Bücherverwaltung

- Bücherkatalog mit ISBN, Fach, Klasse, Basispreis und Schutzgebühr
- Fächerübersicht
- Bestand nach Nutzungsjahr
- automatische Preisberechnung je Nutzungsjahr
- Rückgabe und Wiederverkauf
- Soft-Delete für nicht mehr genutzte Bücher

### Lernmaterial und Freiposten

- Lernmaterial mit Kategorie, Preis und Bestand
- Lernmaterial-Positionen auf Rechnungen
- Freie Rechnungspositionen
- wiederverwendbare Freiposten-Vorlagen

### Rechnungen, Gutschriften und Auszahlungen

- Verkauf mehrerer Bücher pro Schüler
- Rückgaben im Verkaufsworkflow
- automatische Verrechnung vorhandener Guthaben
- Rechnungserstellung mit fortlaufender Rechnungsnummer
- Gutschrifterstellung bei Rückgabe
- Auszahlungsbelege für Schüler-Guthaben
- Storno von Rechnungen
- PDF- und HTML-Ausgabe

### Kommunikation

- SMTP-basierter Rechnungsversand
- konfigurierbare Absender-, Betreff- und Textvorlagen
- Versandstatus pro Rechnung
- Dashboard für unversandte Rechnungen
- Mail-Vorschau vor dem Versand

### Buchhaltung

- Rechnungsübersicht nach Schuljahr
- Listen für unversandte und versandte Rechnungen
- Zahlungseingänge erfassen
- Auszahlungen erfassen
- schülerbezogene Salden

---

## Tech-Stack

| Bereich | Technologie |
|---|---|
| Backend | Python 3.12, FastAPI |
| ORM | SQLAlchemy 2.x |
| Datenbank | SQLite mit WAL-Modus und Foreign Keys |
| Authentifizierung | JWT HS256, bcrypt |
| Frontend | JSX mit Babel Standalone |
| PDF-Erzeugung | WeasyPrint |
| Templates | Jinja2 |
| E-Mail | SMTP |
| Dependency Management | uv |
| Frontend-Typecheck | TypeScript mit `allowJs` |
| Tests | pytest, httpx |
| Deployment | Docker, Docker Compose, Caddy |

**Wichtig:** Das Frontend hat keinen Node-/Webpack-/Vite-Build. Die JSX-Dateien liegen in `frontend/` und werden direkt vom Browser über Babel Standalone kompiliert.

---

## Architektur

```text
Browser
  |
  | HTTP
  v
FastAPI Backend
  |
  | SQLAlchemy
  v
SQLite Datenbank
```

Im Produktivbetrieb kann Caddy davor geschaltet werden:

```text
Internet
  |
  | HTTPS
  v
Caddy Reverse Proxy
  |
  | HTTP intern
  v
Bibliomat FastAPI Container
  |
  v
/app/data/schulbuch.db
```

---

## Projektstruktur

```text
Gymnasium Panketal/Bibliomat/
├── Dokumentation.html
├── docker-compose.yml
├── Caddyfile
├── schueler_2026_2027.csv
├── frontend/
│   ├── index.html
│   ├── app.jsx              # Routing, globaler Zustand
│   ├── api.jsx              # API-Client
│   ├── login.jsx
│   ├── home.jsx             # Dashboard
│   ├── schueler-detail.jsx
│   ├── verkauf.jsx
│   ├── lernmaterial.jsx
│   ├── profil.jsx
│   ├── print.jsx
│   └── logo.png
├── backend/
│   ├── Dockerfile
│   ├── pyproject.toml
│   ├── uv.lock
│   ├── reset_bestand.py
│   ├── reset_schueler.py
│   ├── app/
│   │   ├── main.py          # FastAPI-App, CORS, Router, Static-Files
│   │   ├── db.py            # Engine, Sessions, Schema-Vorbereitung
│   │   ├── models.py        # SQLAlchemy-Modelle
│   │   ├── schemas.py       # Pydantic-Schemas
│   │   ├── security.py      # JWT, bcrypt, Auth-Dependency
│   │   ├── seed.py          # Start-/Beispieldaten
│   │   ├── routers/
│   │   ├── services/
│   │   └── templates/       # PDF-/HTML-Templates
│   └── tests/
└── Sonstiges/
    ├── docs/                # ältere Spezifikationen
    ├── migrations/          # alte Hilfsmigrationen
    ├── debug-scripts/
    └── test-data/
```

---

## Lokale Entwicklung

### Voraussetzungen

- Python 3.12+
- `uv`

### Starten

```bash
cd "Gymnasium Panketal/Bibliomat/backend"

uv sync

export SECRET_KEY="min-32-zeichen-langer-geheimschluessel"
export CORS_ORIGINS="http://localhost:8000"
export ADMIN_INITIAL_PASSWORD="adminpasswort"

uv run uvicorn app.main:app --reload --port 8000
```

Danach ist die App erreichbar unter:

```text
http://localhost:8000
```

Swagger/OpenAPI:

```text
http://localhost:8000/docs
```

Health-Check:

```text
http://localhost:8000/api/health
```

### TypeScript-Typecheck

Das Frontend unterstützt TypeScript schrittweise. Bestehende `.jsx`-Dateien laufen weiter im Browser, neue kritische Dateien können als `.ts`/`.tsx` ergänzt werden.

```bash
npm install
npm run typecheck
npm run build:frontend
```

Aktuell sind `frontend/api.ts` und `frontend/print.ts` migriert. Sie werden zu `frontend/api.js` und `frontend/print.js` kompiliert und von `index.html` direkt geladen.

### Windows PowerShell

```powershell
cd "Gymnasium Panketal/Bibliomat/backend"

uv sync

$env:SECRET_KEY="min-32-zeichen-langer-geheimschluessel"
$env:CORS_ORIGINS="http://localhost:8000"
$env:ADMIN_INITIAL_PASSWORD="adminpasswort"

uv run uvicorn app.main:app --reload --port 8000
```

---

## Umgebungsvariablen

| Variable | Pflicht | Beschreibung |
|---|---:|---|
| `SECRET_KEY` | Ja | JWT-Signing-Key, mindestens 32 Zeichen. Beispiel: `openssl rand -hex 32` |
| `CORS_ORIGINS` | Ja | Kommagetrennte Liste erlaubter Origins. `*` ist nicht erlaubt. |
| `ADMIN_INITIAL_PASSWORD` | Nein | Startpasswort für `admin`, wird nur beim ersten Initialisieren genutzt. Standard ist `admin`. |
| `DATABASE_URL` | Nein | SQLAlchemy-URL. Lokal Standard: `sqlite:///schulbuch.db`. Docker Standard: `sqlite:////app/data/schulbuch.db`. |
| `PORT` | Nein | Port im Docker-Container. Standard: `8000`. |

Beispiel `.env` für Docker Compose:

```env
SECRET_KEY=hier-einen-zufaelligen-key-mit-mindestens-32-zeichen
CORS_ORIGINS=https://46.225.119.204.sslip.io,http://localhost:8000
ADMIN_INITIAL_PASSWORD=BitteAendern
```

---

## Datenmodell

Alle Geldbeträge werden als **Integer in Cent** gespeichert. Dadurch gibt es keine Rundungsfehler durch Gleitkommazahlen.

| Tabelle/View | Zweck |
|---|---|
| `schueler` | Schülerstammdaten, Archivierung und Soft-Delete |
| `buecher` | Bücherkatalog |
| `buch_zustand_bestand` | Bestand je Buch und Nutzungsjahr |
| `lernmaterial` | zusätzliche Materialien |
| `lernmaterial_posten` | Lernmaterial auf Rechnungen |
| `rechnungen` | Rechnungskopf |
| `rechnungs_posten` | Buchpositionen einer Rechnung |
| `rechnung_freiposten` | freie Positionen einer Rechnung |
| `freiposten_vorlagen` | Vorlagen für freie Positionen |
| `gutschriften` | Gutschriftkopf |
| `gutschrift_posten` | Rückgabe-/Gutschriftpositionen |
| `rechnung_verrechnungen` | Verrechnung von Guthaben mit Rechnungen |
| `zahlungen` | Zahlungseingänge |
| `auszahlungen` | Auszahlungen von Guthaben |
| `einstellungen` | Key-Value-Store für Schul-, Mail- und Preis-Einstellungen |
| `v_schueler_saldo` | berechneter Saldo je Schüler |
| `v_schueler_vorgaenge` | chronologische Vorgänge je Schüler |

### ID-Formate

| Typ | Format | Beispiel |
|---|---|---|
| Schüler | `S-NNNN` | `S-0042` |
| Buch | `B-NNNN` | `B-0007` |
| Lernmaterial | `M-NNNN` | `M-0003` |
| Rechnung | `R-JJJJ-NNNN` | `R-2026-0001` |
| Gutschrift | `G-JJJJ-NNNN` | `G-2026-0001` |

---

## Preislogik

### Nutzungsjahr

| Wert | Bedeutung |
|---:|---|
| `0` | Neu |
| `1` bis `5` | Gebraucht, je nach Nutzungsdauer mit Abschlag |
| `6` | Nur noch Schutzgebühr bzw. vollständig abgeschrieben |

Das Nutzungsjahr steigt anhand des Schuljahres. Stichtag für die Logik ist der 1. August.

### Standard-Abschläge

| Nutzungsjahr | Abschlag |
|---:|---:|
| 1 | 0 % |
| 2 | 10 % |
| 3 | 20 % |
| 4 | 30 % |
| 5 | 40 % |
| 6+ | 100 % |

Die Abschläge sind in den Einstellungen konfigurierbar.

### Rückgabe und Wiederverkauf

- Beim Verkauf wird der Preis aus Basispreis, Nutzungsjahr und Einstellungen berechnet.
- Bei Rückgabe entsteht eine Gutschrift.
- Vorhandenes Guthaben kann mit einer neuen Rechnung verrechnet werden.
- Ein konfigurierbarer Rückgabe-Aufschlag kann beim Wiederverkauf addiert werden.

---

## API

Alle Endpunkte außer `/api/auth/login` und `/api/health` benötigen einen gültigen JWT-Bearer-Token.

| Methode | Pfad | Beschreibung |
|---|---|---|
| `POST` | `/api/auth/login` | Login als `admin` |
| `GET` | `/api/health` | Health-Check |
| `GET`/`POST` | `/api/schueler` | Schüler auflisten / anlegen |
| `GET`/`PATCH`/`DELETE` | `/api/schueler/{id}` | Schüler lesen / bearbeiten / löschen |
| `GET` | `/api/schueler/{id}/vorgaenge` | Vorgangsverlauf |
| `GET` | `/api/schueler/{id}/aktive-buecher` | aktive Bücher |
| `POST` | `/api/schueler/import/csv/preview` | CSV-Import prüfen |
| `POST` | `/api/schueler/import/csv` | CSV-Import ausführen |
| `GET`/`POST` | `/api/buecher` | Bücher auflisten / anlegen |
| `GET`/`PATCH`/`DELETE` | `/api/buecher/{id}` | Buch lesen / bearbeiten / löschen |
| `GET`/`POST` | `/api/lernmaterial` | Lernmaterial auflisten / anlegen |
| `GET`/`PATCH`/`DELETE` | `/api/lernmaterial/{id}` | Lernmaterial lesen / bearbeiten / löschen |
| `GET`/`POST` | `/api/freiposten/vorlagen` | Freiposten-Vorlagen verwalten |
| `POST` | `/api/verkauf` | Rechnung erstellen |
| `GET` | `/api/rechnungen` | Rechnungen auflisten |
| `GET` | `/api/rechnungen/{id}` | Rechnung abrufen |
| `POST` | `/api/rechnungen/{id}/storno` | Rechnung stornieren |
| `GET` | `/api/rechnungen/{id}/pdf` | Rechnung als PDF |
| `GET` | `/api/rechnungen/{id}/html` | Rechnung als HTML |
| `GET` | `/api/rechnungen/{id}/mail-vorlage` | E-Mail-Vorlage laden |
| `POST` | `/api/rechnungen/{id}/mail-vorschau` | E-Mail-Vorschau |
| `POST` | `/api/rechnungen/{id}/mail` | Rechnung per E-Mail senden |
| `POST` | `/api/gutschrift` | Gutschrift erstellen |
| `GET` | `/api/gutschriften/{id}` | Gutschrift abrufen |
| `GET` | `/api/gutschriften/{id}/pdf` | Gutschrift als PDF |
| `GET` | `/api/gutschriften/{id}/html` | Gutschrift als HTML |
| `POST` | `/api/gutschriften/{id}/auszahlen` | Gutschrift auszahlen |
| `GET`/`POST` | `/api/zahlungen` | Zahlungen auflisten / erfassen |
| `PATCH`/`DELETE` | `/api/zahlungen/{id}` | Zahlung bearbeiten / löschen |
| `POST` | `/api/auszahlungen` | Auszahlung erfassen |
| `DELETE` | `/api/auszahlungen/{id}` | Auszahlung löschen |
| `GET` | `/api/auszahlungen/{id}/pdf` | Auszahlungsbeleg als PDF |
| `GET` | `/api/dashboard` | Dashboard-Daten |
| `GET`/`PATCH` | `/api/einstellungen` | Einstellungen lesen / ändern |
| `GET` | `/api/buchhaltung/schuljahre` | Schuljahresübersicht |
| `GET` | `/api/buchhaltung/rechnungen` | Rechnungen eines Schuljahres |
| `GET` | `/api/buchhaltung/unversandt` | unversandte Rechnungen |
| `GET` | `/api/buchhaltung/versandt` | versandte Rechnungen |
| `GET` | `/api/klassenversetzung/vorschau` | Versetzungsvorschau |
| `POST` | `/api/klassenversetzung/ausfuehren` | Klassenversetzung ausführen |

Vollständige Request-/Response-Schemata stehen im laufenden Server unter `/docs`.

Hinweis: Im Code existiert zusätzlich ein Router für Mahnungen. Er ist in der aktuellen App-Initialisierung nicht eingebunden und deshalb nicht als aktiver API-Bereich dokumentiert.

---

## Authentifizierung

- Es gibt genau einen Benutzer: `admin`.
- Login erfolgt über `/api/auth/login`.
- Das Backend gibt einen JWT-Bearer-Token zurück.
- Der Token ist 7 Tage gültig.
- Das Passwort wird mit bcrypt gehasht in der Tabelle `einstellungen` gespeichert.
- `SECRET_KEY` ist Pflicht und muss mindestens 32 Zeichen lang sein.

Beim ersten Start wird das initiale Admin-Passwort aus `ADMIN_INITIAL_PASSWORD` übernommen. Danach kann es über die Einstellungen geändert werden.

---

## Tests

```bash
cd "Gymnasium Panketal/Bibliomat/backend"

uv sync --extra dev
uv run pytest
```

Die Tests liegen in `backend/tests/` und decken unter anderem Verkauf, Gutschrift, Saldo, Regeln und Rechnungs-E-Mail ab.

---

## Deployment

### Docker Compose

Im Projekt liegt bereits eine Compose-Konfiguration mit App-Container und Caddy-Reverse-Proxy.

```bash
cd "Gymnasium Panketal/Bibliomat"

touch .env
docker compose up -d --build
```

In `.env` mindestens diese Werte setzen:

```env
SECRET_KEY=hier-einen-zufaelligen-key-mit-mindestens-32-zeichen
CORS_ORIGINS=https://46.225.119.204.sslip.io,http://localhost:8000
ADMIN_INITIAL_PASSWORD=BitteAendern
```

Die Datenbank wird standardmäßig über dieses Volume persistent gespeichert:

```text
Gymnasium Panketal/Bibliomat/data/schulbuch.db
```

Der Pfad kann über `BIBLIOMAT_DATA_DIR` geändert werden.

### Docker manuell

```bash
cd "Gymnasium Panketal/Bibliomat"

docker build -f backend/Dockerfile -t bibliomat .

docker run -d \
  --name bibliomat \
  -p 8000:8000 \
  -v "$(pwd)/data:/app/data" \
  -e SECRET_KEY="$(openssl rand -hex 32)" \
  -e CORS_ORIGINS="http://localhost:8000" \
  -e ADMIN_INITIAL_PASSWORD="BitteAendern" \
  bibliomat
```

---

## Aktuelles Hosting

Die aktuelle Hosting-Konfiguration liegt im Ordner `Gymnasium Panketal/Bibliomat/` und nutzt Docker Compose mit zwei Diensten:

| Dienst | Zweck |
|---|---|
| `bibliomat` | FastAPI-App mit statischem Frontend, intern auf Port `8000` |
| `caddy` | Reverse Proxy mit HTTPS/TLS |

Die App ist laut aktuellem `Caddyfile` über diese Adresse vorgesehen:

```text
https://46.225.119.204.sslip.io
```

Direkte HTTP-Aufrufe auf die Server-IP werden weitergeleitet:

```text
http://46.225.119.204 -> https://46.225.119.204.sslip.io
```

Caddy verwendet `sslip.io`, damit die IP-Adresse ohne eigene Domain als HTTPS-fähiger Hostname genutzt werden kann. Der Reverse Proxy leitet anschließend intern an den App-Container weiter:

```text
46.225.119.204.sslip.io
  -> Caddy
  -> bibliomat:8000
```

Die App selbst wird im Compose-Setup zusätzlich nur lokal auf dem Server gebunden:

```text
127.0.0.1:8000:8000
```

Dadurch ist der direkte App-Port von außen nicht öffentlich gedacht; der normale Zugriff läuft über Caddy/HTTPS.

### Datenablage im aktuellen Hosting

Die SQLite-Datenbank liegt persistent im gemounteten Datenordner:

```text
Gymnasium Panketal/Bibliomat/data/schulbuch.db
```

Der Pfad kann über `BIBLIOMAT_DATA_DIR` geändert werden. Ohne diese Variable nutzt Compose automatisch `./data`.

### Betrieb auf dem Server

```bash
cd "Gymnasium Panketal/Bibliomat"

docker compose ps
docker compose logs -f bibliomat
docker compose logs -f caddy
```

Update/Neustart:

```bash
cd "Gymnasium Panketal/Bibliomat"

git pull
docker compose up -d --build
```

Health-Check:

```bash
curl https://46.225.119.204.sslip.io/api/health
```

Wichtige Konfiguration:

| Datei | Bedeutung |
|---|---|
| `docker-compose.yml` | Container, Ports, Volumes, Healthcheck |
| `Caddyfile` | öffentlicher Hostname, HTTPS, Reverse Proxy |
| `.env` | Secrets, CORS-Origins, initiales Admin-Passwort |
| `data/` | persistente Datenbankdateien |

---

## Backup und Betrieb

### Wichtige Dateien

| Datei/Ordner | Bedeutung |
|---|---|
| `data/schulbuch.db` | produktive SQLite-Datenbank im Docker-Setup |
| `data/schulbuch.db-wal` | SQLite WAL-Datei, falls aktiv |
| `data/schulbuch.db-shm` | SQLite Shared-Memory-Datei, falls aktiv |
| `backend/schulbuch.db` | lokale Datenbank bei Entwicklung ohne Docker |

### Backup erstellen

Am zuverlässigsten ist ein Backup bei gestopptem Container:

```bash
cd "Gymnasium Panketal/Bibliomat"

docker compose stop bibliomat
tar -czf "backup-bibliomat-$(date +%Y%m%d-%H%M).tar.gz" data/
docker compose start bibliomat
```

Für lokale Entwicklung:

```bash
cd "Gymnasium Panketal/Bibliomat/backend"
cp schulbuch.db "schulbuch-backup-$(date +%Y%m%d-%H%M).db"
```

### Betriebsempfehlungen

- Vor jedem Schuljahreswechsel ein manuelles Backup erstellen.
- Regelmäßige automatische Backups einrichten.
- Backups extern speichern.
- `.env` und Datenbankdateien nicht in Git committen.
- Nach Deployment `/api/health` prüfen.
- SMTP-Einstellungen nach Änderungen mit einer einzelnen Rechnung testen.

---

## Hilfsskripte

| Skript | Zweck |
|---|---|
| `backend/reset_bestand.py` | Bestand neu aufbauen |
| `backend/reset_schueler.py` | Schülerdaten für Test-/Entwicklungszwecke zurücksetzen |
| `backend/app/seed.py` | Start-/Beispieldaten erzeugen |
| `Sonstiges/migrations/*.py` | historische Migrations- und Reparaturskripte |
| `Sonstiges/debug-scripts/*.py` | Debug-Helfer für lokale Analyse |

---

## Bekannte Einschränkungen

| Thema | Details |
|---|---|
| Einzelbenutzer | Es gibt nur den `admin`-Account. Keine Rollen, keine Mehrbenutzer-Verwaltung. |
| SQLite | Gut für den internen Betrieb mit wenigen gleichzeitigen Nutzern. Nicht für hohe Schreiblast gedacht. |
| Frontend ohne Build | Babel Standalone kompiliert JSX im Browser. Das vereinfacht Deployment, verursacht aber kurze Ladezeit. |
| Migrationen | Kein Alembic. Schema-Anpassungen laufen idempotent beim Start über `init_db()`/`prepare_schema()`. |
| Downgrades | Rückwärtsmigrationen sind nicht vorgesehen. |
| PDF | WeasyPrint benötigt Systembibliotheken. Im Dockerfile sind sie enthalten. |
| E-Mail | SMTP statt OAuth. Zugangsdaten werden in den Einstellungen gepflegt. |
| Datenschutz | Es werden personenbezogene Daten Minderjähriger gespeichert. Betrieb, Zugriff und Backups müssen entsprechend abgesichert werden. |

---

## Changelog

### Mai 2026 (2026-05-26)

#### Design & Branding
- **Bibliomat-Logo** als SVG neu erstellt (Buch + Cursor-Icon, zentriert)
- **Playfair Display** Schriftart für alle Seitenüberschriften, Begrüßung und Flow-Titel (Ausgabe, Buchrückgabe)
- **Sidebar** mit dezenten Blau-Verlauf (`#eef3ff → #f8fafc`) für mehr Tiefe
- **Aktiver Navigationseintrag** wird jetzt farbig gefüllt (Akzentfarbe)
- **Input-Fokus-Glow** global: blauer Rahmen + Schimmer beim Fokussieren von Feldern
- **Login-Screen** komplett modernisiert: Verlaufshintergrund, Bibliomat-Branding, SVG-Logo

#### Navigation & Bezeichnungen
- „Bücherei Sekretariat" → **„Bibliomat"** in der Sidebar (Playfair Display)
- „Rechnungsversand & Buchhaltung" → **„Buchhaltung"** in Navigation und Seitenüberschrift
- „Verkauf" → **„Ausgabe"** in allen Schritten des Ausgabe-Flows
- „Verkauf" → **„Buchausgabe"** im Schülerprofil-Button

#### Bücher & Lernmaterial
- **Fächer löschen & umbenennen** direkt aus der Bücher-Ansicht
- **Gebühr** (früher „Schutzgebühr") bereits beim Anlegen eines Buches eingebbar
- Gebühr-Feld zeigt Platzhalter statt „0,00" wenn leer
- **Lernmaterial** mit Kategorien-Gruppenansicht (wie Bücher nach Fach)
- Kategorien in Lernmaterial haben jeweils eigene Icons

#### Nutzungsjahre-Farbskala
- Nutzungsjahr-Badges wechseln Farbe je Alter: **grün → limette → amber → orange → rot**
- Gilt in der Buchauswahl (Ausgabe-Flow), Rückgabe-Flow und Bücher-Bestandsübersicht

#### Archiv & Benachrichtigungen
- Archivierte Schüler werden korrekt dem Schuljahr der Archivierung zugeordnet
- **10-Jahres-Aufbewahrungspflicht**: System erkennt abgelaufene Archiveinträge
- **Benachrichtigungs-Glocke** auf dem Startbildschirm für Systemhinweise
- Benutzer kann abgelaufene Archiveinträge nach Bestätigung löschen

#### Fixes
- Eurozeichen in Buchhaltungs-Karte nicht mehr auf separater Zeile
- Klasse 5 fehlte im Schüler-Filter — jetzt ergänzt

### Mai 2026

- Umbenennung zu **Bibliomat**
- Fächerübersicht in der Bücher-Ansicht
- Zurück-Buttons und Breadcrumbs in mehrstufigen Ansichten
- Klassenversetzung mit Auswahl aller Schüler
- Dashboard mit sechs letzten Vorgängen
- Dashboard-Widget für unversandte Rechnungen
- aktuelles Schuljahr aus Einstellungen
- numerische Klassensortierung
- Erweiterungen für Lernmaterial, Freiposten, Auszahlungen und Buchhaltung
