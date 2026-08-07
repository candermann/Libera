# Codebase Knowledge

Stand: 2026-07-24

Diese Datei fasst mein aktuelles technisches Wissen über die Libera/Bibliomat-Codebase zusammen. Sie ist als schnelle Orientierung für zukünftige Arbeit gedacht.

## Überblick

Libera/Bibliomat ist eine Web-Anwendung zur Schulbuch- und Rechnungsverwaltung.

- Backend: Python 3.12, FastAPI, SQLAlchemy, SQLite, Pydantic, WeasyPrint, Jinja2.
- Frontend: React 18 über CDN/Babel Standalone, klassische `.jsx`-Dateien, kein Vite/Webpack.
- Persistenz: SQLite, lokal unter `backend/data/schulbuch.db`.
- Projekt-Root der eigentlichen App: `/Users/canbilir/Libera/Libera`.

## Wichtige Ordner

- `backend/app/main.py`: FastAPI-App und Router-Registrierung.
- `backend/app/db.py`: Schema-Initialisierung, additive Migrationen, Views, Defaults.
- `backend/app/models.py`: SQLAlchemy-Modelle.
- `backend/app/schemas.py`: Pydantic-Schemas.
- `backend/app/security.py`: Auth/JWT/Passwortlogik.
- `backend/app/routers/`: Fachliche API-Endpunkte.
- `backend/app/services/`: ID-Generierung, Saldo, PDF, Mail, Zustands-/Preislogik.
- `backend/tests/`: Pytest-Test-Suite.
- `frontend/index.html`: lädt die Frontend-Dateien mit Cache-Busting-Versionen.
- `frontend/app.jsx`: Root-Komponente und Hash-Routing.
- `frontend/layout.jsx`: Layout, Sidebar, globale Entwurfsverwaltung `window.vorgangEntwuerfe`.
- `frontend/screens.jsx`: große Screen-Sammlung, u.a. Buchhaltung, Schülerliste, Rückgabe.
- `frontend/verkauf.jsx`: Buchausgabe und kombinierter Ausgabe/Rückgabe-Flow.
- `frontend/schueler-detail.jsx`: Schülerakte, Zahlungen, Vorgänge, Rechnung/Storno.
- `frontend/api.js`: tatsächlich im Browser verwendeter API-Wrapper.
- `frontend/api.ts`: TypeScript-Quelle für Build-Checks; Browser nutzt nicht automatisch diese Datei.

## Frontend-Fallstricke

- Die App hat keinen klassischen Bundler. JSX wird im Browser durch Babel Standalone transpiliert.
- `npm run build:frontend` prüft nur `frontend/api.ts`, `frontend/print.ts` und Typdefinitionen aus `frontend/types/**/*.d.ts`.
- Für JSX-Dateien ist ein gezielter Parse-Check sinnvoll:

```bash
npm ci
./node_modules/.bin/tsc --allowJs --jsx react --noEmit --module None --target ES2020 --lib DOM,DOM.Iterable,ES2020 --skipLibCheck frontend/screens.jsx frontend/app.jsx
rm -r node_modules
```

- `npm run build:frontend` erzeugt/überschreibt `frontend/api.js` und `frontend/print.js`. Diese generierten Diffs können älteren Stand aus `api.ts`/`print.ts` zurückschreiben. Falls sie nicht Teil der Änderung sind, gezielt rückgängig machen.
- Nach Frontend-Dateiänderungen muss ggf. in `frontend/index.html` die passende `?v=N` Versionsnummer erhöht werden, damit Browser-Caches nicht stören.
- Hash-Routing läuft über `app.jsx`. Relevante Routen: `start`, `ausgabe-rueckgabe`, `buchausgabe`, `buchruckgabe`, `schueler`, `buecher`, `lernmaterial`, `buchhaltung`, `klassenversetzung`, `schuelerarchiv`, `profil`/`einstellungen`.

## Backend-Fallstricke

- Tests sollten aus `backend/` über `uv run pytest` laufen, nicht mit dem System-Python.
- `DATABASE_URL=sqlite:///data/schulbuch.db` ist Working-Directory-relativ. Uvicorn daher aus `backend/` starten.
- SQLite läuft mit WAL-Pragmas in Tests/Setup. Beim Kopieren einer aktiven DB immer Hauptdatei, `-wal` und `-shm` zusammen behandeln.
- Additive Schemaänderungen sitzen in `backend/app/db.py`, nicht in Alembic-Migrationen.
- API-Antworten nutzen teils berechnete Felder aus SQL/Views statt reine ORM-Serialisierung.

## Tests

Wichtige Befehle:

```bash
cd backend
uv run pytest -q
uv run pytest tests/test_verkauf.py -q
```

Zuletzt erfolgreich gesehen:

- `uv run pytest -q`: 66 Tests grün.
- `uv run pytest tests/test_verkauf.py -q`: 14 Tests grün.
- `npm run build:frontend`: erfolgreich, aber nur für TS-Dateien relevant.
- JSX-Parse-Check für `frontend/screens.jsx` und `frontend/app.jsx`: erfolgreich.

