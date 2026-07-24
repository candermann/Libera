# Verbesserungen / Findings — Stand 2026-07-24

Diese Datei trackt die Findings aus dem Code-Review vom 2026-07-24 (Backend + Frontend)
und ihren Umsetzungsstatus. Quelle: paralleler Review von `backend/` und `frontend/`.

Status-Legende: `[ ]` offen · `[~]` in Arbeit · `[x]` erledigt · `[-]` zurückgestellt (Entscheidung nötig)

## Hoch

- [x] **Auszahlen-Endpoint erzeugt keinen Ledger-Eintrag — behoben (24.07.2026).**
  `backend/app/routers/gutschrift.py` legt jetzt einen `Auszahlungen`-Datensatz an,
  analog zum dedizierten Endpoint. Test `backend/tests/test_gutschrift.py` erweitert,
  prüft jetzt Saldo-Reduktion und Ledger-Eintrag, nicht nur das Flag.

- [x] **`api.ts`/`api.js` waren auseinandergelaufen — behoben (24.07.2026).**
  Fehlende Abschnitte (`admin`, `benachrichtigungen`, `rechnungen.unarchivieren`,
  `buecher.deleteFach`-force-Parameter, `schueler.archivieren`-buecherBehalten-Parameter)
  in `api.ts` nachgezogen. `npm run build:frontend` reproduziert `api.js` jetzt byte-identisch.

- [x] **Kein echtes Rollen-/Rechtesystem — behoben (24.07.2026), bewusst einfach gehalten.**
  `Benutzer` hat jetzt eine `rolle`-Spalte (`standard`/`admin`, additive Migration in
  `db.py::_ensure_benutzer_rolle_column`). `require_admin` (`admin.py`) und `/api/auth/me`
  nutzen den neuen Helfer `security.py::is_admin_user()`: Zugriff, wenn `current_user == "admin"`
  ODER der zugehörige `Benutzer`-Datensatz `rolle = 'admin'` hat. Neuer Endpoint
  `PATCH /api/admin/benutzer/{name}/rolle`. Frontend: `profil.jsx` liest `ist_admin` jetzt aus
  `/api/auth/me` statt `currentUser === 'admin'` hart zu vergleichen; Konten-Tab zeigt
  Rollen-Badge + Umschalt-Button pro Benutzer, Anlegen-Formular hat Checkbox "Admin-Rechte geben".
  Bewusst NICHT gebaut: feinere Rollen-Abstufungen (z.B. "lehrer darf X nicht") — dafür gibt es
  keine Produktvorgabe; alle Nicht-Admin-Rollen bleiben wie bisher gleichberechtigt ("standard").
  Tests: `backend/tests/test_admin_roles.py`. Live im Browser verifiziert (Promote/Demote,
  Server-seitige 403-Durchsetzung, nicht nur UI-Verstecken).

- [ ] **`.with_for_update()` ist unter SQLite ein No-Op**
  `backend/app/routers/verkauf.py:441-446` — SQLAlchemy ignoriert `FOR UPDATE` beim SQLite-Dialekt.
  Nebenläufigkeitsschutz beruht komplett auf SQLite-Global-Lock + prozessinternem
  `threading.Lock` in `backend/app/services/ids.py:14`. Bricht bei mehreren Worker-Prozessen.
  Braucht Architekturentscheidung (siehe "Zurückgestellt").

- [ ] **Produktion lädt React-Dev-Build ohne SRI von CDN**
  `frontend/index.html:53-55` — `react.development.js`/`react-dom.development.js` unminified
  von unpkg, kein Integrity-Hash. Fix: production/minified Build self-hosten oder SRI-Hash ergänzen.

- [x] **`PATCH /api/einstellungen` war für jeden eingeloggten Benutzer offen — behoben (24.07.2026).**
  Gefunden durch QA-Sweep ("error specialist" Agent): jeder eingeloggte Benutzer (auch `rolle='standard'`)
  konnte Bank-IBAN/BIC, SMTP-Zugangsdaten und alle Preis-/Abschlag-Prozentsätze überschreiben —
  weder Backend (`einstellungen.py`, nur `Depends(get_current_user)`) noch Frontend (`profil.jsx`,
  Schule/Bankdaten/E-Mail-Tabs waren nicht auf `isAdmin` gated) haben das verhindert. Live bestätigt:
  `schulleiter` (Standard-Rolle) konnte per API die IBAN ändern.
  Fix: `_require_admin_for_settings` in `einstellungen.py`, nur auf PATCH (GET bleibt für alle
  lesbar). Frontend: globaler „Speichern"-Button deaktiviert + Hinweisbanner für Nicht-Admins,
  Felder bleiben sichtbar (nur zur Ansicht). Tests: `backend/tests/test_admin_roles.py::TestEinstellungenGating`.
  Live im Browser verifiziert.

## Mittel

- [x] **Mögliche doppelte Entwurf-Datensätze durch Race Condition — behoben (24.07.2026).**
  `frontend/layout.jsx` `_persist()` chained jetzt auf ein `pending[key]`-Promise pro
  Entwurfsschlüssel; `remove()` wartet ebenfalls auf einen laufenden Persist, bevor gelöscht wird.
  Live im Browser bestätigt (3 parallele `saveNow()` + 1 debounced `save()` auf demselben Schlüssel
  → genau 1 Server-Entwurf), zusätzlich über echte UI-Klicks (Buchausgabe → Artikel hinzufügen →
  Abbrechen) erneut bestätigt.

- [ ] **Testlücken** — keine Tests für `/api/klassenversetzung`, `/api/buchhaltung`,
  `/api/benachrichtigungen`, `/api/mahnungen`, `/api/freiposten`. (`/api/auth` und `/api/admin`
  haben inzwischen Tests über `test_admin_roles.py`.)

