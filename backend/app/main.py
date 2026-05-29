"""
FastAPI application — entry point.

Mounts all routers, CORS middleware, static frontend, and health endpoint.
"""

import os
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.limiter import limiter

from app.db import init_db
from app.schemas import HealthResponse
from app.routers import (
    schueler,
    buecher,
    lernmaterial,
    freiposten,
    verkauf,
    gutschrift,
    zahlungen,
    auszahlungen,
    dashboard,
    einstellungen,
    buchhaltung,
    auth,
    klassenversetzung,
    benachrichtigungen,
    admin,
)
from app.security import ensure_security_config, get_current_user


def _load_cors_origins() -> list[str]:
    raw_origins = os.getenv("CORS_ORIGINS", "")
    origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
    if not origins:
        raise RuntimeError(
            "CORS_ORIGINS environment variable is required and must list at least one origin."
        )
    if "*" in origins:
        raise RuntimeError("CORS_ORIGINS must not contain '*' when credentials are enabled.")
    return origins


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup."""
    ensure_security_config()
    init_db()
    yield


app = FastAPI(
    title="Schulbuch-Verwaltung",
    description="Backend für die Schulbuch-Verwaltung — Verkauf, Rückgabe, Saldo, PDF",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS ─────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=_load_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── API Routers ──────────────────────────────────────────────────────────
from fastapi import Depends
protected = [Depends(get_current_user)]

app.include_router(auth.router)
app.include_router(schueler.router, dependencies=protected)
app.include_router(buecher.router, dependencies=protected)
app.include_router(lernmaterial.router, dependencies=protected)
app.include_router(freiposten.router, dependencies=protected)
app.include_router(verkauf.router, dependencies=protected)
app.include_router(gutschrift.router, dependencies=protected)
app.include_router(zahlungen.router, dependencies=protected)
app.include_router(auszahlungen.router, dependencies=protected)
app.include_router(dashboard.router, dependencies=protected)
app.include_router(einstellungen.router, dependencies=protected)
app.include_router(buchhaltung.router, dependencies=protected)
app.include_router(klassenversetzung.router, dependencies=protected)
app.include_router(benachrichtigungen.router, dependencies=protected)
app.include_router(admin.router, dependencies=protected)


# ── Health ───────────────────────────────────────────────────────────────
@app.get("/api/health", response_model=HealthResponse)
def health():
    return HealthResponse(status="ok", version="1.0.0")


# ── Static Frontend (optional) ──────────────────────────────────────────
# Mount frontend directory under "/" — API routes have priority because
# they are registered before the catch-all static mount.
_app_root = Path(__file__).resolve().parent.parent
_frontend_candidates = [
    _app_root / "frontend",  # Docker image layout: /app/frontend
    _app_root.parent / "frontend",  # Local dev layout: repo/frontend
]
_frontend_dir = next((path for path in _frontend_candidates if path.is_dir()), None)
if _frontend_dir:
    app.mount("/", StaticFiles(directory=str(_frontend_dir), html=True), name="frontend")
