"""Analyzer pipeline (orchestrator).

Dit is de "lijm" tussen de losse bouwblokken:
1) detector: verwerp gescande (image-only) PDF's
2) extractor: haal StatementLines uit de PDF en groepeer per sectie
3) aggregator: bouw MAR-code lookup voor (expressie)berekeningen
4) ratios + structures: compute_ratios/compute_*_structure + validate_balance

Resultaat is een AnalysisResult die rechtstreeks als JSON kan terug naar de frontend.
"""

from __future__ import annotations

from collections.abc import Callable

from app.mar.aggregator import CodeAggregator
from app.models.schemas import AnalysisResult, PageSize, StatementLine
from app.pdf.detector import is_text_pdf
from app.pdf.extractor import extract_statements
from app.ratios.engine import (
    compute_balance_structure,
    compute_income_structure,
    compute_ratios,
    validate_balance,
)
from app.services.progress import CancelCheck, ProgressCallback, StageId


def _noop_progress(_stage: StageId) -> None:
    return


def _noop_cancel() -> None:
    return


def compute_from_statements(
    balance_assets: list[StatementLine],
    balance_liabilities: list[StatementLine],
    income_statement: list[StatementLine],
    ratio_specs: list[dict] | None = None,
) -> tuple[list, list[str]]:
    """Herbereken ratio's en balansvalidatie zonder PDF-extractie."""
    all_lines = balance_assets + balance_liabilities + income_statement
    aggregator = CodeAggregator(all_lines)
    ratios = compute_ratios(aggregator, specs=ratio_specs)
    validations = validate_balance(aggregator)
    return ratios, validations


def analyze_pdf(
    pdf_bytes: bytes,
    ratio_specs: list[dict] | None = None,
    *,
    on_progress: ProgressCallback | None = None,
    cancel_check: CancelCheck | None = None,
) -> AnalysisResult:
    """Voer de volledige analyse uit op ruwe PDF-bytes.

    ratio_specs: optionele override; None = ratios.yaml op schijf.
    """

    progress: Callable[[StageId], None] = on_progress or _noop_progress
    check: CancelCheck = cancel_check or _noop_cancel
    warnings: list[str] = []

    progress("validate_pdf")
    check()
    if not is_text_pdf(pdf_bytes):
        raise ValueError(
            "Gescande PDF gedetecteerd — nog niet ondersteund. "
            "Upload een tekst-PDF (zoals een NBB-jaarrekening)."
        )

    progress("extract")
    check()
    statements, schema_format, highlights, page_count, page_sizes, company_name = (
        extract_statements(pdf_bytes)
    )
    balance_assets = statements["balans_activa"]
    balance_liabilities = statements["balans_passiva"]
    income_statement = statements["resultatenrekening"]
    appropriation = statements["resultaatverwerking"]

    if not balance_assets and not balance_liabilities:
        warnings.append("Geen balans gevonden in de PDF.")
    if not income_statement:
        warnings.append("Geen resultatenrekening gevonden in de PDF.")

    progress("aggregate")
    check()
    all_lines = balance_assets + balance_liabilities + income_statement
    aggregator = CodeAggregator(all_lines)

    progress("ratios")
    check()
    ratios = compute_ratios(aggregator, specs=ratio_specs)
    balance_structure = compute_balance_structure(balance_assets)
    income_structure = compute_income_structure(income_statement)
    validations = validate_balance(aggregator)

    progress("finalize")
    check()
    return AnalysisResult(
        schema_format=schema_format,
        company_name=company_name,
        balance_assets=balance_assets,
        balance_liabilities=balance_liabilities,
        income_statement=income_statement,
        appropriation_of_result=appropriation,
        ratios=ratios,
        balance_structure=balance_structure,
        income_structure=income_structure,
        warnings=warnings,
        validations=validations,
        highlights=highlights,
        page_count=page_count,
        page_sizes=[PageSize(width=w, height=h) for w, h in page_sizes],
    )
