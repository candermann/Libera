"""
Verkauf and invoice endpoints.
"""

import json
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Body, Depends, HTTPException
from fastapi.responses import HTMLResponse, Response
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import (
    BuchZustandBestand,
    Buecher,
    Einstellungen,
    Gutschriften,
    GutschriftPosten,
    Lernmaterial,
    LernmaterialPosten,
    RechnungEntwurf,
    RechnungStornoAudit,
    RechnungVerrechnung,
    Rechnungen,
    RechnungsPosten,
    RechnungFreiposten,
    Schueler,
    Zahlungen,
)
from app.schemas import (
    ErrorResponse,
    FreipostenResponse,
    LernmaterialPostenResponse,
    RechnungAnzeigeNrUpdate,
    RechnungDetailResponse,
    RechnungEntwurfListResponse,
    RechnungEntwurfResponse,
    RechnungEntwurfSaveRequest,
    RechnungMailPreviewRequest,
    RechnungMailPreviewResponse,
    RechnungMailSendRequest,
    RechnungMailSendResponse,
    RechnungStornoRequest,
    RechnungStornoResponse,
    RechnungVerrechnungPostenResponse,
    RechnungsPostenResponse,
    VerkaufRequest,
    VerkaufResponse,
)
from app.security import get_current_user
from app.services.ids import generate_rechnungs_id, generate_gutschrift_id
from app.services.saldo import get_saldo
from app.services.mail import (
    MailConfigurationError,
    MailDeliveryError,
    MailTemplateError,
    get_invoice_mail_preview,
    send_invoice_mail,
)
from app.services.pdf import render_rechnung_html, render_rechnung_pdf
from app.services.zustand import (
    berechne_bucket_preis,
    berechne_gutschrift_nutzungsjahr,
    berechne_wiederverkaufspreis,
    current_schuljahr_start,
    effective_nutzungsjahr,
    get_nutzungsjahr_abschlaege,
    get_zustand_abschlaege,
    _infer_purchase_nj,
)

router = APIRouter(prefix="/api", tags=["Verkauf"])


def _find_bestand_fuer_verkauf(
    db: Session, buch_id: str, bestand_id: int | None = None
) -> BuchZustandBestand | None:
    query = db.query(BuchZustandBestand).filter(BuchZustandBestand.buch_id == buch_id)
    if bestand_id is not None:
        return query.filter(BuchZustandBestand.id == bestand_id).first()

    rows = query.filter(BuchZustandBestand.bestand_verfuegbar > 0).all()
    rows.sort(key=lambda row: row.verkaufspreis_cents)
    return rows[0] if rows else None


def _get_or_create_bestand(
    db: Session, buch_id: str, preis_cents: int, nutzungsjahr: int, zustand: str = "sehr_gut",
) -> BuchZustandBestand:
    cur_sj = current_schuljahr_start()
    all_buckets = (
        db.query(BuchZustandBestand)
        .filter(BuchZustandBestand.buch_id == buch_id)
        .all()
    )
    for bucket in all_buckets:
        stored = bucket.nutzungsjahr if bucket.nutzungsjahr is not None else 0
        if effective_nutzungsjahr(stored, bucket.schuljahr_eingestellt) == nutzungsjahr:
            if bucket.zustand != zustand:
                continue
            bucket.zustand = zustand
            bucket.verkaufspreis_cents = preis_cents
            return bucket

    bestand = BuchZustandBestand(
        buch_id=buch_id,
        zustand=zustand,
        verkaufspreis_cents=preis_cents,
        bestand_verfuegbar=0,
        nutzungsjahr=nutzungsjahr,
        schuljahr_eingestellt=cur_sj if nutzungsjahr > 0 else None,
    )
    db.add(bestand)
    db.flush()
    return bestand


def _berechne_verrechnungszuordnung(
    db: Session, schueler_id: str, verrechnet_cents: int
) -> list[dict]:
    if verrechnet_cents <= 0:
        return []

    credit_rows = db.execute(
        text(
            """
            SELECT
                gp.id AS gutschrift_posten_id,
                gp.betrag_cents,
                rp.buch_id,
                b.titel
            FROM gutschrift_posten gp
            JOIN gutschriften g ON g.id = gp.gutschrift_id
            JOIN rechnungs_posten rp ON rp.id = gp.rechnungs_posten_id
            JOIN buecher b ON b.id = rp.buch_id
            WHERE g.schueler_id = :sid
            ORDER BY g.datum, g.id, gp.id
            """
        ),
        {"sid": schueler_id},
    ).fetchall()

    used_rows = db.execute(
        text(
            """
            SELECT rv.gutschrift_posten_id, COALESCE(SUM(rv.betrag_cents), 0) AS used_cents
            FROM rechnung_verrechnungen rv
            JOIN rechnungen r ON r.id = rv.rechnung_id
            WHERE r.schueler_id = :sid
              AND r.status != 'storniert'
              AND rv.gutschrift_posten_id IS NOT NULL
            GROUP BY rv.gutschrift_posten_id
            """
        ),
        {"sid": schueler_id},
    ).fetchall()
    used_by_post = {row.gutschrift_posten_id: row.used_cents for row in used_rows}

    auszahlungen_total = db.execute(
        text(
            """
            SELECT COALESCE(SUM(betrag_cents), 0) AS cnt
            FROM auszahlungen
            WHERE schueler_id = :sid
            """
        ),
        {"sid": schueler_id},
    ).scalar() or 0

    legacy_row = db.execute(
        text(
            """
            SELECT
              COALESCE((
                SELECT SUM(r.verrechnet_cents)
                FROM rechnungen r
                WHERE r.schueler_id = :sid
                  AND r.status != 'storniert'
              ), 0)
              -
              COALESCE((
                SELECT SUM(rv.betrag_cents)
                FROM rechnung_verrechnungen rv
                JOIN rechnungen r2 ON r2.id = rv.rechnung_id
                WHERE r2.schueler_id = :sid
                  AND r2.status != 'storniert'
              ), 0) AS unlinked_cents
            """
        ),
        {"sid": schueler_id},
    ).first()
    legacy_verrechnet = max(0, legacy_row.unlinked_cents if legacy_row else 0)

    offene_credits = []
    for row in credit_rows:
        bereits_verwendet = used_by_post.get(row.gutschrift_posten_id, 0)
        rest = max(0, row.betrag_cents - bereits_verwendet)
        if rest <= 0:
            continue
        offene_credits.append(
            {
                "gutschrift_posten_id": row.gutschrift_posten_id,
                "buch_id": row.buch_id,
                "titel": row.titel,
                "rest_cents": rest,
            }
        )

    # Historische Abbuchungen ohne direkte Posten-Zuordnung ebenfalls FIFO abziehen.
    historische_abzuege = auszahlungen_total + legacy_verrechnet
    for credit in offene_credits:
        if historische_abzuege <= 0:
            break
        abz = min(credit["rest_cents"], historische_abzuege)
        credit["rest_cents"] -= abz
        historische_abzuege -= abz

    zuordnung = []
    verbleibend = verrechnet_cents
    for credit in offene_credits:
        if verbleibend <= 0:
            break
        if credit["rest_cents"] <= 0:
            continue
        anteil = min(credit["rest_cents"], verbleibend)
        if anteil <= 0:
            continue
        zuordnung.append(
            {
                "gutschrift_posten_id": credit["gutschrift_posten_id"],
                "quelle_typ": "rueckgabe",
                "buch_id": credit["buch_id"],
                "titel": credit["titel"],
                "betrag_cents": anteil,
            }
        )
        verbleibend -= anteil

    if verbleibend > 0:
        zuordnung.append(
            {
                "gutschrift_posten_id": None,
                "quelle_typ": "konto_guthaben",
                "buch_id": None,
                "titel": "Sonstiges Guthaben",
                "betrag_cents": verbleibend,
            }
        )

    return zuordnung


