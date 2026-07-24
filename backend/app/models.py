"""
SQLAlchemy 2.x ORM models.

All monetary values are stored as INTEGER cents.
"""

from sqlalchemy import (
    Column,
    ForeignKey,
    Index,
    Integer,
    Text,
    UniqueConstraint,
    text as sa_text,
)
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


class Benutzer(Base):
    __tablename__ = "benutzer"

    benutzername = Column(Text, primary_key=True)
    passwort_hash = Column(Text, nullable=False)


class Schueler(Base):
    __tablename__ = "schueler"

    id = Column(Text, primary_key=True)  # "S-0001"
    vorname = Column(Text, nullable=False)
    nachname = Column(Text, nullable=False)
    klasse = Column(Text, nullable=False)  # "7a", "Q1", "EF"
    strasse = Column(Text, nullable=True)
    plz = Column(Text, nullable=True)
    ort = Column(Text, nullable=True)
    email_eltern = Column(Text, nullable=True)
    notizen = Column(Text, nullable=True)
    angelegt_am = Column(
        Text, nullable=False, server_default=sa_text("(datetime('now'))")
    )
    geloescht_am = Column(Text, nullable=True)
    archiviert_am = Column(Text, nullable=True)
    archiviert_schuljahr = Column(Text, nullable=True)
    klasse_seit = Column(Text, nullable=True)
    erstes_schuljahr = Column(Text, nullable=True)

    rechnungen = relationship("Rechnungen", back_populates="schueler")
    gutschriften = relationship("Gutschriften", back_populates="schueler")
    zahlungen = relationship("Zahlungen", back_populates="schueler")
    auszahlungen = relationship("Auszahlungen", back_populates="schueler")

    __table_args__ = (
        Index("idx_schueler_klasse", "klasse"),
        Index("idx_schueler_name", "nachname", "vorname"),
        Index("idx_schueler_geloescht", "geloescht_am"),
    )


class Buecher(Base):
    __tablename__ = "buecher"

    id = Column(Text, primary_key=True)  # "B-0001"
    titel = Column(Text, nullable=False)
    untertitel = Column(Text, nullable=True)
    isbn = Column(Text, nullable=True)
    fach = Column(Text, nullable=False)
    stufe = Column(Integer, nullable=False)
    verlag = Column(Text, nullable=True)
    preis_cents = Column(Integer, nullable=False)
    gutschrift_cents = Column(Integer, nullable=False)
    bestand_gesamt = Column(Integer, nullable=False, server_default=sa_text("0"))
    bestand_ausgegeben = Column(Integer, nullable=False, server_default=sa_text("0"))
    schutzgebuehr_cents = Column(Integer, nullable=True)
    angelegt_am = Column(
        Text, nullable=False, server_default=sa_text("(datetime('now'))")
    )
    geloescht_am = Column(Text, nullable=True)

    bestaende = relationship(
        "BuchZustandBestand",
        back_populates="buch",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("idx_buecher_fach", "fach"),
        Index("idx_buecher_stufe", "stufe"),
    )


class BuchFach(Base):
    __tablename__ = "buch_faecher"

    name = Column(Text, primary_key=True)
    angelegt_am = Column(
        Text, nullable=False, server_default=sa_text("(datetime('now'))")
    )


class BuchZustandBestand(Base):
    __tablename__ = "buch_zustand_bestand"

    id = Column(Integer, primary_key=True, autoincrement=True)
    buch_id = Column(Text, ForeignKey("buecher.id"), nullable=False)
    zustand = Column(Text, nullable=False, server_default=sa_text("'sehr_gut'"))
    verkaufspreis_cents = Column(Integer, nullable=False)
    bestand_verfuegbar = Column(Integer, nullable=False, server_default=sa_text("0"))
    nutzungsjahr = Column(Integer, nullable=True)
    schuljahr_eingestellt = Column(Integer, nullable=True)

    buch = relationship("Buecher", back_populates="bestaende")

    __table_args__ = (
        UniqueConstraint(
            "buch_id",
            "zustand",
            "nutzungsjahr",
            name="uq_buch_zustand_nutzungsjahr",
        ),
        Index("idx_buch_zustand_buch", "buch_id"),
        Index("idx_buch_zustand_zustand", "zustand"),
    )


