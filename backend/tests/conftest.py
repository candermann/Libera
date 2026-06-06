"""
Shared test fixtures — temp SQLite DB, FastAPI TestClient.

Each test function gets its own clean database via the `client` fixture.
"""

import os

import pytest
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

# Required security/cors env for app startup in tests
os.environ.setdefault("SECRET_KEY", "test-secret-key-0123456789abcdef0123456789")
os.environ.setdefault("CORS_ORIGINS", "http://localhost")
os.environ.setdefault("EXTRA_USERS_PASSWORD", "test-extra-users-password")

from app.models import Base
from app.db import get_db, prepare_schema
from app.main import app
from app.security import get_current_user


@pytest.fixture()
def db_session(tmp_path):
    """Create a fresh in-memory SQLite database for each test."""
    db_path = tmp_path / "test.db"
    engine = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False},
    )

    @event.listens_for(engine, "connect")
    def _set_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    # Create tables
    Base.metadata.create_all(bind=engine)

    # Create additive schema objects, views, and defaults
    with engine.begin() as conn:
        prepare_schema(conn)

    TestSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestSession()

    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture()
def client(db_session):
    """FastAPI TestClient with overridden DB dependency."""
    def _override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_user] = lambda: "admin"

    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()


# ── Helper functions for tests ───────────────────────────────────────────

def create_test_schueler(client, **kwargs):
    """Create a student and return the response dict."""
    data = {
        "vorname": kwargs.get("vorname", "Test"),
        "nachname": kwargs.get("nachname", "Schüler"),
        "klasse": kwargs.get("klasse", "7a"),
        "strasse": kwargs.get("strasse", "Teststraße 1"),
        "plz": kwargs.get("plz", "52538"),
        "ort": kwargs.get("ort", "Gangelt"),
    }
    resp = client.post("/api/schueler", json=data)
    assert resp.status_code == 201, resp.text
    return resp.json()


def create_test_buch(client, **kwargs):
    """Create a book and return the response dict."""
    data = {
        "titel": kwargs.get("titel", "Testbuch"),
        "fach": kwargs.get("fach", "Mathematik"),
        "stufe": kwargs.get("stufe", 7),
        "verlag": kwargs.get("verlag", "Testverlag"),
        "preis_cents": kwargs.get("preis_cents", 2400),
        "bestand_gesamt": kwargs.get("bestand_gesamt", 50),
    }
    resp = client.post("/api/buecher", json=data)
    assert resp.status_code == 201, resp.text
    return resp.json()
