# BugFix.md

Log von Sicherheits-/Korrektheitsfixes, die außerhalb des regulären Feature-Findings-Trackers
(`IMPROVEMENTS.md`) entstanden sind — z.B. aus gezielten QA-Durchläufen. Diese Ausgabe fasst
**den gesamten Sessions-Tag (24.07.2026)** zusammen, nicht nur den einen Fund unten.
Details/Fundstellen zu jedem Punkt stehen in `IMPROVEMENTS.md`. Noch **nicht** committed.

## Kritischer Fund des Tages — behoben

### 2026-07-24 — Fehlende Berechtigungsprüfung bei `PATCH /api/einstellungen`

**Gefunden von:** "Error specialist"-QA-Sweep der gesamten laufenden App (Playwright +
direkte API-Aufrufe gegen eine isolierte Test-DB).

**Problem:** `PATCH /api/einstellungen` (`backend/app/routers/einstellungen.py`) prüfte nur,
ob überhaupt ein gültiges Login vorlag (`dependencies=[Depends(get_current_user)]` auf
Router-Ebene in `main.py`), nicht aber die Rolle. Jeder eingeloggte Benutzer — auch mit
`rolle='standard'` — konnte damit:

- die Bank-IBAN/BIC der Schule ändern (Zahlungsziel auf Rechnungen),
- SMTP-Zugangsdaten für den Rechnungsversand überschreiben,
- alle Nutzungsjahr-/Zustand-Abschlagsprozente ändern, die Verkaufs- und
  Rückgabepreise schulweit beeinflussen.

