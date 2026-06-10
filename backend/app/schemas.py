"""
Pydantic v2 request/response schemas.
"""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field, model_validator


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: Optional[dict] = None


class ErrorResponse(BaseModel):
    error: ErrorDetail


class SchuelerCreate(BaseModel):
    vorname: str
    nachname: str
    klasse: str
    strasse: Optional[str] = None
    plz: Optional[str] = None
    ort: Optional[str] = None
    email_eltern: Optional[str] = None
    notizen: Optional[str] = None


class SchuelerUpdate(BaseModel):
    vorname: Optional[str] = None
    nachname: Optional[str] = None
    klasse: Optional[str] = None
    strasse: Optional[str] = None
    plz: Optional[str] = None
    ort: Optional[str] = None
    email_eltern: Optional[str] = None
    notizen: Optional[str] = None


class KontoSummary(BaseModel):
    saldo_cents: int
    anzahl_aktive_buecher: int
    anzahl_behalten_buecher: int = 0
    anzahl_vorgaenge: int


class SchuelerListItem(BaseModel):
    id: str
    vorname: str
    nachname: str
    klasse: str
    email_eltern: Optional[str] = None
    strasse: Optional[str] = None
    plz: Optional[str] = None
    ort: Optional[str] = None
    erstes_schuljahr: Optional[str] = None
    saldo_cents: int = 0
    letzter_vorgang_datum: Optional[str] = None


class SchuelerListResponse(BaseModel):
    items: list[SchuelerListItem]
    total: int


class ArchivKandidatItem(BaseModel):
    id: str
    vorname: str
    nachname: str
    klasse: str
    saldo_cents: int = 0
    letzter_vorgang_datum: Optional[str] = None
    aktive_buecher: int = 0


class ArchivKandidatenResponse(BaseModel):
    items: list[ArchivKandidatItem]


class ArchivierungRequest(BaseModel):
    schueler_ids: list[str]
    buecher_behalten: bool = False


class ArchiviertItem(BaseModel):
    id: str
    vorname: str
    nachname: str
    klasse: str
    archiviert_am: str
    erstes_schuljahr: Optional[str] = None
    schuljahr: str = ""
    saldo_cents: int = 0
    letzter_vorgang_datum: Optional[str] = None


class ArchiviertListResponse(BaseModel):
    items: list[ArchiviertItem]


class SchuelerDetailResponse(BaseModel):
    id: str
    vorname: str
    nachname: str
    klasse: str
    strasse: Optional[str] = None
    plz: Optional[str] = None
    ort: Optional[str] = None
    email_eltern: Optional[str] = None
    erstes_schuljahr: Optional[str] = None
    konto: KontoSummary


class SchuelerCsvImportPreviewRow(BaseModel):
    row_number: int
    vorname: Optional[str] = None
    nachname: Optional[str] = None
    klasse: Optional[str] = None
    strasse: Optional[str] = None
    plz: Optional[str] = None
    ort: Optional[str] = None
    email_eltern: Optional[str] = None
    notizen: Optional[str] = None
    fehlende_felder: list[str] = Field(default_factory=list)
    duplicate_existing: bool = False
    duplicate_file: bool = False
    valid: bool = True


class SchuelerCsvImportPreviewResponse(BaseModel):
    filename: str
    required_fields: list[str] = Field(default_factory=lambda: ["vorname", "nachname", "klasse"])
    total_rows: int
    valid_rows: int
    invalid_rows: int
    rows: list[SchuelerCsvImportPreviewRow]


class SchuelerCsvImportRowInput(BaseModel):
    vorname: Optional[str] = None
    nachname: Optional[str] = None
    klasse: Optional[str] = None
    strasse: Optional[str] = None
    plz: Optional[str] = None
    ort: Optional[str] = None
    email_eltern: Optional[str] = None
    notizen: Optional[str] = None


class SchuelerCsvImportRequest(BaseModel):
    rows: list[SchuelerCsvImportRowInput] = Field(default_factory=list)