class Rechnungen(Base):
    __tablename__ = "rechnungen"

    id = Column(Text, primary_key=True)  # "R-2025-1042"
    schueler_id = Column(Text, ForeignKey("schueler.id"), nullable=False)
    schuljahr = Column(Text, nullable=False)
    datum = Column(Text, nullable=False)
    summe_cents = Column(Integer, nullable=False)
    verrechnet_cents = Column(Integer, nullable=False, server_default=sa_text("0"))
    status = Column(Text, nullable=False, server_default=sa_text("'offen'"))
    storniert_am = Column(Text, nullable=True)
    mail_versandt_am = Column(Text, nullable=True)
    mail_versandt_an = Column(Text, nullable=True)
    notizen = Column(Text, nullable=True)
    anzeige_nr = Column(Text, nullable=True)  # frei vergebbare, von id unabhängige Rechnungsnummer
    erstellt_am = Column(
        Text, nullable=False, server_default=sa_text("(datetime('now'))")
    )

    schueler = relationship("Schueler", back_populates="rechnungen")
    posten = relationship("RechnungsPosten", back_populates="rechnung")
    lernmaterial_posten = relationship("LernmaterialPosten", back_populates="rechnung")
    freiposten = relationship("RechnungFreiposten", back_populates="rechnung")
    verrechnungen = relationship("RechnungVerrechnung", back_populates="rechnung")

    __table_args__ = (
        Index("idx_rechnungen_schueler", "schueler_id"),
        Index("idx_rechnungen_status", "status"),
        Index("idx_rechnungen_erstellt", "erstellt_am"),
        Index("idx_rechnungen_schuljahr", "schuljahr"),
        Index("idx_rechnungen_anzeige_nr", "anzeige_nr", unique=True),
    )


class RechnungsPosten(Base):
    __tablename__ = "rechnungs_posten"

    id = Column(Integer, primary_key=True, autoincrement=True)
    rechnung_id = Column(Text, ForeignKey("rechnungen.id"), nullable=False)
    buch_id = Column(Text, ForeignKey("buecher.id"), nullable=False)
    preis_cents = Column(Integer, nullable=False)
    zustand = Column(Text, nullable=False, server_default=sa_text("'sehr_gut'"))
    nutzungsjahr_beim_kauf = Column(Integer, nullable=False, server_default=sa_text("1"))
    zurueckgegeben = Column(Integer, nullable=False, server_default=sa_text("0"))
    zurueckgegeben_am = Column(Text, nullable=True)
    behalten = Column(Integer, nullable=False, server_default=sa_text("0"))

    rechnung = relationship("Rechnungen", back_populates="posten")
    buch = relationship("Buecher")
    gutschrift_posten = relationship(
        "GutschriftPosten",
        back_populates="rechnungs_posten",
    )

    __table_args__ = (
        Index("idx_posten_rechnung", "rechnung_id"),
        Index("idx_posten_buch", "buch_id"),
    )


class Gutschriften(Base):
    __tablename__ = "gutschriften"

    id = Column(Text, primary_key=True)  # "G-2026-0231"
    schueler_id = Column(Text, ForeignKey("schueler.id"), nullable=False)
    schuljahr = Column(Text, nullable=False)
    datum = Column(Text, nullable=False)
    summe_cents = Column(Integer, nullable=False)
    ausgezahlt = Column(Integer, nullable=False, server_default=sa_text("0"))
    ausgezahlt_am = Column(Text, nullable=True)
    notizen = Column(Text, nullable=True)
    erstellt_am = Column(
        Text, nullable=False, server_default=sa_text("(datetime('now'))")
    )

    schueler = relationship("Schueler", back_populates="gutschriften")
    posten = relationship("GutschriftPosten", back_populates="gutschrift")

    __table_args__ = (Index("idx_gutschriften_schueler", "schueler_id"),)


