export {};

declare global {
  type ApiId = string;
  type ISODateString = string;

  interface ApiListResponse<T> {
    items: T[];
    total?: number;
  }

  interface Schueler {
    id: ApiId;
    vorname: string;
    nachname: string;
    klasse: string;
    strasse?: string | null;
    plz?: string | null;
    ort?: string | null;
    email_eltern?: string | null;
    notizen?: string | null;
    saldo_cents?: number;
  }

  interface BuchZustand {
    bestand_id: number;
    nutzungsjahr: number;
    preis_cents: number;
    bestand_verfuegbar: number;
  }

  interface Buch {
    id: ApiId;
    titel: string;
    fach: string;
    stufe?: number | null;
    verlag?: string | null;
    isbn?: string | null;
    preis_cents: number;
    schutzgebuehr_cents?: number;
    bestand_gesamt?: number;
    bestand_ausgegeben?: number;
    zustaende?: BuchZustand[];
  }

  interface Lernmaterial {
    id: ApiId;
    name: string;
    kategorie: string;
    preis_cents: number;
    bestand_gesamt: number;
    bestand_ausgegeben?: number;
  }

  interface Rechnung {
    id: ApiId;
    schueler_id: ApiId;
    datum: ISODateString;
    schuljahr: string;
    summe_cents: number;
    verrechnet_cents?: number;
    status?: string;
    mail_versandt_am?: string | null;
  }

  interface Gutschrift {
    id: ApiId;
    schueler_id: ApiId;
    datum: ISODateString;
    schuljahr: string;
    summe_cents: number;
    ausgezahlt?: boolean;
    ausgezahlt_am?: string | null;
  }

  interface Zahlung {
    id: number;
    schueler_id: ApiId;
    rechnung_id?: ApiId | null;
    datum: ISODateString;
    betrag_cents: number;
    notizen?: string | null;
  }

  interface Auszahlung {
    id: number;
    schueler_id: ApiId;
    datum: ISODateString;
    betrag_cents: number;
    notizen?: string | null;
  }

  interface RechnungMailPreview {
    to_email?: string;
    subject: string;
    body: string;
  }

  interface PrintDocumentStudent {
    id: string;
    name: string;
    klasse: string;
    strasse?: string | null;
    plz?: string | null;
    ort?: string | null;
  }

  interface PrintDocumentPosten {
    titel: string;
    verlag?: string | null;
    isbn?: string | null;
    betrag: number;
  }

  interface PrintDocumentData {
    titel: string;
    rechnungsNr: string;
    datum: string;
    student: PrintDocumentStudent;
    posten: PrintDocumentPosten[];
    total: number;
    typ: 'rechnung' | 'gutschrift';
  }

  interface OpenProtectedDocumentOptions {
    addPreviewChrome?: boolean;
  }

  interface BibliomatApi {
    auth: {
      login(username: string, password: string): Promise<{ access_token: string; token_type: string }>;
    };
    schueler: {
      list(params?: Record<string, unknown>): Promise<ApiListResponse<Schueler>>;
      get(id: ApiId): Promise<Schueler>;
      vorgaenge(id: ApiId): Promise<ApiListResponse<unknown>>;
      aktiveBuecher(id: ApiId): Promise<ApiListResponse<unknown>>;
      create(data: Partial<Schueler>): Promise<Schueler>;
      update(id: ApiId, data: Partial<Schueler>): Promise<Schueler>;
      remove(id: ApiId): Promise<null>;
      archivKandidaten(monate: number): Promise<unknown>;
      archivieren(ids: ApiId[]): Promise<unknown>;
      archiv(): Promise<ApiListResponse<Schueler>>;
      reaktivieren(id: ApiId): Promise<unknown>;
      importCsvPreview(file: File): Promise<unknown>;
      importCsv(rows: unknown[]): Promise<unknown>;
    };
    buecher: {
      list(params?: Record<string, unknown>): Promise<ApiListResponse<Buch>>;
      get(id: ApiId): Promise<Buch>;
      create(data: Partial<Buch>): Promise<Buch>;
      update(id: ApiId, data: Partial<Buch>): Promise<Buch>;
      remove(id: ApiId): Promise<null>;
      importCsv(file: File): Promise<unknown>;
    };
    lernmaterial: {
      list(params?: Record<string, unknown>): Promise<ApiListResponse<Lernmaterial>>;
      get(id: ApiId): Promise<Lernmaterial>;
      create(data: Partial<Lernmaterial>): Promise<Lernmaterial>;
      update(id: ApiId, data: Partial<Lernmaterial>): Promise<Lernmaterial>;
      remove(id: ApiId): Promise<null>;
      importCsv(file: File): Promise<unknown>;
    };
    freiposten: {
      vorlagen(): Promise<unknown[]>;
      createVorlage(data: unknown): Promise<unknown>;
      deleteVorlage(id: number): Promise<null>;
    };
    verkauf(data: unknown): Promise<Rechnung>;
    rechnung: {
      list(params?: Record<string, unknown>): Promise<ApiListResponse<Rechnung>>;
      get(id: ApiId): Promise<Rechnung>;
      pdf(id: ApiId): string;
      html(id: ApiId): string;
      mailVorlage(id: ApiId): Promise<RechnungMailPreview>;
      mailVorschau(id: ApiId, data: unknown): Promise<RechnungMailPreview>;
      mailSenden(id: ApiId, data: unknown): Promise<unknown>;
      storno(id: ApiId): Promise<unknown>;
    };
    gutschrift(data: unknown): Promise<Gutschrift>;
    gutschriften: {
      get(id: ApiId): Promise<Gutschrift>;
      pdf(id: ApiId): string;
      html(id: ApiId): string;
      auszahlen(id: ApiId): Promise<unknown>;
    };
    zahlungen: {
      create(data: Partial<Zahlung>): Promise<Zahlung>;
      update(id: number, data: Partial<Zahlung>): Promise<Zahlung>;
      remove(id: number): Promise<null>;
      list(schueler_id: ApiId): Promise<ApiListResponse<Zahlung>>;
    };
    auszahlungen: {
      create(data: Partial<Auszahlung>): Promise<Auszahlung>;
      remove(id: number): Promise<null>;
      html(id: number): string;
      pdf(id: number): string;
    };
    buchhaltung: {
      schuljahre(): Promise<ApiListResponse<unknown>>;
      rechnungen(schuljahr: string): Promise<ApiListResponse<Rechnung>>;
      unversandt(): Promise<ApiListResponse<Rechnung>>;
      versandt(): Promise<ApiListResponse<Rechnung>>;
    };
    dashboard(): Promise<unknown>;
    klassenversetzung: {
      vorschau(): Promise<unknown>;
      ausfuehren(versetzungen: unknown[]): Promise<unknown>;
    };
    einstellungen: {
      get(): Promise<Record<string, string>>;
      update(data: Record<string, string>): Promise<Record<string, string>>;
    };
    health(): Promise<{ status: string; version: string }>;
  }

  interface Window {
    api: BibliomatApi;
    CONSTANTS: {
      KLASSEN: string[];
      FAECHER: string[];
      LERNMATERIAL_KATEGORIEN: string[];
    };
    buildDocumentHTML(data: PrintDocumentData): string;
    openPrintWindow(html: string, autoPrint?: boolean): void;
    openProtectedDocument(path: string, autoPrint?: boolean, options?: OpenProtectedDocumentOptions): Promise<void>;
    downloadAsHTMLFile(html: string, filename: string): void;
    showToast(type: 'success' | 'error' | 'info' | 'warning', message: string): void;
  }
}
