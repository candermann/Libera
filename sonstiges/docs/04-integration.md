# 04 · Frontend-Integration

Das vorhandene Frontend ist ein React-Prototyp (Babel-im-Browser, kein Build-Tool). Aktuell arbeitet es mit Mock-Daten aus `data.jsx`. Anbindung ans Backend in 4 Schritten.

## Schritt 1 · Mock-Schicht durch API-Client ersetzen

Lege `api.jsx` neu an:

```js
// api.jsx — dünner Wrapper um fetch()
const API_BASE = '/api';   // beim deploy ggf. absolute URL

async function req(path, opts = {}) {
  const res = await fetch(API_BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

window.api = {
  schueler: {
    list:       (params)       => req(`/schueler${qs(params)}`),
    get:        (id)           => req(`/schueler/${id}`),
    vorgaenge:  (id)           => req(`/schueler/${id}/vorgaenge`),
    aktiveBuecher: (id)        => req(`/schueler/${id}/aktive-buecher`),
    create:     (data)         => req('/schueler', { method: 'POST', body: data }),
    update:     (id, data)     => req(`/schueler/${id}`, { method: 'PATCH', body: data }),
    remove:     (id)           => req(`/schueler/${id}`, { method: 'DELETE' }),
  },
  buecher: {
    list:   (params) => req(`/buecher${qs(params)}`),
    create: (data)   => req('/buecher', { method: 'POST', body: data }),
    update: (id, d)  => req(`/buecher/${id}`, { method: 'PATCH', body: d }),
    remove: (id)     => req(`/buecher/${id}`, { method: 'DELETE' }),
  },
  verkauf:    (data) => req('/verkauf',    { method: 'POST', body: data }),
  gutschrift: (data) => req('/gutschrift', { method: 'POST', body: data }),
  rechnung: {
    pdf:  (id) => `${API_BASE}/rechnungen/${id}/pdf`,   // direkt als <a href>
    html: (id) => `${API_BASE}/rechnungen/${id}/html`,
  },
  gutschriften: {
    pdf:  (id) => `${API_BASE}/gutschriften/${id}/pdf`,
    html: (id) => `${API_BASE}/gutschriften/${id}/html`,
  },
  mahnungen: {
    list: () => req('/mahnungen'),
  },
  dashboard: () => req('/dashboard'),
};

function qs(params) {
  if (!params) return '';
  const p = new URLSearchParams(Object.entries(params).filter(([,v]) => v != null && v !== ''));
  return p.toString() ? `?${p}` : '';
}
```

In `Schulbuch-Verwaltung.html` einfügen, **vor** den anderen Babel-Scripts:
```html
<script type="text/babel" src="api.jsx"></script>
```

## Schritt 2 · Listen umstellen

Beispiel `screens.jsx`, `SchuelerListe`:

```diff
-function SchuelerListe({ accent, onOpenStudent }) {
-  const { SCHUELER: INITIAL, KLASSEN, getKonto } = window.SCHULBUCH_DATA;
-  const [students, setStudents] = React.useState(INITIAL);
+function SchuelerListe({ accent, onOpenStudent }) {
+  const [students, setStudents] = React.useState([]);
+  const [klassen, setKlassen] = React.useState([]);
+  const [total, setTotal] = React.useState(0);
   const [query, setQuery] = React.useState('');
   const [klasseFilter, setKlasseFilter] = React.useState('');
   ...
+
+  React.useEffect(() => {
+    let cancelled = false;
+    api.schueler.list({ q: query, klasse: klasseFilter, limit: 50 })
+      .then(r => { if (!cancelled) { setStudents(r.items); setTotal(r.total); } })
+      .catch(console.error);
+    return () => { cancelled = true; };
+  }, [query, klasseFilter]);
```

Saldo kommt jetzt direkt vom Server (`item.saldo_cents`):
```diff
-const konto = getKonto(s.id);
-const saldo = konto.saldo;
+const saldo = s.saldo_cents / 100;
```

Klassen-Liste kann beim Mount geladen oder hardcoded bleiben (sie ändert sich selten):
```js
const KLASSEN = ['5a','5b','5c','6a','6b','6c','7a','7b','7c','8a','8b','8c','9a','9b','9c','10a','10b','10c','EF','Q1','Q2'];
```

## Schritt 3 · Detailseite

`schueler-detail.jsx`:
```diff
-function SchuelerDetail({ schueler, accent, onBack, onNav }) {
-  const { getKonto, BUECHER } = window.SCHULBUCH_DATA;
-  const konto = getKonto(schueler.id);
-  const aktiveBuecher = ...mock...
+function SchuelerDetail({ schueler, accent, onBack, onNav }) {
+  const [konto, setKonto] = React.useState({ saldo_cents: 0, vorgaenge: [] });
+  const [aktiveBuecher, setAktiveBuecher] = React.useState([]);
+  React.useEffect(() => {
+    Promise.all([
+      api.schueler.vorgaenge(schueler.id),
+      api.schueler.aktiveBuecher(schueler.id),
+    ]).then(([v, b]) => {
+      setKonto({ saldo_cents: schueler.saldo_cents, vorgaenge: v.items });
+      setAktiveBuecher(b.items);
+    });
+  }, [schueler.id]);
```

## Schritt 4 · Verkauf & Rückgabe

Im Verkaufs-Flow (`verkauf.jsx`), beim "Rechnung erstellen"-Button:

```diff
-onClick={() => { /* Mock: PDF generieren mit buildDocumentHTML() */ }}
+onClick={async () => {
+  const r = await api.verkauf({
+    schueler_id: selectedStudent.id,
+    buch_ids: cart.map(b => b.id),
+    guthaben_verrechnen: useGuthaben,
+  });
+  // PDF aus Server holen — entweder neuen Tab oder direkter Print:
+  window.open(api.rechnung.pdf(r.id), '_blank');
+  onDone();
+}}
```

Analog im Rückgabe-Flow für `api.gutschrift({...})`.

## Schritt 5 · `data.jsx` reduzieren

Mock-Daten kannst du **komplett löschen**, sobald alle Screens am Backend hängen.
Behalten: `KLASSEN`, `FAECHER` (statisch), `VERLAGE`. Den Rest weg.

## CORS & Deployment

- **Dev**: Frontend per `python -m http.server 5500` direkt aus dem Ordner servieren, Backend lokal auf z.B. Port 8000 mit CORS allow `http://localhost:5500`.
- **Prod**: Backend serviert auch die statischen Frontend-Dateien — kein CORS nötig. Beispiel FastAPI: `app.mount("/", StaticFiles(directory="frontend", html=True))`.

## Testdaten / Seed

Lass den Code-Agent ein `seed.py` (oder `seed.js`) bauen, das:
1. die ~20 Klassen-Codes hartcodiert,
2. ~30 Beispielbücher anlegt,
3. ~50 Beispielschüler anlegt,
4. ~20 Beispiel-Verkäufe und ~5 Gutschriften erzeugt.

So kannst du das Frontend mit echten Daten testen, ohne 1500 Schüler manuell anzulegen.