## Datenmodell

Kernmodelle in `backend/app/models.py`:

- `Schueler`: Schülerstammdaten, Soft-Delete/Archivierung.
- `Buecher`: Buchkatalog mit Preis, Schutzgebühr, Gesamt-/Ausgabebestand.
- `BuchZustandBestand`: Bestands-Buckets nach Buch, Zustand, Nutzungsjahr.
- `Rechnungen`: Rechnungskopf, Status, Summe, Verrechnung, Versand, Anzeige-Nummer.
- `RechnungsPosten`: Buchpositionen einer Rechnung, Rückgabe-/Behalten-Flags.
- `Lernmaterial` und `LernmaterialPosten`: Lernmaterialverkauf.
- `RechnungFreiposten`: freie/manuelle Rechnungsposten.
- `Gutschriften` und `GutschriftPosten`: Rückgaben/Gutschriften.
- `Zahlungen` und `Auszahlungen`: Zahlungs-/Auszahlungsbuchungen.
- `RechnungVerrechnung`: Zuordnung von Guthaben/Gutschriften zu Rechnungen.
- `RechnungEntwurf`: serverseitig persistierte Entwürfe/offene Vorgänge.
- `RechnungStornoAudit`: Audit-Log für Storno-Aktionen.
- `Einstellungen`: Key-Value-Store für Schuljahr, Schuldaten, SMTP, Admin-Hash.
- `Benutzer`: zusätzliche Benutzerkonten.

## Entwürfe

Serverseitige Entwürfe sind in `rechnung_entwuerfe` gespeichert und werden über `backend/app/routers/verkauf.py` verwaltet:

- `GET /api/rechnungen/entwuerfe`
- `POST /api/rechnungen/entwuerfe`
- `GET /api/rechnungen/entwuerfe/{id}`
- `PATCH /api/rechnungen/entwuerfe/{id}`
- `DELETE /api/rechnungen/entwuerfe/{id}`

Frontend-Verwaltung:

- `window.vorgangEntwuerfe` in `frontend/layout.jsx`.
- Autosave mit 20 Sekunden Debounce.
- `saveNow` für manuelles Speichern und Speichern beim Abbruch.
- Cache-Key: `flow:schuelerId`.
- Flows: `buchausgabe`, `buchruckgabe`, `ausgabe-rueckgabe`.

Wichtige Regeln:

- Entwürfe sind an den ursprünglichen Schüler gebunden.
- Entwürfe sind strikt an den ursprünglichen Bearbeiter gebunden.
- `admin` darf fremde Entwürfe nicht automatisch sehen/fortführen.
- `freigegeben_an` wird aus Kompatibilitätsgründen noch im Schema akzeptiert, aber serverseitig leer gespeichert.
- Checkout mit `entwurf_id` markiert den Entwurf als `abgeschlossen`, sofern Schüler und Bearbeiter passen.
- Alte Entwürfe werden nach 60 Tagen Inaktivität beim Listen/Speichern aufgeräumt.

Jüngste UI-Änderungen:

- Abbruch in `Buchausgabe` und `Ausgabe & Rückgabe` speichert vorhandenen Inhalt automatisch als Entwurf.
- Dabei erscheint ein Toast: `Entwurf wird gespeichert...`.
- Buchhaltung hat einen Tab `Entwürfe` zwischen `Buchhaltung` und `Klassenliste`.
- Dieser Tab zeigt serverseitige Entwürfe des aktuellen Benutzers, inklusive Filter, Sortierung, Aktualisieren, Fortsetzen und Verwerfen.

## Storno

Storno liegt im Backend in `POST /api/rechnungen/{rechnung_id}/storno`.

Funktionalität:

- Pflichtfeld `grund`.
- Optional `rechnungs_posten_ids` für Teilstorno einzelner Buchpositionen.
- Ohne `rechnungs_posten_ids`: Storno der gesamten Rechnung.
- Rechnung mit Status `storniert` kann nicht erneut storniert werden.
- Buchpositionen werden auf `zurueckgegeben=1` gesetzt und Bestand wird zurückgeführt.
- Lernmaterialbestand wird bei Gesamtstorno zurückgeführt.
- Freiposten werden bei Gesamtstorno in den stornierten Betrag einbezogen.
- Bei bezahltem Storno entsteht eine Gutschrift für den bezahlten Anteil.
- Audit-Log wird in `rechnung_storno_audit` geschrieben.

UI-Orte mit Storno:

- Schülerdetail-Vorgangsliste.
- Buchhaltung/Jahresdetail.
- Buchhaltung/Rechnungsversand, sowohl offene als auch bereits versandte Rechnungen.

Dialog:

- `StornoDialog` in `frontend/screens.jsx`.
- Lädt Rechnungsdetails via `window.api.rechnung.get`.
- Unterstützt Gesamtstorno und einzelne Buchpositionen.
- Grund ab 3 Zeichen erforderlich.

