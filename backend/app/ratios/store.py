"""Persistent live ratio configuration (YAML on the data volume).

Bundled backend/config/ratios.yaml is the canonical default. On first start,
if the override file is missing, it is copied once to RATIOS_CONFIG_PATH
(or backend/data/ratios.yaml). After that the override file is the active
configuration; startup never overwrites it from the bundled YAML.
"""

from __future__ import annotations

import json
import logging
import os
import threading
from datetime import datetime, timezone
from pathlib import Path

import yaml

logger = logging.getLogger(__name__)

CONFIG_DIR = Path(__file__).resolve().parents[2] / "config"
BUNDLED_RATIOS_PATH = CONFIG_DIR / "ratios.yaml"
HISTORY_KEEP = 20

_lock = threading.Lock()


class StaleConfigError(Exception):
    """Client version does not match the active configuration version."""

    def __init__(self, current_version: int) -> None:
        self.current_version = current_version
        super().__init__(
            "De configuratie is gewijzigd. Laad opnieuw voordat je opslaat."
        )


def override_path() -> Path:
    raw = os.environ.get("RATIOS_CONFIG_PATH", "").strip()
    if raw:
        return Path(raw)
    return CONFIG_DIR.parent / "data" / "ratios.yaml"


def meta_path() -> Path:
    path = override_path()
    return path.with_name(f"{path.stem}.meta.json")


def history_dir() -> Path:
    return override_path().parent / "history"


def active_ratios_path() -> Path:
    path = override_path()
    return path if path.is_file() else BUNDLED_RATIOS_PATH


def ratios_config_source() -> str:
    return "saved" if override_path().is_file() else "bundled"


def _now_iso() -> str:
    return (
        datetime.now(timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )


def _read_meta() -> dict:
    path = meta_path()
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


def _write_meta(meta: dict) -> None:
    path = meta_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    tmp.replace(path)


def _ensure_meta() -> dict:
    path = meta_path()
    if path.is_file():
        return _read_meta()
    meta = {"version": 1, "updated_at": _now_iso()}
    _write_meta(meta)
    return meta


def current_meta() -> dict:
    if override_path().is_file():
        return _read_meta() if meta_path().is_file() else _ensure_meta()
    return {"version": 1, "updated_at": None}


def load_active_specs() -> list[dict]:
    path = active_ratios_path()
    with path.open(encoding="utf-8") as handle:
        data = yaml.safe_load(handle)
    if not isinstance(data, dict):
        return []
    ratios = data.get("ratios", [])
    return ratios if isinstance(ratios, list) else []


def _atomic_write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(text, encoding="utf-8")
    tmp.replace(path)


def _dump_specs(specs: list[dict]) -> str:
    return yaml.safe_dump(
        {"ratios": specs},
        allow_unicode=True,
        sort_keys=False,
    )


def _snapshot_current() -> None:
    path = override_path()
    if not path.is_file():
        return
    meta = _read_meta()
    version = meta["version"]
    dest_dir = history_dir()
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
    _prune_history(dest_dir)


def _version_from_stem(stem: str) -> int:
    try:
        return int(stem)
    except ValueError:
        return -1


def _prune_history(directory: Path) -> None:
    files = sorted(
        (p for p in directory.glob("*.yaml") if _version_from_stem(p.stem) >= 0),
        key=lambda p: _version_from_stem(p.stem),
        reverse=True,
    )
    for old in files[HISTORY_KEEP:]:
        old.unlink(missing_ok=True)
        old.with_suffix(".json").unlink(missing_ok=True)


def persist_specs(specs: list[dict], *, expected_version: int | None) -> tuple[list[dict], dict]:
    """Write validated specs to the override file. Raises StaleConfigError on mismatch."""
    with _lock:
        meta = current_meta()
        if expected_version is not None and expected_version != meta["version"]:
            raise StaleConfigError(meta["version"])
        _snapshot_current()
        _atomic_write_text(override_path(), _dump_specs(specs))
        new_meta = {"version": meta["version"] + 1, "updated_at": _now_iso()}
        _write_meta(new_meta)
        return specs, new_meta


def reset_to_bundled() -> tuple[list[dict], dict]:
    """Snapshot current live config, then write bundled YAML into the override file."""
    from app.ratios.engine import parse_ratios_yaml

    with _lock:
        bundled_text = BUNDLED_RATIOS_PATH.read_text(encoding="utf-8")
        specs = parse_ratios_yaml(bundled_text)
        meta = current_meta()
        _snapshot_current()
        _atomic_write_text(override_path(), bundled_text)
        new_meta = {"version": meta["version"] + 1, "updated_at": _now_iso()}
        _write_meta(new_meta)
        return specs, new_meta


def seed_if_missing() -> None:
    """Copy bundled YAML to the override path only when that file does not exist."""
    path = override_path()
    if path.is_file():
        _ensure_meta()
        logger.info("Live ratio config already present at %s; leaving it unchanged.", path)
        return

    from app.ratios.engine import parse_ratios_yaml

    bundled_text = BUNDLED_RATIOS_PATH.read_text(encoding="utf-8")
    parse_ratios_yaml(bundled_text)
    path.parent.mkdir(parents=True, exist_ok=True)
    _atomic_write_text(path, bundled_text)
    _write_meta({"version": 1, "updated_at": _now_iso()})
    logger.info("Seeded live ratio config from bundled YAML to %s", path)


def list_history() -> list[dict]:
    directory = history_dir()
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


def restore_history(version: int, *, expected_version: int | None = None) -> tuple[list[dict], dict]:
    from app.ratios.engine import parse_ratios_yaml

    yaml_path = history_dir() / f"{version}.yaml"
    if not yaml_path.is_file():
        raise FileNotFoundError(f"Geen snapshot voor versie {version}.")
    text = yaml_path.read_text(encoding="utf-8")
    specs = parse_ratios_yaml(text)
    with _lock:
        meta = current_meta()
        if expected_version is not None and expected_version != meta["version"]:
            raise StaleConfigError(meta["version"])
        _snapshot_current()
        _atomic_write_text(override_path(), text)
        new_meta = {"version": meta["version"] + 1, "updated_at": _now_iso()}
        _write_meta(new_meta)
        return specs, new_meta


def config_fields(specs: list[dict] | None = None) -> dict:
    payload = specs if specs is not None else load_active_specs()
    meta = current_meta()
    return {
        "ratios": payload,
        "source": ratios_config_source(),
        "version": meta["version"],
        "updated_at": meta.get("updated_at"),
    }
