"""
Tests for invoice mail preview + sending endpoints.
"""

from tests.conftest import create_test_buch, create_test_schueler


def _create_rechnung(client):
    schueler = create_test_schueler(client, vorname="Mara", nachname="Becker")
    client.patch(
        f"/api/schueler/{schueler['id']}",
        json={"email_eltern": "eltern@example.org"},
    )
    buch = create_test_buch(client, titel="Chemie 7", preis_cents=2490, bestand_gesamt=10)
    sale = client.post("/api/verkauf", json={"schueler_id": schueler["id"], "buch_ids": [buch["id"]]})
    assert sale.status_code == 201, sale.text
    return schueler, sale.json()["id"]


def _set_mail_defaults(client):
    resp = client.patch(
        "/api/einstellungen",
        json={
            "mail_smtp_host": "smtp.example.org",
            "mail_smtp_port": "587",
            "mail_smtp_username": "mailer",
            "mail_smtp_password": "secret",
            "mail_smtp_use_starttls": "true",
            "mail_smtp_use_ssl": "false",
            "mail_from_email": "sekretariat@example.org",
            "mail_from_name": "Sekretariat",
            "mail_reply_to": "noreply@example.org",
            "mail_subject_template": "Rechnung {{ rechnung.id }} fuer {{ schueler.name }}",
            "mail_body_template": "Hallo {{ schueler.vorname }}, Betrag {{ rechnung.summe_eur }}",
        },
    )
    assert resp.status_code == 200, resp.text


def test_rechnung_mail_vorlage(client):
    _set_mail_defaults(client)
    schueler, rechnung_id = _create_rechnung(client)

    resp = client.get(f"/api/rechnungen/{rechnung_id}/mail-vorlage")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["rechnung_id"] == rechnung_id
    assert data["to_email"] == "eltern@example.org"
    assert schueler["vorname"] in data["rendered_subject"]
    assert "Betrag" in data["rendered_body"]


def test_rechnung_mail_send(client, monkeypatch):
    _set_mail_defaults(client)
    _, rechnung_id = _create_rechnung(client)

    delivered = {}

    def fake_pdf(_db, _rid):
        return b"%PDF-1.4 test"

    def fake_deliver(_config, message):
        delivered["to"] = message["To"]
        delivered["subject"] = message["Subject"]
        delivered["attachments"] = [part.get_filename() for part in message.iter_attachments()]

    monkeypatch.setattr("app.services.mail.render_rechnung_pdf", fake_pdf)
    monkeypatch.setattr("app.services.mail._deliver_via_smtp", fake_deliver)

    resp = client.post(
        f"/api/rechnungen/{rechnung_id}/mail",
        json={
            "to_email": "familie@example.org",
            "subject_template": "Ihre Rechnung {{ rechnung.id }}",
            "body_template": "Bitte begleichen Sie {{ rechnung.zu_zahlen_eur }}.",
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "sent"
    assert body["to_email"] == "familie@example.org"
    assert delivered["to"] == "familie@example.org"
    assert rechnung_id in delivered["subject"]
    assert f"{rechnung_id}.pdf" in delivered["attachments"]


def test_rechnung_mail_requires_recipient(client):
    _set_mail_defaults(client)
    _, rechnung_id = _create_rechnung(client)

    client.patch(
        "/api/einstellungen",
        json={"mail_subject_template": "Rechnung {{ rechnung.id }}", "mail_body_template": "Text"},
    )
    client.patch(
        "/api/einstellungen",
        json={"mail_from_email": "sekretariat@example.org"},
    )

    # Remove student email to force recipient validation.
    detail = client.get(f"/api/rechnungen/{rechnung_id}")
    schueler_id = detail.json()["schueler_id"]
    client.patch(f"/api/schueler/{schueler_id}", json={"email_eltern": ""})

    resp = client.post(f"/api/rechnungen/{rechnung_id}/mail", json={})
    assert resp.status_code == 422
    assert "Empfaenger" in resp.text