## Buchhaltung

`frontend/screens.jsx` enthält `Buchhaltung`.

Tabs:

- `Rechnungsversand`
- `Buchhaltung`
- `Entwürfe`
- `Klassenliste`

Backend-Router:

- `backend/app/routers/buchhaltung.py`
- `window.api.buchhaltung.unversandt()`
- `window.api.buchhaltung.versandt()`
- `window.api.buchhaltung.schuljahre()`
- `window.api.buchhaltung.rechnungen(schuljahr)`

## Verkauf / Rechnungserstellung

`backend/app/routers/verkauf.py` ist zentral für:

- Verkauf/Erstellung von Rechnungen über `POST /api/verkauf`.
- Preisberechnung und Bestandsabbuchung.
- Inline-Rückgaben im kombinierten Flow.
- Guthabenverrechnung.
- Abschluss von Entwürfen.
- Storno.
- Rechnung-Detail, HTML/PDF/Mail-Endpunkte.

Frontend:

- `frontend/verkauf.jsx`
- `Verkauf`: reine Buchausgabe.
- `KombiniertFlow`: Ausgabe und Rückgabe kombiniert.
- `frontend/screens.jsx` enthält zusätzlich `Rueckgabe`.

## Bestand und Preise

- Bücher haben Gesamtbestand und ausgegebenen Bestand.
- Effektiv verfügbar wird über `buch_zustand_bestand.bestand_verfuegbar` pro Bucket geführt.
- Nutzungsjahr-Logik und Preisabschläge liegen in `backend/app/services/zustand.py`.
- Freier Bestand altert nicht, unabhängig vom gespeicherten Nutzungsjahr.
- Ausgegebene Bücher altern bis zur Rückgabe über die Schuljahreslogik (Stichtag 1. August).
- Schutzgebühr greift bei hohen Nutzungsjahren.

## Auth

- Login über `/api/auth/login`, setzt httpOnly-Cookie; Response-Body enthält nur `{"status":"ok"}` (kein JWT mehr im Body, seit 24.07.2026).
- Session über JWT/Cookie bzw. Authorization.
- `get_current_user` ist die zentrale Dependency (liest nur das Token, kein DB-Zugriff).
- Tests überschreiben diese Dependency in `backend/tests/conftest.py` standardmäßig auf `admin`.
- Benutzerverwaltung läuft über Admin-Router und Profil/Konten-UI.

## Rollen/Rechte (seit 24.07.2026)

- `Benutzer.rolle` (`standard`/`admin`), additive Spalte in `db.py::_ensure_benutzer_rolle_column`.
- `security.py::is_admin_user(db, username)`: `True` wenn `username == "admin"` (fest) ODER `Benutzer.rolle == "admin"`.
- `admin.py::require_admin` nutzt diesen Helfer statt hartem String-Vergleich.
- `GET /api/auth/me` liefert zusätzlich `ist_admin: bool` — Frontend (`profil.jsx`) liest das statt `currentUser === 'admin'` zu vergleichen.
- Neuer Endpoint `PATCH /api/admin/benutzer/{name}/rolle`.
- Alle anderen Rollen (`lehrer`, `schulleiter`, `sekretariat`, custom) bleiben untereinander gleichberechtigt — es gibt nur die zwei Stufen `standard`/`admin`, keine feineren Abstufungen.
- Die Buchhaltung-„Entwürfe"-Tab ist seit 24.07.2026 für das feste `admin`-Konto ausgeblendet (`screens.jsx::Buchhaltung` TABS-Array, gated auf `currentUser !== 'admin'`, Prop von `app.jsx` durchgereicht) — `admin` legt selbst keine Ausgabe-/Rückgabe-Vorgänge an. Alle anderen Benutzer (`lehrer`, `schulleiter`, `sekretariat`, custom, auch mit `rolle='admin'` beförderte) sehen den Tab weiterhin. Der Inhalt bleibt serverseitig strikt auf `entwurf.bearbeiter == current_user` gefiltert (`verkauf.py::_can_access_entwurf`) — unverändert, auch `admin` hätte ohnehin nie fremde Entwürfe gesehen.

## Deployment- und Betriebswissen

Aus bestehender Doku:

- Serverpfad: `/opt/libera/`.
- Docker Compose wird genutzt.
- Beim Deploy immer `docker compose up -d --build`, da Frontenddateien ins Image kopiert werden.
- Server-`.env` nicht überschreiben.
- Beim rsync `backend/data` ausschließen, außer die DB soll bewusst übertragen werden.

## Aktuell uncommitted beobachtet

Zum Zeitpunkt dieser Datei gab es uncommitted Änderungen in:

- `frontend/app.jsx`
- `frontend/screens.jsx`

Diese gehören zur jüngsten UI-Erweiterung um den Buchhaltung-Entwürfe-Tab und zur Übergabe von `onNav` an `Buchhaltung`.
