# Verbesserungen / Findings — Stand 2026-07-24

Diese Datei trackt die Findings aus dem Code-Review vom 2026-07-24 (Backend + Frontend)
und ihren Umsetzungsstatus. Quelle: paralleler Review von `backend/` und `frontend/`.

Status-Legende: `[ ]` offen · `[~]` in Arbeit · `[x]` erledigt · `[-]` zurückgestellt (Entscheidung nötig)

## Hoch

- [ ] **Auszahlen-Endpoint erzeugt keinen Ledger-Eintrag**
  `backend/app/routers/gutschrift.py:319-332` — `auszahlen_gutschrift` setzt nur
  `ausgezahlt=1`/`ausgezahlt_am`, legt aber anders als `POST /api/auszahlungen` keinen
  `Auszahlungen`-Datensatz an. Auszahlungs-Historie/Reporting sieht diese Auszahlungen nicht.
  Fix: Innerhalb des Handlers einen `Auszahlungen`-Datensatz anlegen, analog zum dedizierten Endpoint.
  Test `backend/tests/test_gutschrift.py:155-169` prüft aktuell nur das Flag, nicht den Ledger-Eintrag —
  Test muss erweitert werden.

- [ ] **`api.ts`/`api.js` sind auseinandergelaufen**
  `frontend/api.ts:244` fehlen ganze Namespaces, die `frontend/api.js` in Produktion nutzt
  (`admin`, `benachrichtigungen`, `rechnungen.unarchivieren`). `npm run build:frontend`
  generiert `api.js` aus `api.ts` neu — ein Build-Lauf könnte diese Endpunkte in Produktion
  stillschweigend löschen. Fix: fehlende Abschnitte in `api.ts` nachziehen.

- [ ] **Kein echtes Rollen-/Rechtesystem**
  `backend/app/models.py:23-27` (`Benutzer`) hat keine Rollenspalte; `admin.py:24-25` prüft
  Admin-Rechte nur über String-Vergleich `current_user != "admin"`. Alle angelegten Benutzer
  sind funktional identisch. Größere Änderung (Schema + UI) — braucht eigene Abstimmung,
  siehe Abschnitt "Zurückgestellt" unten.

- [ ] **`.with_for_update()` ist unter SQLite ein No-Op**
  `backend/app/routers/verkauf.py:441-446` — SQLAlchemy ignoriert `FOR UPDATE` beim SQLite-Dialekt.
  Nebenläufigkeitsschutz beruht komplett auf SQLite-Global-Lock + prozessinternem
  `threading.Lock` in `backend/app/services/ids.py:14`. Bricht bei mehreren Worker-Prozessen.
  Braucht Architekturentscheidung (siehe "Zurückgestellt").

- [ ] **Produktion lädt React-Dev-Build ohne SRI von CDN**
  `frontend/index.html:53-55` — `react.development.js`/`react-dom.development.js` unminified
  von unpkg, kein Integrity-Hash. Fix: production/minified Build self-hosten oder SRI-Hash ergänzen.

## Mittel

- [ ] **Mögliche doppelte Entwurf-Datensätze durch Race Condition**
  `frontend/layout.jsx:59-95` — Autosave (20s Debounce) und `saveNow()` können kollidieren:
  `saveNow()`s `clearTimeout` bricht nur einen noch nicht gestarteten Timer ab, nicht einen
  bereits laufenden `_persist()`-Aufruf. Fix: In-Flight-Promise pro Entwurfsschlüssel, zweiten
  Aufruf daran ketten statt parallel feuern.

- [ ] **Testlücken** — keine Tests für `/api/auth`, `/api/admin`, `/api/klassenversetzung`,
  `/api/buchhaltung`, `/api/benachrichtigungen`, `/api/mahnungen`, `/api/freiposten`.

- [ ] **SMTP-Passwort im Klartext gespeichert** (`einstellungen`-Tabelle) — nur beim Lesen maskiert,
  nicht at-rest verschlüsselt. Bekannter DSGVO-Punkt. Braucht Verschlüsselungsstrategie
  (siehe "Zurückgestellt").

- [ ] **Login gibt rohes JWT zusätzlich im Response-Body zurück**
  `backend/app/routers/auth.py:62-76` — Cookie ist bereits maßgeblich (httpOnly, bereits umgesetzt
  entgegen veraltetem README-Hinweis), Frontend nutzt den Body-Token nicht (kein `localStorage`
  im Frontend gefunden). Fix: Token aus Response-Body entfernen.

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

1. **Rollen-/Rechtesystem**: Welche Rollen soll es geben (z.B. `admin`, `sekretariat`,
   `lehrer` mit unterschiedlichen Rechten)? Schema-Änderung an `Benutzer` nötig.
2. **SQLite-Nebenläufigkeit**: Single-Worker-Deployment explizit dokumentieren/erzwingen,
   oder auf `BEGIN IMMEDIATE`-Transaktionen umstellen?
3. **SMTP-Passwort-Verschlüsselung**: Verschlüsselung at-rest (z.B. mit `SECRET_KEY`
   abgeleitetem Fernet-Key) — braucht Migration bestehender Klartext-Werte.

## Umsetzungs-Reihenfolge (dieser Durchgang)

1. Auszahlen-Ledger-Fix (Backend) + Test erweitern
2. `api.ts`/`api.js`-Drift beheben
3. Rohes JWT aus Login-Response entfernen
4. Autosave-Race-Condition in `layout.jsx` entschärfen
5. ID-Generierung: Kollisions-Retry ergänzen
6. Test-Suite laufen lassen (`uv run pytest`) + gezielter JSX-Parse-Check
7. Manuelle Verifikation im Browser durch spezialisierten Test-Agenten
