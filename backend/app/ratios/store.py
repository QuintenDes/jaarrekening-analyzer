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

KNOWN_CATEGORIES = ("liquiditeit", "solvabiliteit", "rentabiliteit")
DEFAULT_DASHBOARD_RATIO_COUNT = 3
DEFAULT_DASHBOARD_KEY_IDS: dict[str, list[str]] = {
    "liquiditeit": ["current_ratio", "quick_ratio", "net_working_capital"],
    "solvabiliteit": ["solvability", "financial_independence", "debt_ratio"],
    "rentabiliteit": ["rev", "rtv", "gross_margin"],
}


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


def load_active_document() -> dict:
    path = active_ratios_path()
    with path.open(encoding="utf-8") as handle:
        data = yaml.safe_load(handle)
    return data if isinstance(data, dict) else {}


def load_active_specs() -> list[dict]:
    ratios = load_active_document().get("ratios", [])
    return ratios if isinstance(ratios, list) else []


def _normalize_count(value: object) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        return DEFAULT_DASHBOARD_RATIO_COUNT
    return max(1, value)


def _normalize_categories(raw: object, specs: list[dict]) -> list[str]:
    ordered: list[str] = []
    seen: set[str] = set()

    def add(value: str) -> None:
        key = value.strip().lower()
        if not key or key in seen:
            return
        seen.add(key)
        ordered.append(key)

    if isinstance(raw, list):
        for item in raw:
            if isinstance(item, str):
                add(item)
    for spec in specs:
        category = spec.get("category")
        if isinstance(category, str):
            add(category)
    extras = [item for item in ordered if item not in KNOWN_CATEGORIES]
    known = [item for item in KNOWN_CATEGORIES if item in seen]
    if not known and not extras:
        return list(KNOWN_CATEGORIES)
    return known + extras


def _normalize_key_ids(raw: object) -> dict[str, list[str]]:
    result = {key: list(ids) for key, ids in DEFAULT_DASHBOARD_KEY_IDS.items()}
    if not isinstance(raw, dict):
        return result
    for key, value in raw.items():
        if not isinstance(key, str) or not isinstance(value, list):
            continue
        ids = [
            item.strip()
            for item in value
            if isinstance(item, str) and item.strip()
        ]
        result[key.strip().lower()] = ids
    return result


def _atomic_write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(text, encoding="utf-8")
    tmp.replace(path)


def _dump_document(
    specs: list[dict],
    *,
    dashboard_ratio_count: int,
    categories: list[str],
    dashboard_key_ids: dict[str, list[str]],
) -> str:
    return yaml.safe_dump(
        {
            "dashboard_ratio_count": dashboard_ratio_count,
            "categories": categories,
            "dashboard_key_ids": dashboard_key_ids,
            "ratios": specs,
        },
        allow_unicode=True,
        sort_keys=False,
    )


def _dump_specs(specs: list[dict]) -> str:
    doc = load_active_document() if override_path().is_file() else {}
    return _dump_document(
        specs,
        dashboard_ratio_count=_normalize_count(doc.get("dashboard_ratio_count")),
        categories=_normalize_categories(doc.get("categories"), specs),
        dashboard_key_ids=_normalize_key_ids(doc.get("dashboard_key_ids")),
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


def persist_specs(
    specs: list[dict],
    *,
    expected_version: int | None,
    dashboard_ratio_count: int | None = None,
    categories: list[str] | None = None,
    dashboard_key_ids: dict[str, list[str]] | None = None,
) -> tuple[list[dict], dict]:
    """Write validated specs to the override file. Raises StaleConfigError on mismatch."""
    with _lock:
        meta = current_meta()
        if expected_version is not None and expected_version != meta["version"]:
            raise StaleConfigError(meta["version"])
        current_doc = load_active_document() if override_path().is_file() else {}
        count = _normalize_count(
            dashboard_ratio_count
            if dashboard_ratio_count is not None
            else current_doc.get("dashboard_ratio_count")
        )
        cats = _normalize_categories(
            categories if categories is not None else current_doc.get("categories"),
            specs,
        )
        key_ids = _normalize_key_ids(
            dashboard_key_ids
            if dashboard_key_ids is not None
            else current_doc.get("dashboard_key_ids")
        )
        _snapshot_current()
        _atomic_write_text(
            override_path(),
            _dump_document(
                specs,
                dashboard_ratio_count=count,
                categories=cats,
                dashboard_key_ids=key_ids,
            ),
        )
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
    doc = load_active_document() if active_ratios_path().is_file() else {}
    payload = specs if specs is not None else load_active_specs()
    meta = current_meta()
    return {
        "ratios": payload,
        "source": ratios_config_source(),
        "version": meta["version"],
        "updated_at": meta.get("updated_at"),
        "dashboard_ratio_count": _normalize_count(doc.get("dashboard_ratio_count")),
        "categories": _normalize_categories(doc.get("categories"), payload),
        "dashboard_key_ids": _normalize_key_ids(doc.get("dashboard_key_ids")),
    }
