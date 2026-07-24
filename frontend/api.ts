// api.ts - thin fetch() wrapper for the Schulbuch-Verwaltung backend

type ApiRequestOptions = Omit<RequestInit, 'body' | 'headers'> & {
  body?: unknown;
  headers?: Record<string, string>;
};

const API_BASE = '/api';

async function req<T>(path: string, opts: ApiRequestOptions = {}): Promise<T> {
  const { body, headers: optionHeaders, ...fetchOptions } = opts;
  const isFormData = body instanceof FormData;
  const headers = { ...(optionHeaders || {}) };
  if (!isFormData && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(API_BASE + path, {
    ...fetchOptions,
    credentials: 'include',
    headers,
    body: body == null
      ? undefined
      : (isFormData || typeof body === 'string'
        ? body as BodyInit
        : JSON.stringify(body)),
  });

  if (res.status === 401) {
    window.dispatchEvent(new Event('unauthorized'));
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(extractErrorMessage(err, res.status));
  }

  if (res.status === 204) {
    return null as T;
  }

  return res.json() as Promise<T>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function extractErrorMessage(err: unknown, status: number): string {
  if (!isRecord(err)) return `HTTP ${status}`;

  if (isRecord(err.error)) {
    const nestedMessage = getString(err.error, 'message');
    if (nestedMessage) return nestedMessage;
  }

  const detail = getString(err, 'detail');
  if (detail) {
    return detail;
  }

  if (isRecord(err.detail)) {
    if (isRecord(err.detail.error)) {
      const nestedDetailMessage = getString(err.detail.error, 'message');
      if (nestedDetailMessage) return nestedDetailMessage;
    }
  }

  if (Array.isArray(err.detail) && err.detail.length > 0) {
    const first = err.detail[0];
    if (isRecord(first)) {
      const validationMessage = getString(first, 'msg');
      if (validationMessage) return validationMessage;
    }
  }

  const message = getString(err, 'message');
  if (message) {
    return message;
  }

  return `HTTP ${status}`;
}

function qs(params?: Record<string, unknown> | null): string {
  if (!params) return '';
  const entries = Object.entries(params)
    .filter(([, value]) => value != null && value !== '')
    .map(([key, value]) => [key, String(value)] as [string, string]);
  const p = new URLSearchParams(entries);
  return p.toString() ? `?${p}` : '';
}

const api: BibliomatApi = {
  auth: {
    login: async (username, password) => {
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);

      const res = await fetch(API_BASE + '/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(isRecord(err) && typeof err.detail === 'string' ? err.detail : 'Login fehlgeschlagen');
      }
      return res.json() as Promise<{ access_token: string; token_type: string }>;
    },
    me: () => req('/auth/me'),
    logout: () => req('/auth/logout', { method: 'POST' }),
  },

  schueler: {
    list: (params) => req(`/schueler${qs(params)}`),
    get: (id) => req(`/schueler/${id}`),
    vorgaenge: (id) => req(`/schueler/${id}/vorgaenge`),
    aktiveBuecher: (id, params) => req(`/schueler/${id}/aktive-buecher${qs(params)}`),
    create: (data) => req('/schueler', { method: 'POST', body: data }),
    update: (id, data) => req(`/schueler/${id}`, { method: 'PATCH', body: data }),
    remove: (id) => req(`/schueler/${id}`, { method: 'DELETE' }),
    archivKandidaten: (monate) => req(`/schueler/archiv-kandidaten${qs({ monate })}`),
    archivieren: (ids) => req('/schueler/archivieren', { method: 'POST', body: { schueler_ids: ids } }),
    archiv: () => req('/schueler/archiv'),
    reaktivieren: (id) => req(`/schueler/${id}/reaktivieren`, { method: 'POST' }),
    importCsvPreview: (file) => {
      const fd = new FormData();
      fd.append('file', file);
      return req('/schueler/import/csv/preview', { method: 'POST', body: fd });
    },
    importCsv: (rows) => req('/schueler/import/csv', { method: 'POST', body: { rows } }),
  },

  buecher: {
    list: (params) => req(`/buecher${qs(params)}`),
    listFaecher: () => req('/buecher/faecher'),
    createFach: (name) => req('/buecher/faecher', { method: 'POST', body: { name } }),
    deleteFach: (name) => req(`/buecher/faecher/${encodeURIComponent(name)}`, { method: 'DELETE' }),
    get: (id) => req(`/buecher/${id}`),
    create: (data) => req('/buecher', { method: 'POST', body: data }),
    update: (id, data) => req(`/buecher/${id}`, { method: 'PATCH', body: data }),
    remove: (id) => req(`/buecher/${id}`, { method: 'DELETE' }),
    renameFach: (alt, neu) => req('/buecher/fach/umbenennen', { method: 'POST', body: { alt, neu } }),
    importCsv: (file) => {
      const fd = new FormData();
      fd.append('file', file);
      return req('/buecher/import/csv', { method: 'POST', body: fd });
    },
  },

  lernmaterial: {
    list: (params) => req(`/lernmaterial${qs(params)}`),
    listKategorien: () => req('/lernmaterial/kategorien'),
    createKategorie: (name) => req('/lernmaterial/kategorien', { method: 'POST', body: { name } }),
    deleteKategorie: (name) => req(`/lernmaterial/kategorien/${encodeURIComponent(name)}`, { method: 'DELETE' }),
    get: (id) => req(`/lernmaterial/${id}`),
    create: (data) => req('/lernmaterial', { method: 'POST', body: data }),
    update: (id, data) => req(`/lernmaterial/${id}`, { method: 'PATCH', body: data }),
    restock: (id, bestand_gesamt) => req(`/lernmaterial/${id}/restock`, { method: 'POST', body: { bestand_gesamt } }),
    remove: (id) => req(`/lernmaterial/${id}`, { method: 'DELETE' }),
    renameKategorie: (alt, neu) => req('/lernmaterial/kategorie/umbenennen', { method: 'POST', body: { alt, neu } }),
    importCsv: (file) => {
      const fd = new FormData();
      fd.append('file', file);
      return req('/lernmaterial/import/csv', { method: 'POST', body: fd });
    },
  },

  freiposten: {
    vorlagen: () => req('/freiposten/vorlagen'),
    createVorlage: (data) => req('/freiposten/vorlagen', { method: 'POST', body: data }),
    deleteVorlage: (id) => req(`/freiposten/vorlagen/${id}`, { method: 'DELETE' }),
  },

  verkauf: (data) => req('/verkauf', { method: 'POST', body: data }),
  rechnung: {
    list: (params) => req(`/rechnungen${qs(params)}`),
    get: (id) => req(`/rechnungen/${id}`),
    pdf: (id) => `${API_BASE}/rechnungen/${id}/pdf`,
    html: (id) => `${API_BASE}/rechnungen/${id}/html`,
    mailVorlage: (id) => req(`/rechnungen/${id}/mail-vorlage`),
    mailVorschau: (id, data) => req(`/rechnungen/${id}/mail-vorschau`, { method: 'POST', body: data }),
    mailSenden: (id, data) => req(`/rechnungen/${id}/mail`, { method: 'POST', body: data }),
    storno: (id, data) => req(`/rechnungen/${id}/storno`, { method: 'POST', body: data }),
    entwuerfe: () => req('/rechnungen/entwuerfe'),
    entwurf: (id) => req(`/rechnungen/entwuerfe/${id}`),
    createEntwurf: (data) => req('/rechnungen/entwuerfe', { method: 'POST', body: data }),
    updateEntwurf: (id, data) => req(`/rechnungen/entwuerfe/${id}`, { method: 'PATCH', body: data }),
    deleteEntwurf: (id) => req(`/rechnungen/entwuerfe/${id}`, { method: 'DELETE' }),
    updateAnzeigeNr: (id, data) => req(`/rechnungen/${id}/anzeige-nr`, { method: 'PATCH', body: data }),
  },

  gutschrift: (data) => req('/gutschrift', { method: 'POST', body: data }),
  gutschriften: {
    get: (id) => req(`/gutschriften/${id}`),
    pdf: (id) => `${API_BASE}/gutschriften/${id}/pdf`,
    html: (id) => `${API_BASE}/gutschriften/${id}/html`,
    auszahlen: (id) => req(`/gutschriften/${id}/auszahlen`, { method: 'POST' }),
  },

  zahlungen: {
    create: (data) => req('/zahlungen', { method: 'POST', body: data }),
    update: (id, data) => req(`/zahlungen/${id}`, { method: 'PATCH', body: data }),
    remove: (id) => req(`/zahlungen/${id}`, { method: 'DELETE' }),
    list: (schueler_id) => req(`/zahlungen${qs({ schueler_id })}`),
  },

  auszahlungen: {
    create: (data) => req('/auszahlungen', { method: 'POST', body: data }),
    remove: (id) => req(`/auszahlungen/${id}`, { method: 'DELETE' }),
    html: (id) => `${API_BASE}/auszahlungen/${id}/html`,
    pdf: (id) => `${API_BASE}/auszahlungen/${id}/pdf`,
  },

  buchhaltung: {
    schuljahre: () => req('/buchhaltung/schuljahre'),
    rechnungen: (schuljahr) => req(`/buchhaltung/rechnungen?schuljahr=${encodeURIComponent(schuljahr)}`),
    alleRechnungen: () => req('/buchhaltung/rechnungen'),
    unversandt: () => req('/buchhaltung/unversandt'),
    versandt: () => req('/buchhaltung/versandt'),
  },

  dashboard: () => req('/dashboard'),

  klassenversetzung: {
    vorschau: () => req('/klassenversetzung/vorschau'),
    ausfuehren: (versetzungen) => req('/klassenversetzung/ausfuehren', { method: 'POST', body: { versetzungen } }),
  },

  einstellungen: {
    get: () => req('/einstellungen'),
    update: (data) => req('/einstellungen', { method: 'PATCH', body: data }),
  },

  health: () => req('/health'),
};

window.api = api;

window.CONSTANTS = {
  KLASSEN: ['6', '7', '8', '9', '10', '11', '12'],
  FAECHER: ['Mathematik', 'Deutsch', 'Englisch', 'Französisch', 'Latein', 'Biologie', 'Chemie', 'Physik', 'Geschichte', 'Erdkunde', 'Sozialwissenschaften', 'Religion', 'Philosophie', 'Kunst', 'Musik', 'Sport', 'Informatik', 'Spanisch'],
  LERNMATERIAL_KATEGORIEN: ['Hefter', 'Taschenrechner', 'Formelsammlung', 'Lineal', 'Zirkel', 'Tintenkiller', 'Sonstiges'],
};