class GutschriftPosten(Base):
    __tablename__ = "gutschrift_posten"

    id = Column(Integer, primary_key=True, autoincrement=True)
    gutschrift_id = Column(Text, ForeignKey("gutschriften.id"), nullable=False)
    rechnungs_posten_id = Column(
        Integer, ForeignKey("rechnungs_posten.id"), nullable=False
    )
    betrag_cents = Column(Integer, nullable=False)
    zustand = Column(Text, nullable=False, server_default=sa_text("'sehr_gut'"))
    abschreibung_prozent = Column(
        Integer, nullable=False, server_default=sa_text("0")
    )
    ursprungs_preis_cents = Column(
        Integer, nullable=False, server_default=sa_text("0")
    )
    nutzungsjahr = Column(Integer, nullable=True)
    beschaedigt = Column(Integer, nullable=False, server_default=sa_text("0"))

    gutschrift = relationship("Gutschriften", back_populates="posten")
    rechnungs_posten = relationship(
        "RechnungsPosten",
        back_populates="gutschrift_posten",
    )
    verrechnungen = relationship("RechnungVerrechnung", back_populates="gutschrift_posten")

    __table_args__ = (Index("idx_gposten_gutschrift", "gutschrift_id"),)


class Zahlungen(Base):
    __tablename__ = "zahlungen"

    id = Column(Integer, primary_key=True, autoincrement=True)
    schueler_id = Column(Text, ForeignKey("schueler.id"), nullable=False)
    rechnung_id = Column(Text, ForeignKey("rechnungen.id"), nullable=True)
    datum = Column(Text, nullable=False)
    betrag_cents = Column(Integer, nullable=False)
    notizen = Column(Text, nullable=True)
    erstellt_am = Column(
        Text, nullable=False, server_default=sa_text("(datetime('now'))")
    )

    schueler = relationship("Schueler", back_populates="zahlungen")
    rechnung = relationship("Rechnungen")

    __table_args__ = (Index("idx_zahlungen_schueler", "schueler_id"),)


class Auszahlungen(Base):
    __tablename__ = "auszahlungen"

    id = Column(Integer, primary_key=True, autoincrement=True)
    schueler_id = Column(Text, ForeignKey("schueler.id"), nullable=False)
    datum = Column(Text, nullable=False)
    betrag_cents = Column(Integer, nullable=False)
    notizen = Column(Text, nullable=True)
    erstellt_am = Column(
        Text, nullable=False, server_default=sa_text("(datetime('now'))")
    )

    schueler = relationship("Schueler", back_populates="auszahlungen")

    __table_args__ = (Index("idx_auszahlungen_schueler", "schueler_id"),)


class Lernmaterial(Base):
    __tablename__ = "lernmaterial"

    id = Column(Text, primary_key=True)  # "M-0001"
    name = Column(Text, nullable=False)
    kategorie = Column(Text, nullable=False)
    preis_cents = Column(Integer, nullable=False)
    bestand_gesamt = Column(Integer, nullable=False, server_default=sa_text("0"))
    bestand_ausgegeben = Column(Integer, nullable=False, server_default=sa_text("0"))
    angelegt_am = Column(
        Text, nullable=False, server_default=sa_text("(datetime('now'))")
    )
    geloescht_am = Column(Text, nullable=True)

    posten = relationship("LernmaterialPosten", back_populates="lernmaterial")

    __table_args__ = (
        Index("idx_lernmaterial_kategorie", "kategorie"),
        Index("idx_lernmaterial_name", "name"),
    )


class LernmaterialKategorie(Base):
    __tablename__ = "lernmaterial_kategorien"

    name = Column(Text, primary_key=True)
    angelegt_am = Column(
        Text, nullable=False, server_default=sa_text("(datetime('now'))")
    )


class LernmaterialPosten(Base):
    __tablename__ = "lernmaterial_posten"

    id = Column(Integer, primary_key=True, autoincrement=True)
    rechnung_id = Column(Text, ForeignKey("rechnungen.id"), nullable=False)
    lernmaterial_id = Column(Text, ForeignKey("lernmaterial.id"), nullable=False)
    preis_cents = Column(Integer, nullable=False)
    menge = Column(Integer, nullable=False, default=1)

    rechnung = relationship("Rechnungen", back_populates="lernmaterial_posten")
    lernmaterial = relationship("Lernmaterial", back_populates="posten")

    __table_args__ = (
        Index("idx_lm_posten_rechnung", "rechnung_id"),
        Index("idx_lm_posten_material", "lernmaterial_id"),
    )


class FreipostenVorlage(Base):
    __tablename__ = "freiposten_vorlagen"

    id = Column(Integer, primary_key=True, autoincrement=True)
    bezeichnung = Column(Text, nullable=False)
    betrag_cents = Column(Integer, nullable=False)
    typ = Column(Text, nullable=False, server_default=sa_text("'Pauschal'"))
    angelegt_am = Column(Text, nullable=False, server_default=sa_text("(datetime('now'))"))


