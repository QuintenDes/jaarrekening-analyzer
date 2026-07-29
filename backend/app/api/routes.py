"""API routes for health, ratios config, and PDF analysis."""

from __future__ import annotations

import json
import logging

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.models.schemas import AnalysisResult, RatioSpec, RatiosConfigResponse
from app.ratios.engine import load_ratios_config, parse_ratios_yaml, validate_ratios_config
from app.services.analyzer import analyze_pdf

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")

MAX_UPLOAD_BYTES = 20 * 1024 * 1024
PDF_MAGIC = b"%PDF"


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/ratios", response_model=RatiosConfigResponse)
def get_ratios() -> RatiosConfigResponse:
    """Read-only defaults from ratios.yaml (never mutated by the API)."""
    specs = load_ratios_config()
    return RatiosConfigResponse(ratios=[RatioSpec.model_validate(spec) for spec in specs])


@router.post("/ratios/parse", response_model=RatiosConfigResponse)
def parse_ratios(body: dict) -> RatiosConfigResponse:
    """Parse pasted/uploaded YAML into validated ratio specs (no disk write)."""
    yaml_text = body.get("yaml")
    if not isinstance(yaml_text, str) or not yaml_text.strip():
        raise HTTPException(status_code=400, detail="Veld 'yaml' (string) is verplicht.")
    try:
        specs = parse_ratios_yaml(yaml_text)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("YAML parse failed")
        raise HTTPException(status_code=422, detail="Ongeldige YAML.") from exc
    return RatiosConfigResponse(ratios=[RatioSpec.model_validate(spec) for spec in specs])


@router.post("/analyze", response_model=AnalysisResult)
async def analyze(
    file: UploadFile = File(...),
    ratios: str | None = Form(None),
) -> AnalysisResult:
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Upload een PDF-bestand.")

    pdf_bytes = await file.read()
    if not pdf_bytes:
        raise HTTPException(status_code=400, detail="Leeg bestand ontvangen.")

    if len(pdf_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail="Bestand is te groot (max. 20 MB).",
        )

    if not pdf_bytes.lstrip().startswith(PDF_MAGIC):
        raise HTTPException(
            status_code=400,
            detail="Bestand is geen geldige PDF.",
        )

    ratio_specs: list[dict] | None = None
    if ratios is not None and ratios.strip():
        try:
            parsed = json.loads(ratios)
            ratio_specs = validate_ratios_config(parsed)
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=422, detail=f"Ongeldige ratios JSON: {exc}"
            ) from exc
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

    try:
        return analyze_pdf(pdf_bytes, ratio_specs=ratio_specs)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("PDF analysis failed")
        raise HTTPException(
            status_code=500,
            detail="Analyse mislukt. Controleer of het bestand een geldige tekst-PDF is.",
        ) from exc