class SchuelerCsvImportSkipItem(BaseModel):
    row_number: int
    reason: str


class SchuelerCsvImportResponse(BaseModel):
    imported: int
    skipped: int
    skip_details: list[SchuelerCsvImportSkipItem] = Field(default_factory=list)


class VorgangItem(BaseModel):
    id: str
    typ: str
    datum: str
    bezeichnung: str
    betrag_cents: int
    saldo_nach_cents: int
    mail_versandt_am: str | None = None


class VorgaengeResponse(BaseModel):
    items: list[VorgangItem]


class AktivesBuchItem(BaseModel):
    rechnungs_posten_id: int
    rechnung_id: str
    buch_id: str
    titel: str
    fach: str
    verlag: Optional[str] = None
    kaufdatum: str
    verkauft_schuljahr: Optional[str] = None
    preis_cents: int
    gutschrift_cents: int
    nutzungsjahr: int = 1
    abschreibung_prozent: int = 0
    schutzgebuehr_cents: int = 0
    zurueckgegeben: bool = False
    beschaedigt: bool = False


class AktiveBuecherResponse(BaseModel):
    items: list[AktivesBuchItem]


class BuchZustandResponse(BaseModel):
    bestand_id: int
    zustand: str = "sehr_gut"
    nutzungsjahr: int = 0
    preis_cents: int
    bestand_verfuegbar: int


class NutzungsjahrBestand(BaseModel):
    nutzungsjahr: int
    bestand: int


class BuchCreate(BaseModel):
    titel: str
    untertitel: Optional[str] = None
    isbn: Optional[str] = None
    fach: str
    stufe: int
    verlag: Optional[str] = None
    preis_cents: int
    bestand_gesamt: int
    schutzgebuehr_cents: Optional[int] = None
    nutzungsjahre: Optional[list[NutzungsjahrBestand]] = None


class BuchUpdate(BaseModel):
    titel: Optional[str] = None
    untertitel: Optional[str] = None
    isbn: Optional[str] = None
    fach: Optional[str] = None
    stufe: Optional[int] = None
    verlag: Optional[str] = None
    preis_cents: Optional[int] = None
    gutschrift_cents: Optional[int] = None
    bestand_gesamt: Optional[int] = None
    schutzgebuehr_cents: Optional[int] = None


class BuchResponse(BaseModel):
    id: str
    titel: str
    untertitel: Optional[str] = None
    isbn: Optional[str] = None
    fach: str
    stufe: int
    verlag: Optional[str] = None
    preis_cents: int
    gutschrift_cents: int
    bestand_gesamt: int
    bestand_ausgegeben: int
    bestand_frei: int
    schutzgebuehr_cents: int = 0
    zustaende: list[BuchZustandResponse] = Field(default_factory=list)


class BuchListResponse(BaseModel):
    items: list[BuchResponse]
    total: int


class VerkaufPositionRequest(BaseModel):
    buch_id: Optional[str] = None
    bestand_id: Optional[int] = None

    @model_validator(mode="after")
    def validate_selection(self):
        if self.buch_id is None and self.bestand_id is None:
            raise ValueError("buch_id oder bestand_id ist erforderlich")
        return self


class FreipostenInput(BaseModel):
    bezeichnung: str
    betrag_cents: int
    typ: str = "Pauschal"


class FreipostenResponse(BaseModel):
    id: int
    bezeichnung: str
    betrag_cents: int
    typ: str


class FreipostenVorlageCreate(BaseModel):
    bezeichnung: str
    betrag_cents: int
    typ: str = "Pauschal"


class FreipostenVorlageResponse(BaseModel):
    id: int
    bezeichnung: str
    betrag_cents: int
    typ: str
    angelegt_am: str


class LernmaterialPositionRequest(BaseModel):
    id: str
    menge: int = Field(default=1, ge=1)


