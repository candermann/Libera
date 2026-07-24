"""
Tests for the Benutzer role system (backend/app/security.py::is_admin_user,
backend/app/routers/admin.py's require_admin gate).

The literal 'admin' account is always admin. Any Benutzer row can be promoted
via `rolle = 'admin'`, which should grant the same admin-only endpoints.
"""

from app.main import app
from app.models import Benutzer
from app.security import get_current_user


class TestBenutzerRolle:
    def _login_as(self, client, username):
        app.dependency_overrides[get_current_user] = lambda: username

    def test_standard_user_is_rejected_from_admin_endpoints(self, client):
        # "sekretariat" is seeded by prepare_schema() with the default 'standard' rolle.
        self._login_as(client, "sekretariat")
        resp = client.get("/api/admin/benutzer")
        assert resp.status_code == 403

    def test_promoted_user_gets_admin_access(self, client, db_session):
        seeded = db_session.query(Benutzer).filter(Benutzer.benutzername == "sekretariat").first()
        seeded.rolle = "admin"
        db_session.commit()

        self._login_as(client, "sekretariat")
        resp = client.get("/api/admin/benutzer")
        assert resp.status_code == 200

    def test_default_rolle_for_seeded_users_is_standard(self, client):
        # client fixture is authenticated as "admin" by default.
        resp = client.get("/api/admin/benutzer")
        assert resp.status_code == 200
        by_name = {b["benutzername"]: b["rolle"] for b in resp.json()}
        assert by_name["lehrer"] == "standard"
        assert by_name["schulleiter"] == "standard"
        assert by_name["sekretariat"] == "standard"

    def test_create_benutzer_with_admin_rolle(self, client):
        resp = client.post("/api/admin/benutzer", json={
            "benutzername": "neueradmin", "passwort": "irgendwas123", "rolle": "admin",
        })
        assert resp.status_code == 201, resp.text
        assert resp.json()["rolle"] == "admin"

        listing = client.get("/api/admin/benutzer").json()
        assert next(b for b in listing if b["benutzername"] == "neueradmin")["rolle"] == "admin"

    def test_create_benutzer_invalid_rolle_falls_back_to_standard(self, client):
        resp = client.post("/api/admin/benutzer", json={
            "benutzername": "x", "passwort": "irgendwas123", "rolle": "superuser",
        })
        assert resp.status_code == 201
        assert resp.json()["rolle"] == "standard"

    def test_change_benutzer_rolle(self, client):
        client.post("/api/admin/benutzer", json={"benutzername": "lehrer2", "passwort": "irgendwas123"})

        resp = client.patch("/api/admin/benutzer/lehrer2/rolle", json={"rolle": "admin"})
        assert resp.status_code == 200
        assert resp.json()["rolle"] == "admin"

        # The promoted user can now reach admin endpoints themselves.
        self._login_as(client, "lehrer2")
        assert client.get("/api/admin/benutzer").status_code == 200

    def test_change_benutzer_rolle_rejects_invalid_value(self, client):
        client.post("/api/admin/benutzer", json={"benutzername": "lehrer3", "passwort": "irgendwas123"})
        resp = client.patch("/api/admin/benutzer/lehrer3/rolle", json={"rolle": "superuser"})
        assert resp.status_code == 422

    def test_auth_me_reflects_promoted_rolle(self, client, db_session):
        seeded = db_session.query(Benutzer).filter(Benutzer.benutzername == "sekretariat").first()
        seeded.rolle = "admin"
        db_session.commit()

        self._login_as(client, "sekretariat")
        resp = client.get("/api/auth/me")
        assert resp.status_code == 200
        assert resp.json() == {"username": "sekretariat", "ist_admin": True}

    def test_auth_me_standard_user_not_admin(self, client):
        # "lehrer" is seeded with the default 'standard' rolle.
        self._login_as(client, "lehrer")
        resp = client.get("/api/auth/me")
        assert resp.json() == {"username": "lehrer", "ist_admin": False}

    def test_literal_admin_account_is_always_admin(self, client):
        # client fixture default: logged in as "admin", which has no Benutzer row at all.
        resp = client.get("/api/auth/me")
        assert resp.json() == {"username": "admin", "ist_admin": True}


class TestEinstellungenGating:
    """PATCH /api/einstellungen touches bank IBAN/BIC, SMTP credentials, and
    pricing discounts - restricted to admins since 24.07.2026 (see BugFix.md)."""

    def _login_as(self, client, username):
        app.dependency_overrides[get_current_user] = lambda: username

    def test_standard_user_cannot_change_settings(self, client):
        self._login_as(client, "schulleiter")
        resp = client.patch("/api/einstellungen", json={"schule_iban": "DE00 0000 0000 0000 0000 00"})
        assert resp.status_code == 403

    def test_standard_user_can_still_read_settings(self, client):
        # Viewing remains open to any logged-in staff member - only writing is gated.
        self._login_as(client, "schulleiter")
        resp = client.get("/api/einstellungen")
        assert resp.status_code == 200

    def test_promoted_user_can_change_settings(self, client, db_session):
        seeded = db_session.query(Benutzer).filter(Benutzer.benutzername == "schulleiter").first()
        seeded.rolle = "admin"
        db_session.commit()

        self._login_as(client, "schulleiter")
        resp = client.patch("/api/einstellungen", json={"schule_iban": "DE00 0000 0000 0000 0000 00"})
        assert resp.status_code == 200
        assert resp.json()["schule_iban"] == "DE00 0000 0000 0000 0000 00"

    def test_literal_admin_can_change_settings(self, client):
        resp = client.patch("/api/einstellungen", json={"schule_iban": "DE11 1111 1111 1111 1111 11"})
        assert resp.status_code == 200
        assert resp.json()["schule_iban"] == "DE11 1111 1111 1111 1111 11"
