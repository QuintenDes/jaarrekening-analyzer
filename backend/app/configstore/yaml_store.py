"""Shared YAML configuration store: atomic writes, versions, history, seed.

Used by ratio configuration and table configuration. Callers keep their own
override paths so existing Docker volumes stay compatible.
"""

from __future__ import annotations

import json
import logging
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

import yaml

logger = logging.getLogger(__name__)

HISTORY_KEEP = 20


class StaleConfigError(Exception):
    """Client version does not match the active configuration version."""

    def __init__(self, current_version: int) -> None:
        self.current_version = current_version
        super().__init__(
            "De configuratie is gewijzigd. Laad opnieuw voordat je opslaat."
        )


def now_iso() -> str:
    return (
        datetime.now(timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )


def atomic_write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(text, encoding="utf-8")
    tmp.replace(path)


def _version_from_stem(stem: str) -> int:
    try:
        return int(stem)
    except ValueError:
        return -1


class YamlConfigStore:
    """File-backed YAML config with sibling meta JSON and a history directory."""

    def __init__(
        self,
        *,
        bundled_path: Path,
        get_override_path: Callable[[], Path],
        get_history_dir: Callable[[], Path],
        history_keep: int = HISTORY_KEEP,
        kind: str = "config",
    ) -> None:
        self.bundled_path = bundled_path
        self._get_override_path = get_override_path
        self._get_history_dir = get_history_dir
        self.history_keep = history_keep
        self.kind = kind
        self._lock = threading.Lock()

    def override_path(self) -> Path:
        return self._get_override_path()

    def meta_path(self) -> Path:
        path = self.override_path()
        return path.with_name(f"{path.stem}.meta.json")

    def history_dir(self) -> Path:
        return self._get_history_dir()

    def active_path(self) -> Path:
        path = self.override_path()
        return path if path.is_file() else self.bundled_path

    def source(self) -> str:
        return "saved" if self.override_path().is_file() else "bundled"

    def _read_meta(self) -> dict:
        path = self.meta_path()
        if not path.is_file():
            return {"version": 1, "updated_at": None}
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return {"version": 1, "updated_at": None}
        version = data.get("version", 1)
        if not isinstance(version, int) or version < 1:
            version = 1
        updated_at = data.get("updated_at")
        if updated_at is not None and not isinstance(updated_at, str):
            updated_at = None
        return {"version": version, "updated_at": updated_at}

    def _write_meta(self, meta: dict) -> None:
        path = self.meta_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_name(path.name + ".tmp")
        tmp.write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
        tmp.replace(path)

    def _ensure_meta(self) -> dict:
        path = self.meta_path()
        if path.is_file():
            return self._read_meta()
        meta = {"version": 1, "updated_at": now_iso()}
        self._write_meta(meta)
        return meta

    def current_meta(self) -> dict:
        if self.override_path().is_file():
            return self._read_meta() if self.meta_path().is_file() else self._ensure_meta()
        return {"version": 1, "updated_at": None}

    def load_document(self) -> dict:
        path = self.active_path()
        with path.open(encoding="utf-8") as handle:
            data = yaml.safe_load(handle)
        return data if isinstance(data, dict) else {}

    def load_text(self) -> str:
        return self.active_path().read_text(encoding="utf-8")

    def _prune_history(self, directory: Path) -> None:
        files = sorted(
            (p for p in directory.glob("*.yaml") if _version_from_stem(p.stem) >= 0),
            key=lambda p: _version_from_stem(p.stem),
            reverse=True,
        )
        for old in files[self.history_keep :]:
            old.unlink(missing_ok=True)
            old.with_suffix(".json").unlink(missing_ok=True)

    def _snapshot_current(self) -> None:
        path = self.override_path()
        if not path.is_file():
            return
        meta = self._read_meta()
        version = meta["version"]
        dest_dir = self.history_dir()
        dest_dir.mkdir(parents=True, exist_ok=True)
        yaml_dest = dest_dir / f"{version}.yaml"
        json_dest = dest_dir / f"{version}.json"
        yaml_dest.write_text(path.read_text(encoding="utf-8"), encoding="utf-8")
        json_dest.write_text(
            json.dumps(
                {"version": version, "updated_at": meta.get("updated_at")},
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
        self._prune_history(dest_dir)

    def persist_text(self, text: str, *, expected_version: int | None) -> dict:
        """Write text to the override file. Raises StaleConfigError on mismatch."""
        with self._lock:
            meta = self.current_meta()
            if expected_version is not None and expected_version != meta["version"]:
                raise StaleConfigError(meta["version"])
            self._snapshot_current()
            atomic_write_text(self.override_path(), text)
            new_meta = {"version": meta["version"] + 1, "updated_at": now_iso()}
            self._write_meta(new_meta)
            return new_meta

    def reset_to_bundled(
        self, *, validate: Callable[[str], object] | None = None
    ) -> tuple[str, dict]:
        bundled_text = self.bundled_path.read_text(encoding="utf-8")
        if validate is not None:
            validate(bundled_text)
        with self._lock:
            meta = self.current_meta()
            self._snapshot_current()
            atomic_write_text(self.override_path(), bundled_text)
            new_meta = {"version": meta["version"] + 1, "updated_at": now_iso()}
            self._write_meta(new_meta)
            return bundled_text, new_meta

    def seed_if_missing(
        self, *, validate: Callable[[str], object] | None = None
    ) -> None:
        path = self.override_path()
        if path.is_file():
            self._ensure_meta()
            logger.info(
                "Live %s config already present at %s; leaving it unchanged.",
                self.kind,
                path,
            )
            return

        bundled_text = self.bundled_path.read_text(encoding="utf-8")
        if validate is not None:
            validate(bundled_text)
        path.parent.mkdir(parents=True, exist_ok=True)
        atomic_write_text(path, bundled_text)
        self._write_meta({"version": 1, "updated_at": now_iso()})
        logger.info(
            "Seeded live %s config from bundled YAML to %s", self.kind, path
        )

    def list_history(self) -> list[dict]:
        directory = self.history_dir()
        if not directory.is_dir():
            return []
        entries: list[dict] = []
        for yaml_path in directory.glob("*.yaml"):
            version = _version_from_stem(yaml_path.stem)
            if version < 0:
                continue
            updated_at = None
            sidecar = yaml_path.with_suffix(".json")
            if sidecar.is_file():
                try:
                    data = json.loads(sidecar.read_text(encoding="utf-8"))
                    raw = data.get("updated_at")
                    if isinstance(raw, str):
                        updated_at = raw
                except (OSError, json.JSONDecodeError):
                    updated_at = None
            entries.append({"version": version, "updated_at": updated_at})
        entries.sort(key=lambda item: item["version"], reverse=True)
        return entries

    def restore_history(
        self,
        version: int,
        *,
        expected_version: int | None = None,
        validate: Callable[[str], object] | None = None,
    ) -> tuple[str, dict]:
        yaml_path = self.history_dir() / f"{version}.yaml"
        if not yaml_path.is_file():
            raise FileNotFoundError(f"Geen snapshot voor versie {version}.")
        text = yaml_path.read_text(encoding="utf-8")
        if validate is not None:
            validate(text)
        with self._lock:
            meta = self.current_meta()
            if expected_version is not None and expected_version != meta["version"]:
                raise StaleConfigError(meta["version"])
            self._snapshot_current()
            atomic_write_text(self.override_path(), text)
            new_meta = {"version": meta["version"] + 1, "updated_at": now_iso()}
            self._write_meta(new_meta)
            return text, new_meta
