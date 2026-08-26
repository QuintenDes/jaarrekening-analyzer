"""Analysis stages reported to the frontend (real backend state, not timers)."""

from __future__ import annotations

from collections.abc import Callable
from typing import Literal

StageId = Literal[
    "validate_pdf",
    "extract",
    "aggregate",
    "ratios",
    "finalize",
]

STAGE_ORDER: tuple[StageId, ...] = (
    "validate_pdf",
    "extract",
    "aggregate",
    "ratios",
    "finalize",
)

STAGE_LABELS: dict[StageId, str] = {
    "validate_pdf": "PDF controleren",
    "extract": "Financiële gegevens extraheren",
    "aggregate": "Gegevens verwerken",
    "ratios": "Ratio's berekenen",
    "finalize": "Analyse afronden",
}

ProgressCallback = Callable[[StageId], None]
CancelCheck = Callable[[], None]


class AnalysisCancelled(Exception):
    """Raised when the client cancels an in-flight analysis job."""