Bestätigt sowohl per direktem API-Call (`schulleiter`, `rolle=standard`,
`PATCH /api/einstellungen` mit geänderter IBAN → `200`, Wert tatsächlich übernommen) als auch
im Browser (Tab „Bankdaten" war für Nicht-Admins voll editierbar inkl. aktivem
„Speichern"-Button).

**Fix:**

- `backend/app/routers/einstellungen.py`: neue lokale Dependency
  `_require_admin_for_settings()` (nutzt `security.py::is_admin_user`), nur auf
  `update_einstellungen` (PATCH) angewendet. `get_einstellungen` (GET) bleibt bewusst offen
  für alle eingeloggten Benutzer — Schulname, Schuljahr etc. werden breit im Frontend gelesen
  (Dashboard, Sidebar, Verkaufs-Screens), das ist unkritisch und soll nicht admin-only sein.
- `frontend/profil.jsx`: „Speichern"-Button ist für Nicht-Admins deaktiviert
  (`disabled={saving || !isAdmin}`) mit erklärendem Tooltip; zusätzlicher Hinweis-Banner
  „Nur Administratoren können diese Einstellungen ändern. Du kannst sie hier einsehen, aber
  nicht speichern." Tabs bleiben für alle sichtbar/lesbar (kein 403 beim bloßen Ansehen).
- Tests: `backend/tests/test_admin_roles.py::TestEinstellungenGating` — Standard-Benutzer
  bekommt 403 auf PATCH, darf aber weiter lesen (GET 200); nach Beförderung zu `rolle='admin'`
  funktioniert PATCH; das feste `admin`-Konto konnte es ohnehin schon.

**Status:** behoben, getestet (83/83 Gesamt-Suite). Live im Browser verifiziert.

## Weitere Fixes heute

### Auszahlen-Endpoint erzeugte keinen Ledger-Eintrag

`POST /api/gutschriften/{id}/auszahlen` setzte nur das `ausgezahlt`-Flag, ohne einen
`Auszahlungen`-Datensatz anzulegen — der Kontostand (Saldo) des Schülers blieb nach einer
Auszahlung fälschlich unverändert. Jetzt wird ein `Auszahlungen`-Eintrag angelegt, Saldo geht
korrekt auf 0, Doppel-Auszahlung wird abgelehnt (422). Zweifach live gegen echte Datenbank bestätigt.

### `frontend/api.ts` war von der Produktions-Datei `api.js` abgekoppelt

`api.ts` ist die Quelle für den TypeScript-Build; `npm run build:frontend` erzeugt daraus `api.js`
neu. `api.ts` fehlten ganze Bereiche (`admin`-Namespace, `benachrichtigungen`, `rechnungen.unarchivieren`)
sowie zwei Funktionsparameter (`buecher.deleteFach`-force, `schueler.archivieren`-buecherBehalten) —
ein Build-Lauf hätte diese Funktionen aus der Produktion gelöscht. Nachgezogen; ein Build erzeugt
jetzt eine byte-identische `api.js`.

### Login gab das rohe JWT zusätzlich im Response-Body zurück

Die Session läuft bereits über ein httpOnly-Cookie (sicher); der Body enthielt trotzdem
`{"access_token": "...", "token_type": "bearer"}` — unnötige Exposition, vom Frontend nie genutzt.
Jetzt: `{"status": "ok"}`.

### Race Condition bei Vorgangs-Entwürfen (Autosave)

Gleichzeitige Aufrufe von `save()` (20s-Debounce) und `saveNow()`/`remove()` für denselben
Schüler+Vorgang konnten zwei Entwürfe statt einem anlegen. Jetzt serialisiert über ein
In-Flight-Promise pro Entwurfsschlüssel. Bestätigt über echte UI-Klicks: Buchausgabe → Buch in
Warenkorb → Abbrechen → genau ein Entwurf, "Entwurf wird gespeichert..."-Toast erscheint korrekt.

### ID-Generierung ohne Kollisions-Schutz (eingeschränkt behoben)

`generate_schueler_id`/`generate_buch_id`/`generate_lernmaterial_id` konnten unter seltener
Gleichzeitigkeit dieselbe ID liefern und mit einem hässlichen 500er abbrechen. Neuer Helfer
`with_id_retry()` versucht bei einer Kollision automatisch mit frischer ID erneut — eingebaut in
die drei einfachen Einzel-Anlegen-Endpunkte (Schüler, Buch, Lernmaterial). Bewusst NICHT in den
CSV-Import-Schleifen oder in `verkauf.py`s Rechnungs-/Gutschrift-IDs (dort würde ein Rollback zu
viel mit zurücknehmen bzw. hängt an einer noch offenen Architekturfrage zur SQLite-Nebenläufigkeit).

## Neues Feature: Rollen-/Rechtesystem (auf Wunsch, bewusst einfach)

- `Benutzer` hat jetzt `rolle` (`standard`/`admin`). Jeder Benutzer kann über Profil → Einstellungen
  → Konten (oder `PATCH /api/admin/benutzer/{name}/rolle`) zum Admin befördert/zurückgestuft werden —
  das feste `admin`-Konto ist weiterhin immer Admin.
- `/api/auth/me` liefert zusätzlich `ist_admin`; Frontend nutzt das statt eines hartcodierten
  `currentUser === 'admin'`-Vergleichs.
- Konten-Tab zeigt Rollen-Badge + Umschalt-Button je Benutzer, Anlegen-Formular hat Checkbox
  „Admin-Rechte geben".
- Bewusst keine feineren Rollen-Abstufungen (z.B. „lehrer darf X nicht") — dafür gibt es keine
  Produktvorgabe.
- Genau dieser neue `is_admin_user()`-Helfer ist es, der auch den kritischen Fund oben
  (`PATCH /api/einstellungen`) reparierbar gemacht hat.

### Entwürfe-Tab: sichtbar für alle außer dem festen `admin`-Konto

Auf Wunsch angepasst: das feste `admin`-Konto legt selbst keine Ausgabe-/Rückgabe-Vorgänge an,
sieht den Tab daher nicht mehr. Alle anderen Benutzer (auch mit `rolle='admin'` beförderte) sehen
ihn weiterhin. Die Trennung „jeder sieht nur seine eigenen Entwürfe" war bereits serverseitig
korrekt implementiert (`_can_access_entwurf`: exakt `bearbeiter == aktueller Benutzer`, keine
Ausnahme) und wurde nicht verändert.

## Gefunden, aber noch NICHT behoben

### 🟡 Teilstornierte Rechnungspositionen sind für Büropersonal nicht unterscheidbar

Bei einer teilstornierten Rechnung zeigt `GET /api/rechnungen/{id}` weiterhin alle
Buchpositionen, ohne zu markieren, welche bereits zurückgenommen wurde. Der Storno-Dialog lässt
dadurch eine bereits stornierte Position erneut auswählen; das Backend lehnt einen erneuten Storno
zwar korrekt ab (kein Datenfehler, kein Doppel-Storno möglich), aber mit einer allgemeinen
Fehlermeldung statt einer klaren Markierung im Dialog selbst. Kein Geld-/Bestandsfehler — reine
UX-Lücke. Nicht behoben, siehe `IMPROVEMENTS.md` (Abschnitt „Mittel") für Details und Fundstellen.

### PDF-Erzeugung in der lokalen Testumgebung nicht prüfbar

WeasyPrint ist in dieser Sandbox ohne die nötigen Systembibliotheken (Pango/Cairo) installiert —
Python-Import funktioniert, `write_pdf()` schlägt mit `OSError` fehl, wird vom Code korrekt zu
einem 501 abgefangen (kein Absturz). Tatsächliche PDF-Korrektheit müsste im echten
Docker-Deployment geprüft werden, wo diese Bibliotheken laut Dockerfile vorhanden sind.

## Tests

`cd backend && uv run pytest -q` → **83 passed**. Frontend: `npm run build:frontend` +
gezielter `tsc`-JSX-Parse-Check auf allen geänderten `.jsx`-Dateien → keine Fehler.

Alles wurde zusätzlich live gegen eine **isolierte Test-Datenbank** verifiziert (Backend-API per
curl + echter Chromium-Browser per Playwright) — die echten Datenbanken (`backend/data/`,
root-`data/`) wurden zu keinem Zeitpunkt angefasst.
