# Bibliomat

> Schulbuch-Verwaltung für Verkauf, Rückgabe, Gutschriften, Rechnungen, PDF-Erzeugung und E-Mail-Versand.

![Python](https://img.shields.io/badge/Python-3.12-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-Backend-009688)
![SQLite](https://img.shields.io/badge/Database-SQLite-lightgrey)
![Docker](https://img.shields.io/badge/Deployment-Docker-2496ED)
![Status](https://img.shields.io/badge/Status-Internal%20App-orange)

---

## Interner Betrieb

### Bibliomat öffnen

```text
http://SERVER-IP:8000
```

Die Anwendung ist für den internen Betrieb ohne Reverse Proxy vorbereitet. Docker Compose veröffentlicht die FastAPI-App direkt auf Port `8000`.

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
- Benutzerverwaltung und Backup/Restore über Admin-Panel

Die App ist bewusst einfach gehalten:

| Eigenschaft | Beschreibung |
|---|---|
| Benutzerkonzept | Admin + verwaltbare Benutzer |
| Frontend | JSX direkt im Browser, kein Build-Schritt |
| Backend | FastAPI |
| Datenbank | SQLite mit WAL-Modus |
| Deployment | Docker Compose |
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
- Klassenübersicht und Klassenversetzung (Abgangsstufe: Klasse 12)
- Archivierung von Abgangsschülern — optional mit Büchern (behalten-Flag)
- Reaktivierung archivierter Schüler
- Saldo je Schüler
- Vorgangsverlauf je Schüler
- Anzeige aktiver, noch nicht zurückgegebener Bücher

### Bücherverwaltung

- Bücherkatalog mit ISBN, Fach, Klasse, Basispreis und Schutzgebühr
- Fächerübersicht
- Bestand nach Nutzungsjahr (automatische Alterung pro Schuljahr)
- `bestand_frei` immer aus Bucket-Summe berechnet
- Automatische Preisberechnung je Nutzungsjahr
- Rückgabe und Wiederverkauf
- Soft-Delete für nicht mehr genutzte Bücher

### Lernmaterial und Freiposten

- Lernmaterial mit Kategorie, Preis und Bestand
- CSV-Import für Lernmaterial (Pflicht: name, kategorie, preis)
- Lernmaterial-Positionen auf Rechnungen
- Freie Rechnungspositionen
- Wiederverwendbare Freiposten-Vorlagen

### Rechnungen, Gutschriften und Auszahlungen

- Verkauf mehrerer Bücher pro Schüler
- Oberstufe (Kl. 11/12): optionale Buchausgabe per Checkbox
- Rückgaben im Verkaufsworkflow
- Automatische Verrechnung vorhandener Guthaben
- Rechnungserstellung mit fortlaufender Rechnungsnummer
- Gutschrifterstellung bei Rückgabe
- Auszahlungsbelege für Schüler-Guthaben
- Storno von Rechnungen
- PDF- und HTML-Ausgabe

### Kommunikation

- SMTP-basierter Rechnungsversand
- Konfigurierbare Absender-, Betreff- und Textvorlagen
- Versandstatus pro Rechnung
- Dashboard für unversandte Rechnungen
- Mail-Vorschau vor dem Versand

### Buchhaltung

- Rechnungsübersicht nach Schuljahr
- Listen für unversandte und versandte Rechnungen
- Zahlungseingänge erfassen
- Auszahlungen erfassen
- Schülerbezogene Salden

### Admin-Panel (Profil → Konten / System)

- Benutzer anlegen, löschen und Passwort ändern
- Datenbank-Backup herunterladen
- Datenbank-Restore aus Datei

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
| Tests | pytest, httpx |
| Deployment | Docker, Docker Compose |

**Wichtig:** Das Frontend hat keinen Node-/Webpack-/Vite-Build. Die JSX-Dateien liegen in `frontend/` und werden direkt vom Browser über Babel Standalone kompiliert. Änderungen immer in `api.js` vornehmen (nicht `api.ts`).

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

```text
Browser im internen Netzwerk
  |
  | HTTP :8000
  v
Bibliomat FastAPI Container
  |
  v
/app/data/schulbuch.db
```

---

## Projektstruktur

```text
Bibliomat/
├── docker-compose.yml
├── frontend/
│   ├── index.html           # Einstiegspunkt, Versionsnummern (?v=N)
│   ├── app.jsx              # Routing, globaler Zustand
│   ├── api.js               # API-Client (aktiv, vom Browser geladen)
│   ├── api.ts               # TypeScript-Quelle (nicht vom Browser geladen)
│   ├── login.jsx
│   ├── home.jsx             # Dashboard
│   ├── screens.jsx          # SchuelerListe, Buchhaltung, Klassenversetzung, Archiv
│   ├── schueler-detail.jsx  # Schüler-Detailansicht
│   ├── verkauf.jsx          # Buchausgabe-Flow
│   ├── profil.jsx           # Einstellungen, Konten, Backup/Restore
│   ├── lernmaterial.jsx
│   ├── inventory-overrides.jsx
│   └── ui.jsx / layout.jsx  # UI-Primitives
└── backend/
    ├── Dockerfile
    ├── pyproject.toml
    ├── app/
    │   ├── main.py          # FastAPI-App, CORS, Router, Static-Files
    │   ├── db.py            # Engine, Sessions, Schema-Vorbereitung
    │   ├── models.py        # SQLAlchemy-Modelle
    │   ├── schemas.py       # Pydantic-Schemas
    │   ├── security.py      # JWT, bcrypt, Auth-Dependency
    │   ├── routers/
    │   │   ├── admin.py     # Benutzerverwaltung, Backup/Restore
    │   │   ├── auth.py
    │   │   ├── schueler.py
    │   │   ├── verkauf.py
    │   │   ├── gutschrift.py
    │   │   ├── buecher.py
    │   │   ├── klassenversetzung.py
    │   │   └── ...
    │   ├── services/
    │   │   ├── pdf.py       # WeasyPrint
    │   │   ├── zustand.py   # Preisberechnung, NJ-Logik
    │   │   └── ...
    │   └── templates/       # Jinja2: rechnung, gutschrift, auszahlung, mahnung
    └── tests/
```

---

## Lokale Entwicklung

### Voraussetzungen

- Python 3.12+
- `uv`

### Starten

```powershell
cd backend
uv sync
uv run --env-file .env uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Danach ist die App erreichbar unter:

```text
http://localhost:8000
```

Swagger/OpenAPI:

```text
http://localhost:8000/docs
```

---

## Umgebungsvariablen

| Variable | Pflicht | Beschreibung |
|---|---:|---|
| `SECRET_KEY` | Ja | JWT-Signing-Key, mindestens 32 Zeichen. Beispiel: `openssl rand -hex 32` |
| `CORS_ORIGINS` | Ja | Kommagetrennte Liste erlaubter Origins. |
| `ADMIN_INITIAL_PASSWORD` | Nein | Startpasswort für `admin`, wird nur beim **ersten Start** gesetzt (INSERT OR IGNORE). Danach im Admin-Panel änderbar. |
| `DATABASE_URL` | Nein | SQLAlchemy-URL. Standard: `sqlite:///data/schulbuch.db`. |
| `EXTRA_USERS_PASSWORD` | Nein | Initiales Passwort für lehrer/schulleiter/sekretariat. |

Beispiel `.env`:

```env
SECRET_KEY=hier-einen-zufaelligen-key-mit-mindestens-32-zeichen
CORS_ORIGINS=http://SERVER-IP:8000,http://localhost:8000
ADMIN_INITIAL_PASSWORD=BitteAendern
DATABASE_URL=sqlite:///data/schulbuch.db
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
| `rechnungs_posten` | Buchpositionen einer Rechnung; Flags: zurueckgegeben, behalten |
| `rechnung_freiposten` | freie Positionen einer Rechnung |
| `freiposten_vorlagen` | Vorlagen für freie Positionen |
| `gutschriften` | Gutschriftkopf |
| `gutschrift_posten` | Rückgabe-/Gutschriftpositionen |
| `rechnung_verrechnungen` | Verrechnung von Guthaben mit Rechnungen |
| `zahlungen` | Zahlungseingänge |
| `auszahlungen` | Auszahlungen von Guthaben |
| `benutzer` | Benutzerkonten (außer admin) mit bcrypt-Passwort-Hash |
| `einstellungen` | Key-Value-Store für Schul-, Mail-, Preis-Einstellungen und admin_password_hash |
| `v_schueler_saldo` | berechneter Saldo je Schüler |

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

Das Nutzungsjahr steigt anhand des Schuljahres. Stichtag für die Logik ist der 1. August. NJ=0 altert nie.

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

Alle Endpunkte außer `/api/auth/login` und `/api/health` benötigen einen gültigen JWT-Bearer-Token. Admin-Endpunkte (`/api/admin/*`) erfordern zusätzlich den `admin`-Account.

| Methode | Pfad | Beschreibung |
|---|---|---|
| `POST` | `/api/auth/login` | Login |
| `GET` | `/api/health` | Health-Check |
| `GET` | `/api/admin/benutzer` | Benutzerliste (nur Admin) |
| `POST` | `/api/admin/benutzer` | Benutzer anlegen (nur Admin) |
| `DELETE` | `/api/admin/benutzer/{name}` | Benutzer löschen (nur Admin) |
| `PATCH` | `/api/admin/benutzer/{name}/passwort` | Passwort ändern (nur Admin) |
| `PATCH` | `/api/admin/passwort` | Admin-Passwort ändern |
| `GET` | `/api/admin/backup` | Datenbank herunterladen (nur Admin) |
| `POST` | `/api/admin/restore` | Datenbank wiederherstellen (nur Admin) |
| `GET`/`POST` | `/api/schueler` | Schüler auflisten / anlegen |
| `GET`/`PATCH`/`DELETE` | `/api/schueler/{id}` | Schüler lesen / bearbeiten / löschen |
| `POST` | `/api/schueler/{id}/archivieren` | Schüler archivieren |
| `GET` | `/api/schueler/{id}/vorgaenge` | Vorgangsverlauf |
| `GET` | `/api/schueler/{id}/aktive-buecher` | aktive Bücher |
| `POST` | `/api/schueler/import/csv/preview` | CSV-Import prüfen |
| `POST` | `/api/schueler/import/csv` | CSV-Import ausführen |
| `GET`/`POST` | `/api/buecher` | Bücher auflisten / anlegen |
| `GET`/`PATCH`/`DELETE` | `/api/buecher/{id}` | Buch lesen / bearbeiten / löschen |
| `GET`/`POST` | `/api/lernmaterial` | Lernmaterial auflisten / anlegen |
| `GET`/`PATCH`/`DELETE` | `/api/lernmaterial/{id}` | Lernmaterial lesen / bearbeiten / löschen |
| `POST` | `/api/lernmaterial/import/csv` | Lernmaterial per CSV importieren |
| `GET`/`POST` | `/api/freiposten/vorlagen` | Freiposten-Vorlagen verwalten |
| `POST` | `/api/verkauf` | Rechnung erstellen |
| `GET` | `/api/rechnungen` | Rechnungen auflisten |
| `GET` | `/api/rechnungen/{id}` | Rechnung abrufen |
| `POST` | `/api/rechnungen/{id}/storno` | Rechnung stornieren |
| `GET` | `/api/rechnungen/{id}/pdf` | Rechnung als PDF |
| `GET` | `/api/rechnungen/{id}/html` | Rechnung als HTML |
| `POST` | `/api/rechnungen/{id}/mail` | Rechnung per E-Mail senden |
| `POST` | `/api/gutschrift` | Gutschrift erstellen |
| `GET` | `/api/gutschriften/{id}` | Gutschrift abrufen |
| `GET` | `/api/gutschriften/{id}/pdf` | Gutschrift als PDF |
| `GET` | `/api/gutschriften/{id}/html` | Gutschrift als HTML |
| `GET`/`POST` | `/api/zahlungen` | Zahlungen auflisten / erfassen |
| `PATCH`/`DELETE` | `/api/zahlungen/{id}` | Zahlung bearbeiten / löschen |
| `POST` | `/api/auszahlungen` | Auszahlung erfassen |
| `DELETE` | `/api/auszahlungen/{id}` | Auszahlung löschen |
| `GET` | `/api/auszahlungen/{id}/pdf` | Auszahlungsbeleg als PDF |
| `GET`/`PATCH` | `/api/einstellungen` | Einstellungen lesen / ändern |
| `GET` | `/api/buchhaltung/schuljahre` | Schuljahresübersicht |
| `GET` | `/api/buchhaltung/rechnungen` | Rechnungen eines Schuljahres |
| `GET` | `/api/klassenversetzung/vorschau` | Versetzungsvorschau |
| `POST` | `/api/klassenversetzung/ausfuehren` | Klassenversetzung ausführen |
| `GET` | `/api/benachrichtigungen` | System-Warnungen |

Vollständige Request-/Response-Schemata stehen im laufenden Server unter `/docs`.

---

## Authentifizierung

- Login über `/api/auth/login` — gibt JWT-Bearer-Token zurück (7 Tage gültig)
- `SECRET_KEY` ist Pflicht, mindestens 32 Zeichen
- Passwörter werden mit **bcrypt** gehasht gespeichert — niemals im Klartext
- Nutzer `admin`: Hash in `einstellungen.admin_password_hash`
- Alle anderen Nutzer: Hash in `benutzer.passwort_hash`
- `ADMIN_INITIAL_PASSWORD` wird nur beim **ersten Start** gesetzt (INSERT OR IGNORE). Danach kann das Passwort im Admin-Panel geändert werden und bleibt auch nach Neustarts erhalten
- Admin-Passwort zurücksetzen: Eintrag `admin_password_hash` aus `einstellungen` löschen + Server neu starten

---

## Tests

```bash
cd backend
uv sync --extra dev
uv run pytest
```

---

## Deployment

### Docker Compose

```bash
# Erstinstallation per Git
cd /opt
git clone -b dev https://github.com/candermann/Libera.git libera

# Auf Server
cd /opt/libera
docker compose down
docker compose up -d --build
```

Danach im internen Netzwerk öffnen:

```text
http://SERVER-IP:8000
```

### DB auf Server übertragen (überschreibt Server-DB!)

```bash
ssh root@SERVER-IP "cd /opt/libera && docker compose down"
rsync -avz --delete /mnt/c/Users/keanu/dev/Bibliomat/backend/data/ root@SERVER-IP:/opt/libera/data/
ssh root@SERVER-IP "cd /opt/libera && docker compose up -d --build"
```

---

## Aktuelles Hosting

| Dienst | Zweck |
|---|---|
| `bibliomat` | FastAPI-App mit statischem Frontend, veröffentlicht auf Port `8000` |

```text
http://SERVER-IP:8000 → bibliomat:8000
```

---

## Backup und Betrieb

| Datei/Ordner | Bedeutung |
|---|---|
| `data/schulbuch.db` | produktive SQLite-Datenbank |
| `data/schulbuch.db-wal` | SQLite WAL-Datei |
| `data/schulbuch.db-shm` | SQLite Shared-Memory-Datei |

Beim Kopieren der DB immer **alle drei Dateien zusammen** übertragen — sonst fehlen neuere Einträge.

Backup über Admin-Panel: Profil → System → Backup herunterladen.

---

## Bekannte Einschränkungen

| Thema | Details |
|---|---|
| SQLite | Gut für den internen Betrieb mit wenigen gleichzeitigen Nutzern. Nicht für hohe Schreiblast gedacht. |
| Frontend ohne Build | Babel Standalone kompiliert JSX im Browser. Das vereinfacht Deployment, verursacht aber kurze Ladezeit. Versionsnummern in `index.html` müssen nach Änderungen manuell erhöht werden. |
| Migrationen | Kein Alembic. Schema-Anpassungen laufen idempotent beim Start über `init_db()`/`prepare_schema()`. |
| PDF | WeasyPrint benötigt Systembibliotheken. Im Dockerfile sind sie enthalten. |
| E-Mail | SMTP statt OAuth. Zugangsdaten werden in den Einstellungen gepflegt. |
| Datenschutz | Es werden personenbezogene Daten Minderjähriger gespeichert. Betrieb, Zugriff und Backups müssen entsprechend abgesichert werden. |

---

---

# 🔐 DSGVO

> Datenschutz-Grundverordnung — Prüfbericht und Maßnahmen für den Betrieb mit personenbezogenen Daten Minderjähriger

Bibliomat verarbeitet personenbezogene Daten von Schülerinnen und Schülern (Minderjährige) sowie deren Erziehungsberechtigten. Der Betreiber — die Schule Panketal — trägt als Verantwortlicher im Sinne von Art. 4 Nr. 7 DSGVO die Rechenschaftspflicht (Art. 5 Abs. 2 DSGVO).

---

## Prüfstatus (29.05.2026)

| Bereich | Artikel | Status | Kurzbefund |
|---|---|---|---|
| Personenbezogene Daten Minderjähriger | Art. 8 | ⚠️ | Rechtsgrundlage nicht dokumentiert |
| Datensicherheit | Art. 32 | ⚠️ / ❌ | JWT-Laufzeit, fehlendes Rate Limiting — **behoben** |
| Datensparsamkeit / Zweckbindung | Art. 5 | ✅ | 10-Jahres-Frist implementiert |
| Auskunfts- und Löschrecht | Art. 15–17 | ⚠️ | Nur Soft-Delete, kein Auskunftsexport |
| E-Mail / Datenübertragung | Art. 25, 32 | ✅ / ⚠️ | STARTTLS vorhanden, SMTP-Passwort im Klartext |
| Protokollierung / Audit-Trail | Art. 5 Abs. 2 | ⚠️ | Logging für Auth-Ereignisse — **behoben** |
| Drittland / Auftragsverarbeitung | Art. 44 ff. | ⚠️ | AVV-Entwurf vorhanden |
| Technische Schwachstellen | Art. 32 | ⚠️ | Standardpasswort entfernt — **behoben** |

---

## Pflichten des Betreibers

Folgende organisatorischen Maßnahmen liegen außerhalb des Codes und sind vom Betreiber sicherzustellen:

- **Verzeichnis der Verarbeitungstätigkeiten (VVT)** nach Art. 30 DSGVO — Pflicht für öffentliche Einrichtungen
- **Rechtsgrundlage** für jede Datenkategorie festhalten (wahrscheinlich Art. 6 Abs. 1 lit. e für Schüler- und Finanzdaten)
- **Datenschutz-Folgenabschätzung (DPIA)** nach Art. 35 prüfen lassen — Minderjährige + Finanzdaten
- **Auftragsverarbeitungsvertrag (AVV)** mit dem Softwareentwickler schriftlich abschließen (Entwurf vorhanden)
- **Backup-Dateien** sicher aufbewahren (verschlüsselter Speicher, kein Versand per E-Mail) — Backups enthalten alle Schülerdaten im Klartext
- **Passwortrichtlinie** für alle Benutzerkonten einführen und dokumentieren
- **Sitzungsabmeldung** an öffentlich zugänglichen Schulrechnern sicherstellen (manuell oder Inaktivitäts-Timer)
- **Das Feld `Notizen`** darf keine besonderen Kategorien personenbezogener Daten (Art. 9) enthalten — z. B. keine Gesundheitsdaten

---

## Offene technische Punkte (noch nicht behoben)

| Priorität | Maßnahme |
|---|---|
| Mittel | JWT-Token in HttpOnly-Cookie statt `localStorage` |
| Mittel | SMTP-Passwort verschlüsseln statt Klartext in DB |
| Mittel | Physische Löschfunktion / Anonymisierung für Art.-17-Anträge |
| Mittel | Jinja2 `SandboxedEnvironment` für Admin-editierbare E-Mail-Templates |
| Gering | Sicherheits-HTTP-Header bei späterem Reverse Proxy ergänzen |
| Gering | Passwortlänge beim Ändern erzwingen (mind. 12 Zeichen) |

---

## Sonderpatch DSGVO

> Commit: `dsgvo-patch` — Behobene kritische Mängel aus dem Prüfbericht vom 29.05.2026

### 1. Hardcoded Standardpasswort entfernt

**Datei:** `backend/app/db.py`

Der Fallback `"Bibliomat2024!"` für die Benutzerkonten `lehrer`, `schulleiter` und `sekretariat` wurde entfernt. Der Server startet jetzt nicht mehr, wenn `EXTRA_USERS_PASSWORD` in der `.env` fehlt und noch keine dieser Benutzer in der Datenbank existieren. Bestehende Instanzen (Benutzer bereits in DB) sind nicht betroffen.

**Erforderliche Maßnahme:** `EXTRA_USERS_PASSWORD=<sicheres-passwort>` in die `.env` eintragen, bevor ein frischer Server gestartet wird.

### 2. JWT-Token-Laufzeit auf 8 Stunden reduziert

**Datei:** `backend/app/security.py`

Die Token-Laufzeit wurde von 7 Tagen (`60 * 24 * 7`) auf 8 Stunden (`60 * 8`) reduziert. Ein gestohlenes Token (z. B. durch XSS aus `localStorage`) ist damit maximal 8 Stunden gültig statt einer Woche.

**Hinweis für Benutzer:** Nach 8 Stunden Inaktivität ist eine erneute Anmeldung erforderlich.

### 3. Rate Limiting am Login-Endpunkt

**Dateien:** `backend/pyproject.toml`, `backend/app/main.py`, `backend/app/routers/auth.py`

Der `/api/auth/login`-Endpunkt ist jetzt auf **10 Anfragen pro Minute pro IP-Adresse** beschränkt. Brute-Force-Angriffe auf Passwörter werden damit erheblich erschwert. Implementiert mit `slowapi`.

### 4. Logging für sicherheitsrelevante Ereignisse

**Dateien:** `backend/app/routers/auth.py`, `backend/app/routers/admin.py`

Folgende Ereignisse werden jetzt strukturiert im Application-Log protokolliert:

| Ereignis | Log-Level | Inhalt |
|---|---|---|
| Erfolgreicher Login | `INFO` | Benutzername, Zeitstempel |
| Fehlgeschlagener Login | `WARNING` | Benutzername (ohne Passwort), Zeitstempel |
| Rate-Limit überschritten | `WARNING` | Automatisch via slowapi |
| Backup-Download | `INFO` | Benutzername, Zeitstempel |
| DB-Restore | `WARNING` | Benutzername, Zeitstempel |
| Benutzer angelegt | `INFO` | Neuer Benutzername, ausführender Admin |
| Benutzer gelöscht | `WARNING` | Gelöschter Benutzername, ausführender Admin |

Die Logs erscheinen im Container-Output (`docker compose logs bibliomat`).

---

## Changelog

### Mai 2026 (29.05.2026)

- **Lernmaterial**: CSV-Import für Massenimport (Pflicht: name, kategorie, preis; optional: bestand)
- **Admin-Panel**: Benutzerverwaltung (anlegen, löschen, Passwort ändern) im Profil-Tab „Konten"
- **Backup/Restore**: DB-Download und -Upload direkt im Profil-Tab „System"
- **behalten-Flag**: Schüler aus Kl. 12 können Bücher beim Archivieren behalten; Bestand wird korrekt aktualisiert
- **Oberstufe**: Buchausgabe für Kl. 11/12 optional per Checkbox aktivierbar
- **Bestandsfix**: `bestand_frei` immer aus Bucket-Summe (nicht `gesamt - ausgegeben`); `bestand_gesamt` für alle Bücher auf korrekte Summe gebracht
- **Admin-Passwort**: wird nur beim ersten Start gesetzt (INSERT OR IGNORE) — UI-Änderungen bleiben nach Neustart erhalten
- **Gutschrift-PDF**: Gutschrift-ID nicht mehr im Dokument sichtbar
- **Klassenversetzung**: Abgangsstufe ist Klasse 12

### Mai 2026 (26.05.2026)

- Design & Branding: Bibliomat-Logo, Playfair Display, modernisierter Login
- Bücher: Fächer umbenennen/löschen, Schutzgebühr beim Anlegen
- Nutzungsjahr-Farbskala (grün → rot je Alter)
- Archiv: 10-Jahres-Aufbewahrungspflicht, Benachrichtigungs-Glocke
- Lernmaterial: Kategorien-Gruppenansicht
- Klassenversetzung: alle Schüler auswählbar
- Dashboard: letzte Vorgänge, unversandte Rechnungen
