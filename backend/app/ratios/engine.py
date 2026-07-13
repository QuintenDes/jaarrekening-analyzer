"""Config-gedreven ratio-engine.

Walkthrough current_ratio (uit ratios.yaml):
  1. numerator "29/58"  → aggregator.get("29/58") = vlottende activa
  2. denominator "42/48" → kortlopende schulden
  3. value = numerator / denominator  (geen multiply, unit = x)
  4. Ontbrekende code → value None, missing_codes gevuld voor de UI

Nieuwe ratio toevoegen = YAML-entry, geen Python-wijziging.
"""

from __future__ import annotations

from pathlib import Path

import yaml

from app.mar.aggregator import CodeAggregator
from app.models.schemas import RatioResult, StatementLine, StructureItem

CONFIG_DIR = Path(__file__).resolve().parents[2] / "config"


def load_ratios_config() -> list[dict]:
    path = CONFIG_DIR / "ratios.yaml"
    with path.open(encoding="utf-8") as handle:
        data = yaml.safe_load(handle)
    return data.get("ratios", [])


def compute_ratios(aggregator: CodeAggregator) -> list[RatioResult]:
    results: list[RatioResult] = []
    for spec in load_ratios_config():
        formula_parts: list[str] = []
        missing: list[str] = []

        # numerator_expr heeft voorrang op numerator (zelfde voor denominator)
        num_expr = spec.get("numerator_expr") or spec.get("numerator")
        den_expr = spec.get("denominator_expr") or spec.get("denominator")

        if not num_expr:
            continue

        numerator, num_missing = aggregator.evaluate_expr(num_expr, "current")
        missing.extend(num_missing)
        formula_parts.append(num_expr)

        value: float | None = None
        if denominator := den_expr:
            formula_parts.append(f"/ {denominator}")
            denominator_val, den_missing = aggregator.evaluate_expr(denominator, "current")
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