class RechnungFreiposten(Base):
    __tablename__ = "rechnung_freiposten"

    id = Column(Integer, primary_key=True, autoincrement=True)
    rechnung_id = Column(Text, ForeignKey("rechnungen.id"), nullable=False)
    bezeichnung = Column(Text, nullable=False)
    betrag_cents = Column(Integer, nullable=False)
    typ = Column(Text, nullable=False, server_default=sa_text("'Pauschal'"))

    rechnung = relationship("Rechnungen", back_populates="freiposten")

    __table_args__ = (Index("idx_freiposten_rechnung", "rechnung_id"),)


class RechnungVerrechnung(Base):
    __tablename__ = "rechnung_verrechnungen"

    id = Column(Integer, primary_key=True, autoincrement=True)
    rechnung_id = Column(Text, ForeignKey("rechnungen.id"), nullable=False)
    gutschrift_posten_id = Column(
        Integer, ForeignKey("gutschrift_posten.id"), nullable=True
    )
    quelle_typ = Column(Text, nullable=False, server_default=sa_text("'rueckgabe'"))
    betrag_cents = Column(Integer, nullable=False)

    rechnung = relationship("Rechnungen", back_populates="verrechnungen")
    gutschrift_posten = relationship("GutschriftPosten", back_populates="verrechnungen")

    __table_args__ = (
        Index("idx_rechnung_verrechnung_rechnung", "rechnung_id"),
        Index("idx_rechnung_verrechnung_gutschrift", "gutschrift_posten_id"),
    )


class RechnungEntwurf(Base):
    __tablename__ = "rechnung_entwuerfe"

    id = Column(Integer, primary_key=True, autoincrement=True)
    flow = Column(Text, nullable=False, server_default=sa_text("'buchausgabe'"))
    schueler_id = Column(Text, ForeignKey("schueler.id"), nullable=True)
    form_state_json = Column(Text, nullable=False)
    bearbeiter = Column(Text, nullable=False)
    freigegeben_an_json = Column(Text, nullable=False, server_default=sa_text("'[]'"))
    status = Column(Text, nullable=False, server_default=sa_text("'in_bearbeitung'"))
    erinnert_am = Column(Text, nullable=True)
    erstellt_am = Column(Text, nullable=False, server_default=sa_text("(datetime('now'))"))
    geaendert_am = Column(Text, nullable=False, server_default=sa_text("(datetime('now'))"))
    abgeschlossen_am = Column(Text, nullable=True)

    schueler = relationship("Schueler")

    __table_args__ = (
        Index("idx_rechnung_entwuerfe_status", "status"),
        Index("idx_rechnung_entwuerfe_bearbeiter", "bearbeiter"),
        Index("idx_rechnung_entwuerfe_geaendert", "geaendert_am"),
        Index("idx_rechnung_entwuerfe_schueler", "schueler_id"),
    )


class RechnungStornoAudit(Base):
    __tablename__ = "rechnung_storno_audit"

    id = Column(Integer, primary_key=True, autoincrement=True)
    rechnung_id = Column(Text, ForeignKey("rechnungen.id"), nullable=False)
    rechnungs_posten_id = Column(Integer, ForeignKey("rechnungs_posten.id"), nullable=True)
    aktion = Column(Text, nullable=False)
    grund = Column(Text, nullable=False)
    benutzer = Column(Text, nullable=False)
    betrag_cents = Column(Integer, nullable=False, server_default=sa_text("0"))
    gutschrift_id = Column(Text, ForeignKey("gutschriften.id"), nullable=True)
    erstellt_am = Column(Text, nullable=False, server_default=sa_text("(datetime('now'))"))

    rechnung = relationship("Rechnungen")
    rechnungs_posten = relationship("RechnungsPosten")
    gutschrift = relationship("Gutschriften")

    __table_args__ = (
        Index("idx_storno_audit_rechnung", "rechnung_id"),
        Index("idx_storno_audit_posten", "rechnungs_posten_id"),
        Index("idx_storno_audit_erstellt", "erstellt_am"),
    )


class Einstellungen(Base):
    __tablename__ = "einstellungen"

    schluessel = Column(Text, primary_key=True)
    wert = Column(Text, nullable=False)