class VerkaufRequest(BaseModel):
    schueler_id: str
    buch_ids: list[str] = Field(default_factory=list)
    positionen: list[VerkaufPositionRequest] = Field(default_factory=list)
    lernmaterial_positionen: list[LernmaterialPositionRequest] = Field(default_factory=list)
    freiposten: list[FreipostenInput] = Field(default_factory=list)
    guthaben_verrechnen: bool = False
    rueckgabe_posten_ids: list[int] = Field(default_factory=list)
    rueckgaben: list[GutschriftRueckgabeRequest] = Field(default_factory=list)
    notizen: Optional[str] = None

    @model_validator(mode="after")
    def validate_items(self):
        if not self.buch_ids and not self.positionen and not self.lernmaterial_positionen and not self.freiposten:
            raise ValueError("Mindestens ein Artikel muss uebergeben werden")
        return self


class RechnungsPostenResponse(BaseModel):
    rechnungs_posten_id: int
    buch_id: str
    titel: str
    preis_cents: int
    zustand: str = "sehr_gut"


class LernmaterialCreate(BaseModel):
    name: str
    kategorie: str
    preis_cents: int
    bestand_gesamt: int = 0


class LernmaterialUpdate(BaseModel):
    name: Optional[str] = None
    kategorie: Optional[str] = None
    preis_cents: Optional[int] = None
    bestand_gesamt: Optional[int] = None


class LernmaterialResponse(BaseModel):
    id: str
    name: str
    kategorie: str
    preis_cents: int
    bestand_gesamt: int
    bestand_ausgegeben: int
    bestand_frei: int


class LernmaterialListResponse(BaseModel):
    items: list[LernmaterialResponse]
    total: int


class LernmaterialPostenResponse(BaseModel):
    lernmaterial_posten_id: int
    lernmaterial_id: str
    name: str
    kategorie: str
    preis_cents: int
    menge: int = 1


class VerkaufResponse(BaseModel):
    id: str
    schueler_id: str
    datum: str
    summe_cents: int
    verrechnet_cents: int
    zu_zahlen_cents: int
    posten: list[RechnungsPostenResponse]
    lernmaterial_posten: list[LernmaterialPostenResponse] = Field(default_factory=list)
    freiposten: list[FreipostenResponse] = Field(default_factory=list)
    verrechnung_posten: list["RechnungVerrechnungPostenResponse"] = Field(default_factory=list)


class RechnungVerrechnungPostenResponse(BaseModel):
    gutschrift_posten_id: Optional[int] = None
    quelle_typ: str
    buch_id: Optional[str] = None
    titel: Optional[str] = None
    betrag_cents: int


class RechnungDetailResponse(BaseModel):
    id: str
    schueler_id: str
    schuljahr: str
    datum: str
    summe_cents: int
    verrechnet_cents: int
    status: str
    storniert_am: Optional[str] = None
    notizen: Optional[str] = None
    posten: list[RechnungsPostenResponse]
    lernmaterial_posten: list[LernmaterialPostenResponse] = Field(default_factory=list)
    freiposten: list[FreipostenResponse] = Field(default_factory=list)
    verrechnung_posten: list[RechnungVerrechnungPostenResponse] = Field(default_factory=list)


class RechnungMailPreviewRequest(BaseModel):
    to_email: Optional[str] = None
    subject_template: Optional[str] = None
    body_template: Optional[str] = None


class RechnungMailPreviewMeta(BaseModel):
    schueler_name: str
    schueler_klasse: str
    summe_eur: str


class RechnungMailPreviewResponse(BaseModel):
    rechnung_id: str
    to_email: str
    subject_template: str
    body_template: str
    rendered_subject: str
    rendered_body: str
    context_meta: RechnungMailPreviewMeta


class RechnungMailSendRequest(BaseModel):
    to_email: Optional[str] = None
    subject_template: Optional[str] = None
    body_template: Optional[str] = None


class RechnungMailSendResponse(BaseModel):
    status: str
    rechnung_id: str
    to_email: str
    subject: str


class GutschriftRueckgabeRequest(BaseModel):
    rechnungs_posten_id: int
    zustand: str = "sehr_gut"
    beschaedigt: bool = False


