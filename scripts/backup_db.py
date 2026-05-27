#!/usr/bin/env python3
"""Create a consistent SQLite backup for Bibliomat."""

from __future__ import annotations

import argparse
import os
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Optional


ROOT = Path(__file__).resolve().parents[1]


def _path_from_database_url(url: Optional[str]) -> Optional[Path]:
    if not url:
        return None
    if not url.startswith("sqlite:///"):
        raise SystemExit("Only sqlite:/// DATABASE_URL values are supported.")
    raw = url.removeprefix("sqlite:///")
    if raw.startswith("/"):
        return Path(raw)
    return (ROOT / raw).resolve()


def default_database_path() -> Path:
    env_path = _path_from_database_url(os.getenv("DATABASE_URL"))
    if env_path:
        return env_path

    for candidate in (
        ROOT / "data" / "schulbuch.db",
        ROOT / "backend" / "schulbuch.db",
        ROOT / "schulbuch.db",
    ):
        if candidate.exists():
            return candidate

    return ROOT / "data" / "schulbuch.db"


def integrity_check(path: Path) -> None:
    with sqlite3.connect(path) as conn:
        result = conn.execute("PRAGMA integrity_check").fetchone()
    if not result or result[0] != "ok":
        raise SystemExit(f"Integrity check failed for {path}: {result!r}")


def backup_database(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(source) as src, sqlite3.connect(destination) as dst:
        src.backup(dst)
    integrity_check(destination)


def main() -> None:
    parser = argparse.ArgumentParser(description="Create a Bibliomat SQLite backup.")
    parser.add_argument(
        "--database",
        type=Path,
        default=default_database_path(),
        help="Path to schulbuch.db. Defaults to DATABASE_URL or common local paths.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=ROOT / "backups",
        help="Directory for backup files.",
    )
    args = parser.parse_args()

    source = args.database.expanduser().resolve()
    if not source.exists():
        raise SystemExit(f"Database not found: {source}")

    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    destination = args.output_dir.expanduser().resolve() / f"schulbuch-{timestamp}.db"
    backup_database(source, destination)
    print(destination)


if __name__ == "__main__":
    main()
