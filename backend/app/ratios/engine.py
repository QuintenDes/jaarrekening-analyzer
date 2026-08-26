"""Config-gedreven ratio-engine.

Walkthrough current_ratio (uit ratios.yaml):
  1. numerator "29/58"  → aggregator.get("29/58") = vlottende activa
  2. denominator "42/48" → kortlopende schulden
  3. value = numerator / denominator  (geen multiply, unit = x)
  4. Ontbrekende code → value None, missing_codes gevuld voor de UI

Nieuwe ratio toevoegen = YAML-entry, geen Python-wijziging.
"""

from __future__ import annotations

import yaml

from app.mar.aggregator import CodeAggregator
from app.models.schemas import RatioResult, StatementLine, StructureItem
from app.ratios.store import (
    load_active_specs,
    persist_specs,
    reset_to_bundled,
)

ALLOWED_SPEC_KEYS = frozenset(
    {
        "id",
        "name",
        "category",
        "numerator",
        "denominator",
        "multiply",
        "unit",
        "enabled",
    }
)


def load_ratios_config() -> list[dict]:
    return load_active_specs()


def save_ratios_config(
    specs: list[dict],
    *,
    expected_version: int | None = None,
) -> list[dict]:
    validated = validate_ratios_config(specs)
    saved, _meta = persist_specs(validated, expected_version=expected_version)
    return saved


def reset_ratios_config() -> list[dict]:
    specs, _meta = reset_to_bundled()
    return specs


def parse_ratios_yaml(text: str) -> list[dict]:
    """Parse a ratios.yaml body into validated specs."""
    data = yaml.safe_load(text)
    if data is None:
        raise ValueError("Lege YAML.")
    if not isinstance(data, dict) or "ratios" not in data:
        raise ValueError("YAML moet een top-level 'ratios' lijst bevatten.")
    return validate_ratios_config(data["ratios"])


def validate_ratios_config(raw: object) -> list[dict]:
    """Valideer ratio-specs (van YAML of JSON). Gooit ValueError bij fouten."""
    if not isinstance(raw, list):
        raise ValueError("ratios moet een lijst zijn.")
    if len(raw) == 0:
        raise ValueError("ratios mag niet leeg zijn.")

    validated: list[dict] = []
    seen_ids: set[str] = set()

    for index, item in enumerate(raw):
        prefix = f"ratios[{index}]"
        if not isinstance(item, dict):
            raise ValueError(f"{prefix} moet een object zijn.")

        unknown = set(item.keys()) - ALLOWED_SPEC_KEYS
        if unknown:
            raise ValueError(
                f"{prefix}: onbekende velden: {', '.join(sorted(unknown))}"
            )

        for required in ("id", "name", "numerator"):
            value = item.get(required)
            if not isinstance(value, str) or not value.strip():
                raise ValueError(f"{prefix}.{required} is verplicht (niet-lege string).")

        spec_id = item["id"].strip()
        if spec_id in seen_ids:
            raise ValueError(f"Dubbele ratio-id: {spec_id}")
        seen_ids.add(spec_id)

        category = item.get("category", "overig")
        if not isinstance(category, str) or not category.strip():
            raise ValueError(f"{prefix}.category moet een niet-lege string zijn.")

        unit = item.get("unit", "")
        if unit is None:
            unit = ""
        if not isinstance(unit, str):
            raise ValueError(f"{prefix}.unit moet een string zijn.")

        denominator = item.get("denominator")
        if denominator is not None and (
            not isinstance(denominator, str) or not denominator.strip()
        ):
            raise ValueError(
                f"{prefix}.denominator moet een niet-lege string zijn of weggelaten."
            )

        multiply = item.get("multiply", 1)
        if isinstance(multiply, bool) or not isinstance(multiply, (int, float)):
            raise ValueError(f"{prefix}.multiply moet een getal zijn.")

        enabled = item.get("enabled", True)
        if not isinstance(enabled, bool):
            raise ValueError(f"{prefix}.enabled moet true of false zijn.")

        cleaned: dict = {
            "id": spec_id,
            "name": item["name"].strip(),
            "category": category.strip(),
            "numerator": item["numerator"].strip(),
            "unit": unit,
            "multiply": multiply,
            "enabled": enabled,
        }
        if denominator is not None:
            cleaned["denominator"] = denominator.strip()

        validated.append(cleaned)

    return validated