def _lade_verrechnungsposten(db: Session, rechnung_id: str) -> list[RechnungVerrechnungPostenResponse]:
    rows = db.execute(
        text(
            """
            SELECT
                rv.gutschrift_posten_id,
                rv.quelle_typ,
                rv.betrag_cents,
                rp.buch_id,
                b.titel
            FROM rechnung_verrechnungen rv
            LEFT JOIN gutschrift_posten gp ON gp.id = rv.gutschrift_posten_id
            LEFT JOIN rechnungs_posten rp ON rp.id = gp.rechnungs_posten_id
            LEFT JOIN buecher b ON b.id = rp.buch_id
            WHERE rv.rechnung_id = :rid
            ORDER BY rv.id
            """
        ),
        {"rid": rechnung_id},
    ).fetchall()

    result = []
    for row in rows:
        titel = row.titel
        if not titel and row.quelle_typ == "konto_guthaben":
            titel = "Sonstiges Guthaben"
        result.append(
            RechnungVerrechnungPostenResponse(
                gutschrift_posten_id=row.gutschrift_posten_id,
                quelle_typ=row.quelle_typ,
                buch_id=row.buch_id,
                titel=titel,
                betrag_cents=row.betrag_cents,
            )
        )
    return result


def _now_iso() -> str:
    return datetime.now().replace(microsecond=0).isoformat()


def _parse_json_list(raw: str | None) -> list[str]:
    if not raw:
        return []
    try:
        value = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


def _parse_json_dict(raw: str | None) -> dict:
    if not raw:
        return {}
    try:
        value = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return value if isinstance(value, dict) else {}


def _can_access_entwurf(entwurf: RechnungEntwurf, username: str) -> bool:
    return entwurf.bearbeiter == username


def _cleanup_old_entwuerfe(db: Session) -> None:
    cutoff_iso = (datetime.now() - timedelta(days=60)).replace(microsecond=0).isoformat()
    db.query(RechnungEntwurf).filter(
        RechnungEntwurf.status == "in_bearbeitung",
        RechnungEntwurf.geaendert_am < cutoff_iso,
    ).delete(synchronize_session=False)


def _entwurf_to_response(db: Session, entwurf: RechnungEntwurf) -> RechnungEntwurfResponse:
    schueler_payload = None
    schueler_name = None
    if entwurf.schueler_id:
        schueler = db.query(Schueler).filter(Schueler.id == entwurf.schueler_id).first()
        if schueler:
            schueler_name = f"{schueler.nachname}, {schueler.vorname}"
            schueler_payload = {
                "id": schueler.id,
                "vorname": schueler.vorname,
                "nachname": schueler.nachname,
                "klasse": schueler.klasse,
                "strasse": schueler.strasse,
                "plz": schueler.plz,
                "ort": schueler.ort,
                "email_eltern": schueler.email_eltern,
            }
    return RechnungEntwurfResponse(
        id=entwurf.id,
        flow=entwurf.flow,
        schueler_id=entwurf.schueler_id,
        schueler_name=schueler_name,
        schueler=schueler_payload,
        state=_parse_json_dict(entwurf.form_state_json),
        bearbeiter=entwurf.bearbeiter,
        freigegeben_an=_parse_json_list(entwurf.freigegeben_an_json),
        status=entwurf.status,
        erstellt_am=entwurf.erstellt_am or "",
        geaendert_am=entwurf.geaendert_am or "",
        updated_at=entwurf.geaendert_am or "",
        erinnert_am=entwurf.erinnert_am,
    )


def _mark_entwurf_abgeschlossen(
    db: Session,
    entwurf_id: int | None,
    username: str,
    schueler_id: str,
) -> None:
    if not entwurf_id:
        return
    entwurf = db.query(RechnungEntwurf).filter(RechnungEntwurf.id == entwurf_id).first()
    if not entwurf or entwurf.status != "in_bearbeitung":
        raise HTTPException(status_code=404, detail="Entwurf nicht gefunden")
    if not _can_access_entwurf(entwurf, username):
        raise HTTPException(status_code=403, detail="Keine Berechtigung fuer diesen Entwurf")
    if entwurf.schueler_id != schueler_id:
        raise HTTPException(status_code=400, detail="Entwurf gehoert zu einem anderen Schueler")
    now = _now_iso()
    entwurf.status = "abgeschlossen"
    entwurf.abgeschlossen_am = now
    entwurf.geaendert_am = now


