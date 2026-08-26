"""Persistent live ratio configuration (YAML on the data volume).

Bundled backend/config/ratios.yaml is the canonical default. On first start,
if the override file is missing, it is copied once to RATIOS_CONFIG_PATH
(or backend/data/ratios.yaml). After that the override file is the active
configuration; startup never overwrites it from the bundled YAML.
"""

from __future__ import annotations

import os
from pathlib import Path

import yaml

from app.configstore.yaml_store import StaleConfigError, YamlConfigStore

CONFIG_DIR = Path(__file__).resolve().parents[2] / "config"
BUNDLED_RATIOS_PATH = CONFIG_DIR / "ratios.yaml"
HISTORY_KEEP = 20

KNOWN_CATEGORIES = ("liquiditeit", "solvabiliteit", "rentabiliteit")
DEFAULT_DASHBOARD_RATIO_COUNT = 3
DEFAULT_DASHBOARD_KEY_IDS: dict[str, list[str]] = {
    "liquiditeit": ["current_ratio", "quick_ratio", "net_working_capital"],
    "solvabiliteit": ["solvability", "financial_independence", "debt_ratio"],
    "rentabiliteit": ["rev", "rtv", "gross_margin"],
}


def _override_path() -> Path:
    raw = os.environ.get("RATIOS_CONFIG_PATH", "").strip()
    if raw:
        return Path(raw)
    return CONFIG_DIR.parent / "data" / "ratios.yaml"


_store = YamlConfigStore(
    bundled_path=BUNDLED_RATIOS_PATH,
    get_override_path=_override_path,
    get_history_dir=lambda: _override_path().parent / "history",
    history_keep=HISTORY_KEEP,
    kind="ratio",
)


def override_path() -> Path:
    return _store.override_path()


def meta_path() -> Path:
    return _store.meta_path()


def history_dir() -> Path:
    return _store.history_dir()


def active_ratios_path() -> Path:
    return _store.active_path()


def ratios_config_source() -> str:
    return _store.source()


def current_meta() -> dict:
    return _store.current_meta()


def load_active_document() -> dict:
    return _store.load_document()


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


def persist_specs(
    specs: list[dict],
    *,
    expected_version: int | None,
    dashboard_ratio_count: int | None = None,
    categories: list[str] | None = None,
    dashboard_key_ids: dict[str, list[str]] | None = None,
) -> tuple[list[dict], dict]:
    """Write validated specs to the override file. Raises StaleConfigError on mismatch."""
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
    text = _dump_document(
        specs,
        dashboard_ratio_count=count,
        categories=cats,
        dashboard_key_ids=key_ids,
    )
    new_meta = _store.persist_text(text, expected_version=expected_version)
    return specs, new_meta


def reset_to_bundled() -> tuple[list[dict], dict]:
    """Snapshot current live config, then write bundled YAML into the override file."""
    from app.ratios.engine import parse_ratios_yaml

    text, new_meta = _store.reset_to_bundled(validate=parse_ratios_yaml)
    return parse_ratios_yaml(text), new_meta


def seed_if_missing() -> None:
    """Copy bundled YAML to the override path only when that file does not exist."""
    from app.ratios.engine import parse_ratios_yaml

    _store.seed_if_missing(validate=parse_ratios_yaml)


def list_history() -> list[dict]:
    return _store.list_history()


def restore_history(version: int, *, expected_version: int | None = None) -> tuple[list[dict], dict]:
    from app.ratios.engine import parse_ratios_yaml

    text, new_meta = _store.restore_history(
        version,
        expected_version=expected_version,
        validate=parse_ratios_yaml,
    )
    return parse_ratios_yaml(text), new_meta


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