def compute_ratios(
    aggregator: CodeAggregator,
    specs: list[dict] | None = None,
) -> list[RatioResult]:
    results: list[RatioResult] = []
    for spec in specs if specs is not None else load_ratios_config():
        if spec.get("enabled", True) is False:
            continue
        formula_parts: list[str] = []
        missing: list[str] = []

        num_expr = spec.get("numerator")
        den_expr = spec.get("denominator")

        if not num_expr:
            continue

        numerator, num_missing = aggregator.evaluate_expr(num_expr, "current")
        missing.extend(num_missing)
        formula_parts.append(num_expr)

        value: float | None = None
        if den_expr:
            formula_parts.append(f"/ {den_expr}")
            denominator_val, den_missing = aggregator.evaluate_expr(den_expr, "current")
            missing.extend(den_missing)
            if numerator is not None and denominator_val is not None and denominator_val != 0:
                value = numerator / denominator_val
            else:
                value = None
        else:
            value = float(numerator) if numerator is not None else None

        multiply = spec.get("multiply", 1)
        if value is not None:
            value = value * multiply

        results.append(
            RatioResult(
                id=spec["id"],
                name=spec["name"],
                category=spec.get("category", "overig"),
                value=round(value, 4) if value is not None else None,
                unit=spec.get("unit", ""),
                formula=" ".join(formula_parts),
                missing_codes=sorted(set(missing)),
            )
        )

    return results


def compute_balance_structure(lines: list[StatementLine], total_code: str = "20/58") -> list[StructureItem]:
    """Percentage van elke activapost t.o.v. totaal activa (code 20/58)."""
    total_line = next((line for line in lines if line.code == total_code), None)
    total_current = total_line.current if total_line else None
    total_previous = total_line.previous if total_line else None

    items: list[StructureItem] = []
    for line in lines:
        if line.code == total_code:
            continue
        pct_current = (line.current / total_current * 100) if line.current is not None and total_current else None
        pct_previous = (line.previous / total_previous * 100) if line.previous is not None and total_previous else None
        items.append(
            StructureItem(
                code=line.code,
                label=line.label,
                current=line.current,
                previous=line.previous,
                pct_current=round(pct_current, 2) if pct_current is not None else None,
                pct_previous=round(pct_previous, 2) if pct_previous is not None else None,
            )
        )
    return items


def compute_income_structure(lines: list[StatementLine], base_code: str = "70") -> list[StructureItem]:
    """Percentage van elke resultatenpost t.o.v. omzet (code 70)."""
    base_line = next((line for line in lines if line.code == base_code), None)
    base_current = base_line.current if base_line else None
    base_previous = base_line.previous if base_line else None

    items: list[StructureItem] = []
    for line in lines:
        pct_current = (line.current / base_current * 100) if line.current is not None and base_current else None
        pct_previous = (line.previous / base_previous * 100) if line.previous is not None and base_previous else None
        items.append(
            StructureItem(
                code=line.code,
                label=line.label,
                current=line.current,
                previous=line.previous,
                pct_current=round(pct_current, 2) if pct_current is not None else None,
                pct_previous=round(pct_previous, 2) if pct_previous is not None else None,
            )
        )
    return items


def validate_balance(aggregator: CodeAggregator) -> list[str]:
    """Controleer of totaal activa (20/58) gelijk is aan totaal passiva (10/49)."""
    validations: list[str] = []
    activa = aggregator.get("20/58", "current")
    passiva = aggregator.get("10/49", "current")
    if activa is not None and passiva is not None:
        if activa == passiva:
            validations.append(f"Totaal activa = totaal passiva ({activa:,} EUR)".replace(",", "."))
        else:
            validations.append(
                f"WAARSCHUWING: activa ({activa:,}) ≠ passiva ({passiva:,})".replace(",", ".")
            )
    return validations
