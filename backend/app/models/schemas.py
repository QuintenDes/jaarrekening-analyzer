"""Pydantic-modellen voor de analyse-API.

Dit is de JSON-vorm die de frontend ontvangt na `POST /api/analyze`.
Bedragen zijn hele euro's (integers), niet centen — zoals in de NBB-PDF.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class StatementLine(BaseModel):
    """Eén regel uit balans of resultatenrekening, geëxtraheerd uit de PDF."""

    section: str  # bijv. balans_activa, balans_passiva, resultatenrekening
    label: str  # omschrijving zoals in de jaarrekening
    footnote: str = ""  # toelichtingsnummer (bijv. "3.1.2")
    code: str  # MAR-code (bijv. "70" of "29/58")
    current: int | None = None  # bedrag huidig boekjaar in EUR
    previous: int | None = None  # bedrag vorig boekjaar in EUR


class RatioResult(BaseModel):
    """Eén berekende financiële ratio uit ratios.yaml."""

    id: str  # machine-id, bijv. current_ratio
    name: str  # leesbare naam voor de UI
    category: str  # liquiditeit, solvabiliteit of rentabiliteit
    value: float | None  # None als berekening niet mogelijk was
    unit: str  # bijv. ratio, pct, days
    formula: str  # menselijk leesbare formule voor de UI
    missing_codes: list[str] = Field(
        default_factory=list
    )  # MAR-codes die ontbraken en de ratio blokkeerden


class StructureItem(BaseModel):
    """Percentage-verdeling van een post t.o.v. een totaal (balans of omzet)."""

    code: str
    label: str
    current: int | None  # bedrag huidig boekjaar in EUR
    previous: int | None  # bedrag vorig boekjaar in EUR
    pct_current: float | None  # aandeel huidig jaar (0–100)
    pct_previous: float | None  # aandeel vorig jaar (0–100)


class AnalysisResult(BaseModel):
    """Volledig antwoord van de analyse-pipeline — dit serialiseert naar JSON."""

    balance_assets: list[StatementLine]
    balance_liabilities: list[StatementLine]
    income_statement: list[StatementLine]
    ratios: list[RatioResult]
    balance_structure: list[StructureItem]
    income_structure: list[StructureItem]
    warnings: list[str] = Field(default_factory=list)  # niet-fatale meldingen
    validations: list[str] = Field(default_factory=list)  # balanscontroles