- [ ] **SMTP-Passwort im Klartext gespeichert** (`einstellungen`-Tabelle) — nur beim Lesen maskiert,
  nicht at-rest verschlüsselt. Bekannter DSGVO-Punkt. Braucht Verschlüsselungsstrategie
  (siehe "Zurückgestellt").

- [x] **Login gab rohes JWT zusätzlich im Response-Body zurück — behoben (24.07.2026).**
  `backend/app/routers/auth.py` gibt jetzt nur `{"status":"ok"}` zurück; Cookie ist maßgeblich.

- [ ] **Teilstornierte Rechnungspositionen sind in der API/UI nicht unterscheidbar.**
  Gefunden durch QA-Sweep: `RechnungsPostenResponse` (`schemas.py:348-353`) hat kein
  `zurueckgegeben`/storniert-Feld; `GET /api/rechnungen/{id}` (`verkauf.py:938-960`) gibt
  bei Teilstorno weiterhin ALLE Positionen unverändert zurück. `StornoDialog`
  (`screens.jsx:2890`) rendert deshalb bereits stornierte Positionen als normal auswählbar;
  ein erneuter Storno-Versuch wird vom Backend korrekt mit 422 abgelehnt (kein Datenfehler,
  kein Doppel-Storno möglich), aber der Fehler ist generisch ("Mindestens eine Position ist
  bereits zurueckgegeben oder behalten") und nennt nicht, welche Position gemeint ist — für
  das Büro verwirrend bei mehrfachen Teilstornos derselben Rechnung. Saldo/Vorgangs-Historie/
  Schülerdetail sind NICHT betroffen (andere, korrekte Queries). Noch offen.

- [x] **ID-Generierung ohne Kollisions-Retry** — behoben, bewusst eingeschränkt umgesetzt.
  `backend/app/services/ids.py` hat jetzt `with_id_retry()`, das bei einem
  Primärschlüssel-Kollisionsfehler (`IntegrityError`) zurückrollt und mit frisch
  generierter ID neu versucht (bis zu 5 Versuche). Eingebaut in die drei einfachen,
  einzeiligen Create-Endpunkte: `schueler.py::create_schueler`,
  `buecher.py::create_buch`, `lernmaterial.py::create_lernmaterial`.
  Bewusst **nicht** in den CSV-Import-Schleifen (`buecher.py:650`, `lernmaterial.py:331`)
  eingebaut, da dort ein Rollback auch bereits erfolgreich verarbeitete frühere Zeilen
  derselben Import-Transaktion mit zurückrollen würde. Ebenso nicht in
  `verkauf.py` (Rechnungs-/Gutschrift-ID mitten in einer mehrzeiligen
  Verkaufs-Transaktion) — das braucht die separate Architekturentscheidung zur
  SQLite-Nebenläufigkeit (siehe "Zurückgestellt"). Test: `backend/tests/test_ids.py`
  simuliert die Kollision direkt gegen eine echte SQLite-DB.

## Niedrig

- [ ] Große Dateien mit mehreren Konzernen: `backend/app/routers/verkauf.py` (1316 Zeilen),
  `backend/app/routers/buecher.py` (896 Zeilen), `frontend/screens.jsx` (3472 Zeilen),
  `frontend/verkauf.jsx` (1783 Zeilen). Kandidaten für Aufteilung, nicht dringend.
- [ ] `einstellungen.py:63-64` PATCH akzeptiert beliebiges Dict; sensible Keys werden per
  Substring-Denyliste (`_is_sensitive_key`, Zeile 29) gefiltert — fragil bei neuen Keynamen.
- [x] **Stale Doku-Hinweis behoben** — `CODEBASE_KNOWLEDGE.md` behauptete uncommitted Changes in
  `app.jsx`/`screens.jsx`; `git status` war zum Review-Zeitpunkt sauber (letzter Commit
  `430179c StornoTab001`).

## Bestätigte Nicht-Probleme (im Review geprüft, keine Aktion nötig)

- Kein `dangerouslySetInnerHTML` im Frontend.
- Kein JWT/Token in `localStorage`/`sessionStorage` — Auth läuft über httpOnly-Cookie.
- Entwürfe-Tab/`onNav`-Verdrahtung (`app.jsx:121-153`, `screens.jsx:1866-1920`) vollständig und konsistent.
- `index.html` Cache-Busting-Versionsnummern sind an jedem Script-Tag vorhanden, kein erkennbarer Drift.
- Dependencies in `pyproject.toml` aktuell.

## Zurückgestellt — brauchen Produktentscheidung vor Umsetzung

Diese Punkte sind größere/architekturelle Änderungen und werden hier nur dokumentiert,
bis eine Entscheidung getroffen wurde:

1. **SQLite-Nebenläufigkeit**: Single-Worker-Deployment explizit dokumentieren/erzwingen,
   oder auf `BEGIN IMMEDIATE`-Transaktionen umstellen?
2. **SMTP-Passwort-Verschlüsselung**: Verschlüsselung at-rest (z.B. mit `SECRET_KEY`
   abgeleitetem Fernet-Key) — braucht Migration bestehender Klartext-Werte.

## Umsetzungs-Reihenfolge (dieser Durchgang)

1. Auszahlen-Ledger-Fix (Backend) + Test erweitern
2. `api.ts`/`api.js`-Drift beheben
3. Rohes JWT aus Login-Response entfernen
4. Autosave-Race-Condition in `layout.jsx` entschärfen
5. ID-Generierung: Kollisions-Retry ergänzen
6. Test-Suite laufen lassen (`uv run pytest`) + gezielter JSX-Parse-Check
7. Manuelle Verifikation im Browser durch spezialisierten Test-Agenten
