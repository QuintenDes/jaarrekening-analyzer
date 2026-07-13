"""Analyzer pipeline (orchestrator).

Dit is de "lijm" tussen de losse bouwblokken:
1) detector: verwerp gescande (image-only) PDF's
2) extractor: haal StatementLines uit de PDF en groepeer per sectie
3) aggregator: bouw MAR-code lookup voor (expressie)berekeningen
4) ratios + structures: compute_ratios/compute_*_structure + validate_balance

Resultaat is een AnalysisResult die rechtstreeks als JSON kan terug naar de frontend.
"""

from __future__ import annotations

from app.mar.aggregator import CodeAggregator
from app.models.schemas import AnalysisResult
from app.pdf.detector import is_text_pdf
from app.pdf.extractor import extract_statements
from app.ratios.engine import (
    compute_balance_structure,
    compute_income_structure,
    compute_ratios,
    validate_balance,
)


def analyze_pdf(pdf_bytes: bytes) -> AnalysisResult:
    """Voer de volledige analyse uit op ruwe PDF-bytes."""

    warnings: list[str] = []

    # 1) Detecteer (en weiger) gescande PDF's zonder tekstlaag.
    if not is_text_pdf(pdf_bytes):
        raise ValueError(
            "Gescande PDF gedetecteerd — nog niet ondersteund. "
            "Upload een tekst-PDF (zoals een NBB-jaarrekening)."
        )

    # 2) Extractie: drie secties met StatementLine's.
    statements = extract_statements(pdf_bytes)
    balance_assets = statements["balans_activa"]
    balance_liabilities = statements["balans_passiva"]
    income_statement = statements["resultatenrekening"]

    if not balance_assets and not balance_liabilities:
        warnings.append("Geen balans gevonden in de PDF.")
    if not income_statement:
        warnings.append("Geen resultatenrekening gevonden in de PDF.")

    # 3) Aggregatie: lookup tabel van MAR-code → bedrag.
    all_lines = balance_assets + balance_liabilities + income_statement
    aggregator = CodeAggregator(all_lines)

    # 4) Ratio's + structuren + eenvoudige validaties.
    ratios = compute_ratios(aggregator)
    balance_structure = compute_balance_structure(balance_assets)
    income_structure = compute_income_structure(income_statement)
    validations = validate_balance(aggregator)

    # 5) Bundel alles in het API-response model.
    return AnalysisResult(
        balance_assets=balance_assets,
        balance_liabilities=balance_liabilities,
        income_statement=income_statement,
        ratios=ratios,
        balance_structure=balance_structure,
        income_structure=income_structure,
        warnings=warnings,
        validations=validations,
    )

