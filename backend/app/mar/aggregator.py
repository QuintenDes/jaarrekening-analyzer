"""MAR-code lookup en eenvoudige expressie-evaluatie.

De extractor levert StatementLine-lijsten; de ratio-engine vraagt bedragen op
via MAR-codes (bijv. "70") of expressies (bijv. "29/58 - 3"). Deze module
bouwt een lookup-tabel en evalueert die expressies voor huidig/vorig boekjaar.
"""

from __future__ import annotations

import re
from typing import Literal

from app.models.schemas import StatementLine

YearKey = Literal["current", "previous"]

# VOL-schemas gebruiken vaak gecombineerde codes; MIC heeft soms alleen het eerste deel.
# Voorbeeld: bedrijfsopbrengsten "70/76A" (VOL) ↔ "70" Omzet (MIC verkort).
CODE_ALIASES: dict[str, tuple[str, ...]] = {
    "70/76A": ("70",),
}


class CodeAggregator:
    """Lookup MAR-code bedragen uit geëxtraheerde jaarrekeningregels."""

    def __init__(self, lines: list[StatementLine]) -> None:
        self._current: dict[str, int] = {}
        self._previous: dict[str, int] = {}
        for line in lines:
            if line.current is not None:
                self._current[line.code] = line.current
            if line.previous is not None:
                self._previous[line.code] = line.previous

    def get(self, code: str, year: YearKey = "current") -> int | None:
        """Enkelvoudige lookup: geef het bedrag voor één MAR-code (met aliases)."""
        store = self._current if year == "current" else self._previous
        if code in store:
            return store[code]
        for alias in CODE_ALIASES.get(code, ()):
            if alias in store:
                return store[alias]
        return None

    def evaluate_expr(self, expr: str, year: YearKey = "current") -> tuple[int | None, list[str]]:
        """Evalueer een expressie uit ratios.yaml, bijv. '29/58 - 3' of '9904 + 65'.

        Werkwijze:
        1. Geen + of - → behandel de hele string als één MAR-code (ook "29/58").
        2. Wel + of - → split op operatoren, evalueer elk token via get(), tel op/aftrek.
        3. Ontbreekt één code → return (None, [ontbrekende codes]) zodat de ratio-engine
           de ratio kan overslaan en missing_codes kan tonen in de UI.

        Let op: "29/58" is één code, geen deling — de slash hoort bij het codenummer.
        """
        expr = expr.strip()
        missing: list[str] = []

        if "+" in expr or "-" in expr:
            total = 0
            # re.split houdt de operatoren: "29/58 - 3" → ["29/58", "-", "3"]
            parts = re.split(r"\s*([+-])\s*", expr)
            if not parts:
                return None, [expr]

            first_val, first_missing = self._resolve_token(parts[0].strip(), year)
            if first_val is None:
                missing.extend(first_missing)
                return None, missing
            total = first_val

            i = 1
            while i < len(parts):
                op = parts[i]
                token = parts[i + 1].strip()
                val, token_missing = self._resolve_token(token, year)
                if val is None:
                    missing.extend(token_missing)
                    return None, missing
                total = total + val if op == "+" else total - val
                i += 2

            return total, missing

        return self._resolve_token(expr, year)

    def _resolve_token(self, token: str, year: YearKey) -> tuple[int | None, list[str]]:
        """Zoek één token op in de lookup-tabel."""
        token = token.strip()
        if not token:
            return None, []
        value = self.get(token, year)
        if value is None:
            return None, [token]
        return value, []