def _rechnung_paid_cents(db: Session, rechnung_id: str) -> int:
    return db.query(func.coalesce(func.sum(Zahlungen.betrag_cents), 0)).filter(
        Zahlungen.rechnung_id == rechnung_id
    ).scalar() or 0


@router.post(
    "/verkauf",
    response_model=VerkaufResponse,
    status_code=201,
    responses={422: {"model": ErrorResponse}},
)
def create_verkauf(
    data: VerkaufRequest,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    schueler = db.query(Schueler).filter(
        Schueler.id == data.schueler_id, Schueler.geloescht_am.is_(None)
    ).first()
    if not schueler:
        raise HTTPException(status_code=404, detail="Schueler nicht gefunden")

    schuljahr_row = db.query(Einstellungen).filter(
        Einstellungen.schluessel == "schuljahr_aktuell"
    ).first()
    schuljahr = schuljahr_row.wert if schuljahr_row else "2025/2026"

    rechnung_id = generate_rechnungs_id(db, schuljahr)
    today = date.today().isoformat()

    aufschlag_row = db.query(Einstellungen).filter(
        Einstellungen.schluessel == "rueckgabe_aufschlag_prozent"
    ).first()
    aufschlag_prozent = 0
    if aufschlag_row:
        try:
            aufschlag_prozent = max(0, int(aufschlag_row.wert))
        except (TypeError, ValueError):
            pass

    requested_positionen = data.positionen or [
        {"buch_id": buch_id, "bestand_id": None} for buch_id in data.buch_ids
    ]

    nj_abschlaege = get_nutzungsjahr_abschlaege(db)

    buch_snapshots = []
    summe = 0

    for position in requested_positionen:
        buch_id = position.buch_id if hasattr(position, "buch_id") else position["buch_id"]
        bestand_id = (
            position.bestand_id if hasattr(position, "bestand_id") else position["bestand_id"]
        )

        buch = (
            db.query(Buecher)
            .filter(Buecher.id == buch_id, Buecher.geloescht_am.is_(None))
            .with_for_update()
            .first()
        )
        if not buch:
            raise HTTPException(status_code=404, detail=f"Buch {buch_id} nicht gefunden")

        already_has = db.execute(
            text(
                """
                SELECT COUNT(*) AS cnt
                FROM rechnungs_posten rp
                JOIN rechnungen r ON r.id = rp.rechnung_id
                WHERE r.schueler_id = :sid
                  AND rp.buch_id = :bid
                  AND r.status != 'storniert'
                  AND rp.zurueckgegeben = 0
                """
            ),
            {"sid": data.schueler_id, "bid": buch_id},
        ).scalar()
        if already_has and already_has > 0:
            raise HTTPException(
                status_code=422,
                detail={
                    "error": {
                        "code": "BUCH_BEREITS_AUSGEGEBEN",
                        "message": f"Schueler hat '{buch.titel}' bereits",
                        "details": {
                            "buch_id": buch_id,
                            "schueler_id": data.schueler_id,
                        },
                    }
                },
            )

        bestand = _find_bestand_fuer_verkauf(db, buch_id, bestand_id)
        if not bestand or bestand.bestand_verfuegbar <= 0:
            raise HTTPException(
                status_code=422,
                detail={
                    "error": {
                        "code": "BUCH_NICHT_VERFUEGBAR",
                        "message": f"Buch '{buch.titel}' ist in der gewaehlten Qualitaet nicht verfuegbar",
                        "details": {
                            "buch_id": buch_id,
                            "bestand_id": bestand_id,
                        },
                    }
                },
            )

        # Determine Nutzungsjahr at point of sale — use effective (aged) NJ.
        # Fall back to inference only for legacy inventory without stored NJ (nutzungsjahr=NULL).
        if bestand.nutzungsjahr is not None:
            nj_beim_kauf = effective_nutzungsjahr(
                bestand.nutzungsjahr, bestand.schuljahr_eingestellt
            )
        else:
            fee = max(0, int(buch.schutzgebuehr_cents or 0))
            inferred_nj = _infer_purchase_nj(
                bestand.verkaufspreis_cents, buch.preis_cents, nj_abschlaege, fee
            )
            nj_beim_kauf = inferred_nj if inferred_nj == 0 else max(1, inferred_nj)

        if bestand.zustand != "sehr_gut":
            eff_bucket_preis = max(0, bestand.verkaufspreis_cents)
        else:
            # Compute effective price from effective NJ — this auto-reflects annual aging.
            eff_bucket_preis = berechne_bucket_preis(
                buch.preis_cents, nj_beim_kauf, nj_abschlaege, buch.schutzgebuehr_cents
            )
        # Gebrauchte Bücher (NJ > 0) erhalten den Rückgabe-Aufschlag (%).
        if nj_beim_kauf > 0 and eff_bucket_preis < buch.preis_cents:
            verkaufspreis = round(eff_bucket_preis * (1 + aufschlag_prozent / 100))
        else:
            verkaufspreis = eff_bucket_preis

        buch_snapshots.append(
            {
                "buch": buch,
                "bestand": bestand,
                "buch_id": buch_id,
                "preis_cents": verkaufspreis,
                "titel": buch.titel,
                "zustand": bestand.zustand,
                "nutzungsjahr_beim_kauf": nj_beim_kauf,
            }
        )
        summe += verkaufspreis

    # ── Lernmaterial-Positionen verarbeiten ─────────────────────────────
    lm_snapshots = []
    for pos in (data.lernmaterial_positionen or []):
        material = (
            db.query(Lernmaterial)
            .filter(Lernmaterial.id == pos.id, Lernmaterial.geloescht_am.is_(None))
            .with_for_update()
            .first()
        )
        if not material:
            raise HTTPException(status_code=404, detail=f"Lernmaterial {pos.id} nicht gefunden")
        frei = material.bestand_gesamt - material.bestand_ausgegeben
        if frei < pos.menge:
            raise HTTPException(
                status_code=422,
                detail={
                    "error": {
                        "code": "LERNMATERIAL_NICHT_VERFUEGBAR",
                        "message": f"'{material.name}' ist nur noch {frei}× verfügbar",
                        "details": {"lernmaterial_id": pos.id, "verfuegbar": frei, "angefragt": pos.menge},
                    }
                },
            )
        lm_snapshots.append({"material": material, "preis_cents": material.preis_cents, "menge": pos.menge})
        summe += material.preis_cents * pos.menge

    for fp in (data.freiposten or []):
        summe += fp.betrag_cents

    # ── Inline-Rückgaben (kombinierter Flow) ────────────────────────────
    pre_saldo = get_saldo(db, data.schueler_id) if data.guthaben_verrechnen else 0
    verrechnet = 0
    verrechnung_zuordnung = []

    # Merge old rueckgabe_posten_ids and new rueckgaben list
    alle_rueckgaben = list(data.rueckgaben)
    for rp_id in data.rueckgabe_posten_ids:
        from app.schemas import GutschriftRueckgabeRequest as _GRR
        alle_rueckgaben.append(_GRR(rechnungs_posten_id=rp_id, beschaedigt=False))

    if alle_rueckgaben:
        abschlaege = get_nutzungsjahr_abschlaege(db)
        zustand_abschlaege = get_zustand_abschlaege(db)
        inline_gutschrift_id = generate_gutschrift_id(db, schuljahr)

        rueckgabe_validated = []
        for entry in alle_rueckgaben:
            rp_id = entry.rechnungs_posten_id
            beschaedigt = entry.beschaedigt
            zustand = "beschaedigt" if beschaedigt else entry.zustand
            rp = db.query(RechnungsPosten).filter(RechnungsPosten.id == rp_id).first()
            if not rp:
                raise HTTPException(status_code=404, detail=f"Rechnungsposten {rp_id} nicht gefunden")
            rechnung_alt = db.query(Rechnungen).filter(Rechnungen.id == rp.rechnung_id).first()
            if not rechnung_alt or rechnung_alt.schueler_id != data.schueler_id:
                raise HTTPException(status_code=422, detail=f"Rechnungsposten {rp_id} gehoert nicht zu Schueler {data.schueler_id}")
            if rechnung_alt.status == "storniert":
                raise HTTPException(status_code=422, detail=f"Rechnung {rechnung_alt.id} ist storniert")
            if rp.zurueckgegeben:
                raise HTTPException(
                    status_code=422,
                    detail={
                        "error": {
                            "code": "BEREITS_ZURUECKGEGEBEN",
                            "message": f"Posten {rp_id} wurde bereits zurueckgegeben",
                            "details": {"rechnungs_posten_id": rp_id},
                        }
                    },
                )
            buch_r = db.query(Buecher).filter(Buecher.id == rp.buch_id).first()
            if beschaedigt:
                betrag, nj, abschreibung_pct, bucket_betrag = 0, 0, 0, 0
            else:
                betrag, nj, abschreibung_pct = berechne_gutschrift_nutzungsjahr(
                    rp.preis_cents,
                    rechnung_alt.schuljahr,
                    schuljahr,
                    abschlaege,
                    buch_r.schutzgebuehr_cents if buch_r else None,
                    buch_r.preis_cents if buch_r else None,
                    rp.nutzungsjahr_beim_kauf,
                )
                bucket_betrag = berechne_bucket_preis(
                    buch_r.preis_cents if buch_r else betrag,
                    nj,
                    abschlaege,
                    buch_r.schutzgebuehr_cents if buch_r else None,
                )
                zustand_abschlag = zustand_abschlaege.get(zustand, 0)
                if zustand_abschlag > abschreibung_pct:
                    abschreibung_pct = zustand_abschlag
                    basispreis = buch_r.preis_cents if buch_r else betrag
                    betrag = berechne_wiederverkaufspreis(basispreis, abschreibung_pct)
                    bucket_betrag = betrag
            rueckgabe_validated.append({
                "rp": rp, "buch": buch_r, "betrag": betrag, "bucket_betrag": bucket_betrag,
                "abschreibung_pct": abschreibung_pct, "nj": nj, "beschaedigt": beschaedigt,
                "zustand": zustand,
            })

        rueckgabe_credit = sum(v["betrag"] for v in rueckgabe_validated)
        inline_gutschrift = Gutschriften(
            id=inline_gutschrift_id,
            schueler_id=data.schueler_id,
            schuljahr=schuljahr,
            datum=today,
            summe_cents=rueckgabe_credit,
            ausgezahlt=0,
        )
        db.add(inline_gutschrift)
        db.flush()

        remaining = summe
        for vp in rueckgabe_validated:
            rp = vp["rp"]
            buch_r = vp["buch"]
            rp.zurueckgegeben = 1
            rp.zurueckgegeben_am = today
            if buch_r:
                buch_r.bestand_ausgegeben = max(0, buch_r.bestand_ausgegeben - 1)
                if vp["beschaedigt"]:
                    buch_r.bestand_gesamt = max(0, buch_r.bestand_gesamt - 1)
            if not vp["beschaedigt"]:
                bestand_r = _get_or_create_bestand(
                    db, rp.buch_id, vp["bucket_betrag"], vp["nj"], vp["zustand"]
                )
                bestand_r.bestand_verfuegbar += 1
            gp = GutschriftPosten(
                gutschrift_id=inline_gutschrift_id,
                rechnungs_posten_id=rp.id,
                betrag_cents=vp["betrag"],
                zustand=vp["zustand"],
                abschreibung_prozent=vp["abschreibung_pct"],
                ursprungs_preis_cents=rp.preis_cents,
                nutzungsjahr=vp["nj"],
                beschaedigt=1 if vp["beschaedigt"] else 0,
            )
            db.add(gp)
            db.flush()
            if not vp["beschaedigt"] and remaining > 0:
                anteil = min(vp["betrag"], remaining)
                verrechnung_zuordnung.append({
                    "gutschrift_posten_id": gp.id,
                    "quelle_typ": "rueckgabe",
                    "buch_id": rp.buch_id,
                    "titel": buch_r.titel if buch_r else "Unbekannt",
                    "betrag_cents": anteil,
                })
                remaining -= anteil

        verrechnet = summe - remaining
    else:
        verrechnet = 0
        verrechnung_zuordnung = []

    # ── Guthaben aus bestehendem Konto-Saldo verrechnen ─────────────────
    remaining_after_returns = summe - verrechnet
    if data.guthaben_verrechnen and pre_saldo > 0 and remaining_after_returns > 0:
        guthaben_anteil = min(pre_saldo, remaining_after_returns)
        verrechnung_zuordnung.extend(
            _berechne_verrechnungszuordnung(db, data.schueler_id, guthaben_anteil)
        )
        verrechnet += guthaben_anteil

    rechnung = Rechnungen(
        id=rechnung_id,
        anzeige_nr=rechnung_id,
        schueler_id=data.schueler_id,
        schuljahr=schuljahr,
        datum=today,
        summe_cents=summe,
        verrechnet_cents=verrechnet,
        status="offen",
        notizen=data.notizen,
    )
    db.add(rechnung)
    db.flush()

    posten_list = []
    for snap in buch_snapshots:
        posten = RechnungsPosten(
            rechnung_id=rechnung_id,
            buch_id=snap["buch_id"],
            preis_cents=snap["preis_cents"],
            zustand=snap["zustand"],
            nutzungsjahr_beim_kauf=snap["nutzungsjahr_beim_kauf"],
        )
        db.add(posten)
        db.flush()

        posten_list.append({"posten": posten, "titel": snap["titel"]})
        snap["buch"].bestand_ausgegeben += 1
        snap["bestand"].bestand_verfuegbar = max(0, snap["bestand"].bestand_verfuegbar - 1)

    lm_posten_list = []
    for snap in lm_snapshots:
        lm_posten = LernmaterialPosten(
            rechnung_id=rechnung_id,
            lernmaterial_id=snap["material"].id,
            preis_cents=snap["preis_cents"],
            menge=snap["menge"],
        )
        db.add(lm_posten)
        db.flush()
        lm_posten_list.append({"posten": lm_posten, "material": snap["material"]})
        snap["material"].bestand_ausgegeben += snap["menge"]

    # ── Freiposten anlegen ───────────────────────────────────────────────
    frei_list = []
    for fp in (data.freiposten or []):
        frei = RechnungFreiposten(
            rechnung_id=rechnung_id,
            bezeichnung=fp.bezeichnung,
            betrag_cents=fp.betrag_cents,
            typ=fp.typ,
        )
        db.add(frei)
        db.flush()
        frei_list.append(frei)

    for v in verrechnung_zuordnung:
        rv = RechnungVerrechnung(
            rechnung_id=rechnung_id,
            gutschrift_posten_id=v["gutschrift_posten_id"],
            quelle_typ=v["quelle_typ"],
            betrag_cents=v["betrag_cents"],
        )
        db.add(rv)

    _mark_entwurf_abgeschlossen(db, data.entwurf_id, current_user, data.schueler_id)
    db.commit()

    return VerkaufResponse(
        id=rechnung_id,
        schueler_id=data.schueler_id,
        datum=today,
        summe_cents=summe,
        verrechnet_cents=verrechnet,
        zu_zahlen_cents=summe - verrechnet,
        posten=[
            RechnungsPostenResponse(
                rechnungs_posten_id=p["posten"].id,
                buch_id=p["posten"].buch_id,
                titel=p["titel"],
                preis_cents=p["posten"].preis_cents,
                zustand=p["posten"].zustand,
            )
            for p in posten_list
        ],
        lernmaterial_posten=[
            LernmaterialPostenResponse(
                lernmaterial_posten_id=p["posten"].id,
                lernmaterial_id=p["posten"].lernmaterial_id,
                name=p["material"].name,
                kategorie=p["material"].kategorie,
                preis_cents=p["posten"].preis_cents,
                menge=p["posten"].menge,
            )
            for p in lm_posten_list
        ],
        freiposten=[
            FreipostenResponse(
                id=fp.id,
                bezeichnung=fp.bezeichnung,
                betrag_cents=fp.betrag_cents,
                typ=fp.typ,
            )
            for fp in frei_list
        ],
        verrechnung_posten=[
            RechnungVerrechnungPostenResponse(
                gutschrift_posten_id=v["gutschrift_posten_id"],
                quelle_typ=v["quelle_typ"],
                buch_id=v["buch_id"],
                titel=v["titel"],
                betrag_cents=v["betrag_cents"],
            )
            for v in verrechnung_zuordnung
        ],
    )


@router.get("/rechnungen/entwuerfe", response_model=RechnungEntwurfListResponse)
def list_rechnung_entwuerfe(
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    _cleanup_old_entwuerfe(db)
    rows = (
        db.query(RechnungEntwurf)
        .filter(RechnungEntwurf.status == "in_bearbeitung")
        .order_by(RechnungEntwurf.geaendert_am.desc())
        .all()
    )
    visible = [row for row in rows if _can_access_entwurf(row, current_user)]
    db.commit()
    return RechnungEntwurfListResponse(
        items=[_entwurf_to_response(db, row) for row in visible]
    )


@router.post("/rechnungen/entwuerfe", response_model=RechnungEntwurfResponse, status_code=201)
def create_rechnung_entwurf(
    data: RechnungEntwurfSaveRequest,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    _cleanup_old_entwuerfe(db)
    now = _now_iso()
    entwurf = RechnungEntwurf(
        flow=data.flow,
        schueler_id=data.schueler_id,
        form_state_json=json.dumps(data.form_state, ensure_ascii=False),
        bearbeiter=current_user,
        freigegeben_an_json="[]",
        status="in_bearbeitung",
        erstellt_am=now,
        geaendert_am=now,
    )
    db.add(entwurf)
    db.commit()
    db.refresh(entwurf)
    return _entwurf_to_response(db, entwurf)


@router.get("/rechnungen/entwuerfe/{entwurf_id}", response_model=RechnungEntwurfResponse)
def get_rechnung_entwurf(
    entwurf_id: int,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    entwurf = db.query(RechnungEntwurf).filter(RechnungEntwurf.id == entwurf_id).first()
    if not entwurf or entwurf.status != "in_bearbeitung":
        raise HTTPException(status_code=404, detail="Entwurf nicht gefunden")
    if not _can_access_entwurf(entwurf, current_user):
        raise HTTPException(status_code=403, detail="Keine Berechtigung fuer diesen Entwurf")
    return _entwurf_to_response(db, entwurf)


@router.patch("/rechnungen/entwuerfe/{entwurf_id}", response_model=RechnungEntwurfResponse)
def update_rechnung_entwurf(
    entwurf_id: int,
    data: RechnungEntwurfSaveRequest,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    _cleanup_old_entwuerfe(db)
    entwurf = db.query(RechnungEntwurf).filter(RechnungEntwurf.id == entwurf_id).first()
    if not entwurf or entwurf.status != "in_bearbeitung":
        raise HTTPException(status_code=404, detail="Entwurf nicht gefunden")
    if not _can_access_entwurf(entwurf, current_user):
        raise HTTPException(status_code=403, detail="Keine Berechtigung fuer diesen Entwurf")
    if data.flow != entwurf.flow or data.schueler_id != entwurf.schueler_id:
        raise HTTPException(status_code=400, detail="Entwurf kann nicht auf einen anderen Vorgang verschoben werden")
    if data.geaendert_am and entwurf.geaendert_am and data.geaendert_am < entwurf.geaendert_am:
        raise HTTPException(status_code=409, detail="Entwurf wurde zwischenzeitlich geaendert")

    entwurf.form_state_json = json.dumps(data.form_state, ensure_ascii=False)
    entwurf.freigegeben_an_json = "[]"
    entwurf.geaendert_am = _now_iso()
    db.commit()
    db.refresh(entwurf)
    return _entwurf_to_response(db, entwurf)


@router.delete("/rechnungen/entwuerfe/{entwurf_id}", status_code=204)
def delete_rechnung_entwurf(
    entwurf_id: int,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    entwurf = db.query(RechnungEntwurf).filter(RechnungEntwurf.id == entwurf_id).first()
    if not entwurf or entwurf.status != "in_bearbeitung":
        raise HTTPException(status_code=404, detail="Entwurf nicht gefunden")
    if not _can_access_entwurf(entwurf, current_user):
        raise HTTPException(status_code=403, detail="Keine Berechtigung fuer diesen Entwurf")
    db.delete(entwurf)
    db.commit()
    return Response(status_code=204)


@router.get("/rechnungen")
def list_rechnungen(limit: int = 5, db: Session = Depends(get_db)):
    rows = (
        db.query(Rechnungen)
        .order_by(Rechnungen.erstellt_am.desc())
        .limit(min(limit, 50))
        .all()
    )
    items = []
    for r in rows:
        schueler = db.query(Schueler).filter(Schueler.id == r.schueler_id).first()
        items.append({
            "id": r.id,
            "schueler_id": r.schueler_id,
            "schueler_name": f"{schueler.nachname}, {schueler.vorname}" if schueler else "Unbekannt",
            "datum": r.datum,
            "summe_cents": r.summe_cents,
            "status": r.status,
        })
    return {"items": items}


@router.get("/rechnungen/{rechnung_id}", response_model=RechnungDetailResponse)
def get_rechnung(rechnung_id: str, db: Session = Depends(get_db)):
    r = db.query(Rechnungen).filter(Rechnungen.id == rechnung_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Rechnung nicht gefunden")

    posten = (
        db.query(RechnungsPosten)
        .filter(RechnungsPosten.rechnung_id == rechnung_id)
        .all()
    )

    posten_responses = []
    for p in posten:
        buch = db.query(Buecher).filter(Buecher.id == p.buch_id).first()
        posten_responses.append(
            RechnungsPostenResponse(
                rechnungs_posten_id=p.id,
                buch_id=p.buch_id,
                titel=buch.titel if buch else "Unbekannt",
                preis_cents=p.preis_cents,
                zustand=p.zustand,
            )
        )

    lm_posten = (
        db.query(LernmaterialPosten)
        .filter(LernmaterialPosten.rechnung_id == rechnung_id)
        .all()
    )
    lm_posten_responses = []
    for lmp in lm_posten:
        material = db.query(Lernmaterial).filter(Lernmaterial.id == lmp.lernmaterial_id).first()
        lm_posten_responses.append(
            LernmaterialPostenResponse(
                lernmaterial_posten_id=lmp.id,
                lernmaterial_id=lmp.lernmaterial_id,
                name=material.name if material else "Unbekannt",
                kategorie=material.kategorie if material else "",
                preis_cents=lmp.preis_cents,
                menge=lmp.menge,
            )
        )

    freiposten = (
        db.query(RechnungFreiposten)
        .filter(RechnungFreiposten.rechnung_id == rechnung_id)
        .all()
    )
    verrechnung_posten = _lade_verrechnungsposten(db, rechnung_id)

    return RechnungDetailResponse(
        id=r.id,
        anzeige_nr=r.anzeige_nr or r.id,
        schueler_id=r.schueler_id,
        schuljahr=r.schuljahr,
        datum=r.datum,
        summe_cents=r.summe_cents,
        verrechnet_cents=r.verrechnet_cents,
        status=r.status,
        storniert_am=r.storniert_am,
        notizen=r.notizen,
        posten=posten_responses,
        lernmaterial_posten=lm_posten_responses,
        freiposten=[
            FreipostenResponse(id=fp.id, bezeichnung=fp.bezeichnung, betrag_cents=fp.betrag_cents, typ=fp.typ)
            for fp in freiposten
        ],
        verrechnung_posten=verrechnung_posten,
    )


@router.post(
    "/rechnungen/{rechnung_id}/storno",
    status_code=200,
    response_model=RechnungStornoResponse,
)
def storno_rechnung(
    rechnung_id: str,
    data: RechnungStornoRequest | None = Body(default=None),
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    if data is None:
        raise HTTPException(status_code=422, detail="Storno-Grund ist erforderlich")
    grund = data.grund.strip()
    if len(grund) < 3:
        raise HTTPException(status_code=422, detail="Storno-Grund ist erforderlich")

    r = db.query(Rechnungen).filter(Rechnungen.id == rechnung_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Rechnung nicht gefunden")

    if r.status == "storniert":
        raise HTTPException(status_code=422, detail="Rechnung ist bereits storniert")

    alle_buch_posten = (
        db.query(RechnungsPosten)
        .filter(RechnungsPosten.rechnung_id == rechnung_id)
        .all()
    )
    requested_ids = set(data.rechnungs_posten_ids or [])
    if requested_ids:
        posten = [p for p in alle_buch_posten if p.id in requested_ids]
        found_ids = {p.id for p in posten}
        missing_ids = requested_ids - found_ids
        if missing_ids:
            raise HTTPException(
                status_code=404,
                detail=f"Rechnungsposten nicht gefunden: {', '.join(map(str, sorted(missing_ids)))}",
            )
    else:
        posten = [p for p in alle_buch_posten if not p.zurueckgegeben and not p.behalten]

    full_invoice_storno = not requested_ids
    if requested_ids and not posten:
        raise HTTPException(status_code=422, detail="Keine stornierbaren Buchpositionen gefunden")
    if any(p.zurueckgegeben or p.behalten for p in posten):
        raise HTTPException(status_code=422, detail="Mindestens eine Position ist bereits zurueckgegeben oder behalten")

    today = date.today().isoformat()
    stornierte_ids = []
    stornierter_betrag = 0
    for p in posten:
        buch = db.query(Buecher).filter(Buecher.id == p.buch_id).first()
        if buch:
            buch.bestand_ausgegeben = max(0, buch.bestand_ausgegeben - 1)
        nj = p.nutzungsjahr_beim_kauf if p.nutzungsjahr_beim_kauf is not None else 0
        bestand = _get_or_create_bestand(db, p.buch_id, p.preis_cents, nj, p.zustand)
        bestand.bestand_verfuegbar += 1
        p.zurueckgegeben = 1
        p.zurueckgegeben_am = today
        stornierte_ids.append(p.id)
        stornierter_betrag += p.preis_cents

    if full_invoice_storno:
        lm_posten = (
            db.query(LernmaterialPosten)
            .filter(LernmaterialPosten.rechnung_id == rechnung_id)
            .all()
        )
        for lmp in lm_posten:
            material = db.query(Lernmaterial).filter(Lernmaterial.id == lmp.lernmaterial_id).first()
            if material:
                material.bestand_ausgegeben = max(0, material.bestand_ausgegeben - lmp.menge)
            stornierter_betrag += lmp.preis_cents * lmp.menge

        freiposten_summe = db.query(
            func.coalesce(func.sum(RechnungFreiposten.betrag_cents), 0)
        ).filter(RechnungFreiposten.rechnung_id == rechnung_id).scalar() or 0
        stornierter_betrag += freiposten_summe

    if stornierter_betrag <= 0:
        raise HTTPException(status_code=422, detail="Keine stornierbaren Positionen gefunden")

    paid_cents = _rechnung_paid_cents(db, rechnung_id)
    zu_zahlen_vor_storno = max(0, r.summe_cents - r.verrechnet_cents)
    bezahlter_storno_anteil = min(paid_cents, stornierter_betrag, zu_zahlen_vor_storno)
    gutschrift_id = None
    if bezahlter_storno_anteil > 0:
        gutschrift_id = generate_gutschrift_id(db, r.schuljahr)
        db.add(Gutschriften(
            id=gutschrift_id,
            schueler_id=r.schueler_id,
            schuljahr=r.schuljahr,
            datum=today,
            summe_cents=bezahlter_storno_anteil,
            ausgezahlt=0,
            notizen=f"Storno Rechnung {r.anzeige_nr or rechnung_id}: {grund}",
        ))
        db.flush()
        remaining_credit = bezahlter_storno_anteil
        for p in posten:
            if remaining_credit <= 0:
                break
            anteil = min(p.preis_cents, remaining_credit)
            db.add(GutschriftPosten(
                gutschrift_id=gutschrift_id,
                rechnungs_posten_id=p.id,
                betrag_cents=anteil,
                zustand=p.zustand,
                abschreibung_prozent=0,
                ursprungs_preis_cents=p.preis_cents,
                nutzungsjahr=p.nutzungsjahr_beim_kauf,
                beschaedigt=0,
            ))
            remaining_credit -= anteil

    if full_invoice_storno:
        r.status = "storniert"
        r.storniert_am = _now_iso()
    else:
        r.summe_cents = max(0, r.summe_cents - stornierter_betrag)
        if r.verrechnet_cents > r.summe_cents:
            r.verrechnet_cents = r.summe_cents
        offen = max(0, r.summe_cents - r.verrechnet_cents)
        r.status = "bezahlt" if offen == 0 or paid_cents >= offen else "offen"
        r.notizen = ((r.notizen + "\n") if r.notizen else "") + f"Teilstorno am {today}: {grund}"

    aktion = "rechnung_storno" if full_invoice_storno else "position_storno"
    for p in posten:
        db.add(RechnungStornoAudit(
            rechnung_id=rechnung_id,
            rechnungs_posten_id=p.id,
            aktion=aktion,
            grund=grund,
            benutzer=current_user,
            betrag_cents=stornierter_betrag if full_invoice_storno else p.preis_cents,
            gutschrift_id=gutschrift_id,
        ))
    if full_invoice_storno and not posten:
        db.add(RechnungStornoAudit(
            rechnung_id=rechnung_id,
            rechnungs_posten_id=None,
            aktion=aktion,
            grund=grund,
            benutzer=current_user,
            betrag_cents=stornierter_betrag,
            gutschrift_id=gutschrift_id,
        ))

    db.commit()

    return RechnungStornoResponse(
        status=r.status,
        rechnung_id=rechnung_id,
        stornierte_posten_ids=stornierte_ids,
        gutschrift_id=gutschrift_id,
        betrag_cents=stornierter_betrag,
    )


@router.post("/rechnungen/{rechnung_id}/archivieren", status_code=200)
def archivieren_rechnung(rechnung_id: str, db: Session = Depends(get_db)):
    r = db.query(Rechnungen).filter(Rechnungen.id == rechnung_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Rechnung nicht gefunden")
    if r.status == "storniert":
        raise HTTPException(status_code=422, detail="Stornierte Rechnungen können nicht archiviert werden")
    r.status = "archiviert"
    db.commit()
    return {"status": "archiviert", "rechnung_id": rechnung_id}


@router.post("/rechnungen/{rechnung_id}/unarchivieren", status_code=200)
def unarchivieren_rechnung(rechnung_id: str, db: Session = Depends(get_db)):
    r = db.query(Rechnungen).filter(Rechnungen.id == rechnung_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Rechnung nicht gefunden")
    if r.status != "archiviert":
        raise HTTPException(status_code=422, detail="Rechnung ist nicht archiviert")
    r.status = "offen"
    db.commit()
    return {"status": "offen", "rechnung_id": rechnung_id}


@router.patch("/rechnungen/{rechnung_id}/anzeige-nr")
def update_anzeige_nr(rechnung_id: str, data: RechnungAnzeigeNrUpdate, db: Session = Depends(get_db)):
    r = db.query(Rechnungen).filter(Rechnungen.id == rechnung_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Rechnung nicht gefunden")

    value = data.anzeige_nr.strip()
    if not value:
        raise HTTPException(status_code=400, detail="Rechnungsnummer darf nicht leer sein")

    konflikt = (
        db.query(Rechnungen)
        .filter(Rechnungen.anzeige_nr == value, Rechnungen.id != rechnung_id)
        .first()
    )
    if konflikt:
        raise HTTPException(status_code=409, detail="Diese Rechnungsnummer ist bereits vergeben")

    r.anzeige_nr = value
    db.commit()
    return {"id": r.id, "anzeige_nr": r.anzeige_nr}


@router.get("/rechnungen/{rechnung_id}/pdf")
def get_rechnung_pdf(rechnung_id: str, db: Session = Depends(get_db)):
    html = render_rechnung_html(db, rechnung_id)
    if not html:
        raise HTTPException(status_code=404, detail="Rechnung nicht gefunden")

    pdf_bytes = render_rechnung_pdf(db, rechnung_id)
    if not pdf_bytes:
        raise HTTPException(
            status_code=501,
            detail="PDF-Erzeugung nicht verfuegbar (WeasyPrint nicht installiert)",
        )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{rechnung_id}.pdf"'},
    )


@router.get("/rechnungen/{rechnung_id}/html", response_class=HTMLResponse)
def get_rechnung_html(rechnung_id: str, db: Session = Depends(get_db)):
    html = render_rechnung_html(db, rechnung_id)
    if not html:
        raise HTTPException(status_code=404, detail="Rechnung nicht gefunden")

    return HTMLResponse(content=html)


@router.get(
    "/rechnungen/{rechnung_id}/mail-vorlage",
    response_model=RechnungMailPreviewResponse,
)
def get_rechnung_mail_vorlage(rechnung_id: str, db: Session = Depends(get_db)):
    try:
        payload = get_invoice_mail_preview(db, rechnung_id)
        return RechnungMailPreviewResponse(**payload)
    except ValueError as exc:
        if "nicht gefunden" in str(exc).lower():
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except MailTemplateError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post(
    "/rechnungen/{rechnung_id}/mail-vorschau",
    response_model=RechnungMailPreviewResponse,
)
def preview_rechnung_mail(
    rechnung_id: str,
    data: RechnungMailPreviewRequest,
    db: Session = Depends(get_db),
):
    try:
        payload = get_invoice_mail_preview(
            db,
            rechnung_id,
            to_email=data.to_email,
            subject_template=data.subject_template,
            body_template=data.body_template,
        )
        return RechnungMailPreviewResponse(**payload)
    except ValueError as exc:
        if "nicht gefunden" in str(exc).lower():
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except MailTemplateError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/rechnungen/{rechnung_id}/mail", response_model=RechnungMailSendResponse)
def send_rechnung_mail(
    rechnung_id: str,
    data: RechnungMailSendRequest,
    db: Session = Depends(get_db),
):
    try:
        payload = send_invoice_mail(
            db,
            rechnung_id,
            to_email=data.to_email,
            subject_template=data.subject_template,
            body_template=data.body_template,
        )
        rechnung = db.query(Rechnungen).filter(Rechnungen.id == rechnung_id).first()
        if rechnung:
            rechnung.mail_versandt_am = date.today().isoformat()
            rechnung.mail_versandt_an = payload["to_email"]
            db.commit()
        return RechnungMailSendResponse(**payload)
    except ValueError as exc:
        if "nicht gefunden" in str(exc).lower():
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except (MailConfigurationError, MailTemplateError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except MailDeliveryError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
