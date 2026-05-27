#!/usr/bin/env python3
"""Restore a Bibliomat SQLite backup."""

from __future__ import annotations

import argparse
import shutil
import sqlite3
from datetime import datetime
from pathlib import Path

from backup_db import default_database_path, integrity_check


def main() -> None:
    parser = argparse.ArgumentParser(description="Restore a Bibliomat SQLite backup.")
    parser.add_argument("backup", type=Path, help="Backup .db file to restore.")
    parser.add_argument(
        "--database",
        type=Path,
        default=default_database_path(),
        help="Target schulbuch.db. Stop the app before restoring.",
    )
    parser.add_argument(
        "--yes",
        action="store_true",
        help="Confirm overwrite of the target database.",
    )
    parser.add_argument(
        "--no-safety-copy",
        action="store_true",
        help="Do not create a timestamped copy of the current target database.",
    )
    args = parser.parse_args()

    backup = args.backup.expanduser().resolve()
    target = args.database.expanduser().resolve()

    if not backup.exists():
        raise SystemExit(f"Backup not found: {backup}")
    if not args.yes:
        raise SystemExit("Restore refused without --yes.")

    integrity_check(backup)
    target.parent.mkdir(parents=True, exist_ok=True)

    if target.exists() and not args.no_safety_copy:
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        safety_copy = target.with_name(f"{target.stem}.pre-restore-{timestamp}{target.suffix}")
        shutil.copy2(target, safety_copy)
        print(f"Safety copy: {safety_copy}")

    shutil.copy2(backup, target)

    for suffix in ("-wal", "-shm"):
        sidecar = Path(f"{target}{suffix}")
        if sidecar.exists():
            sidecar.unlink()

    with sqlite3.connect(target) as conn:
        conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")

    integrity_check(target)
    print(f"Restored: {target}")


if __name__ == "__main__":
    main()