class GutschriftRequest(BaseModel):
    schueler_id: str
    rechnungs_posten_ids: list[int] = Field(default_factory=list)
    rueckgaben: list[GutschriftRueckgabeRequest] = Field(default_factory=list)
    notizen: Optional[str] = None

    @model_validator(mode="after")
    def validate_items(self):
        if not self.rechnungs_posten_ids and not self.rueckgaben:
            raise ValueError("Mindestens eine Rueckgabe muss uebergeben werden")
        return self


class GutschriftPostenResponse(BaseModel):
    rechnungs_posten_id: int
    buch_id: str
    titel: str
    betrag_cents: int
    zustand: str = "sehr_gut"
    abschreibung_prozent: int = 0
    ursprungs_preis_cents: int = 0
    wiederverkaufspreis_cents: int = 0
    beschaedigt: bool = False


class GutschriftResponse(BaseModel):
    id: str
    schueler_id: str
    datum: str
    summe_cents: int
    ausgezahlt: bool
    posten: list[GutschriftPostenResponse]


class GutschriftDetailResponse(BaseModel):
    id: str
    schueler_id: str
    schuljahr: str
    datum: str
    summe_cents: int
    ausgezahlt: bool
    ausgezahlt_am: Optional[str] = None
    notizen: Optional[str] = None
    posten: list[GutschriftPostenResponse]


class ZahlungCreate(BaseModel):
    schueler_id: str
    rechnung_id: Optional[str] = None
    datum: str
    betrag_cents: int
    notizen: Optional[str] = None


class ZahlungUpdate(BaseModel):
    rechnung_id: Optional[str] = None
    datum: Optional[str] = None
    betrag_cents: Optional[int] = None
    notizen: Optional[str] = None


class ZahlungResponse(BaseModel):
    id: int
    schueler_id: str
    rechnung_id: Optional[str] = None
    datum: str
    betrag_cents: int
    notizen: Optional[str] = None
    erstellt_am: str


class ZahlungenListResponse(BaseModel):
    items: list[ZahlungResponse]


class LetzterVorgang(BaseModel):
    id: str
    typ: str
    bezeichnung: str
    betrag_cents: int
    datum: str
    erstellt_am: str
    schueler_id: str
    schueler_name: str


class DashboardResponse(BaseModel):
    anzahl_schueler: int
    anzahl_buecher_titel: int
    offene_ausleihen: int
    verkaeufe_monat: int
    rueckgaben_monat: int
    umsatz_monat_cents: int
    gutschriften_monat_cents: int
    letzte_vorgaenge: list[LetzterVorgang] = Field(default_factory=list)


class EinstellungenResponse(BaseModel):
    model_config = {"extra": "allow"}


class EinstellungenUpdate(BaseModel):
    model_config = {"extra": "allow"}


class HealthResponse(BaseModel):
    status: str
    version: str


# ── Klassenversetzung ─────────────────────────────────────────────────────────

class KlassenversetzungSchueler(BaseModel):
    id: str
    vorname: str
    nachname: str
    klasse_von: str
    klasse_nach: str
    klasse_seit: Optional[str] = None
    aktive_buecher: int = 0
    saldo_cents: int = 0


class KlassenversetzungGruppe(BaseModel):
    klasse_von: str
    klasse_nach: str
    ist_abgangsklasse: bool = False
    schueler: list[KlassenversetzungSchueler]


class KlassenversetzungVorschauResponse(BaseModel):
    gruppen: list[KlassenversetzungGruppe]
    letzte_versetzung_am: Optional[str] = None
    naechster_schuljahresbeginn: Optional[str] = None
    versetzung_sperre_aktiv: bool = True


class VersetzungItem(BaseModel):
    schueler_id: str
    klasse_nach: str


class VersetzungRequest(BaseModel):
    versetzungen: list[VersetzungItem]


class VersetzungResponse(BaseModel):
    versetzt: int
    archiviert: int
