"""API routes for health, ratios config, and PDF analysis."""

from __future__ import annotations

import json
import logging
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.models.schemas import (
    AnalysisResult,
    AnalyzeJobCreated,
    AnalyzeJobStatus,
    RatioComputeRequest,
    RatioComputeResponse,
    RatioSpec,
    RatiosConfigResponse,
)
from app.ratios.engine import load_ratios_config, parse_ratios_yaml, validate_ratios_config
from app.services.analyzer import analyze_pdf, compute_from_statements
from app.services.jobs import job_to_payload, run_analysis_job, store

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")

MAX_UPLOAD_BYTES = 20 * 1024 * 1024
PDF_MAGIC = b"%PDF"

_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="analyze-job")


def _parse_ratio_form(ratios: str | None) -> list[dict] | None:
    if ratios is None or not ratios.strip():
        return None
    try:
        parsed = json.loads(ratios)
        return validate_ratios_config(parsed)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=422, detail=f"Ongeldige ratios JSON: {exc}"
        ) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


async def _read_pdf_upload(file: UploadFile) -> bytes:
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
    return pdf_bytes


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


@router.post("/ratios/compute", response_model=RatioComputeResponse)
def compute_ratios_endpoint(body: RatioComputeRequest) -> RatioComputeResponse:
    """Herbereken ratio's op bestaande staten (sandbox)."""
    ratio_specs: list[dict] | None = None
    if body.ratios is not None:
        try:
            ratio_specs = validate_ratios_config([spec.model_dump() for spec in body.ratios])
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
    try:
        ratios, validations = compute_from_statements(
            body.balance_assets,
            body.balance_liabilities,
            body.income_statement,
            ratio_specs,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Ratio recompute failed")
        raise HTTPException(
            status_code=500,
            detail="Ratio-herberekening mislukt.",
        ) from exc
    return RatioComputeResponse(ratios=ratios, validations=validations)


@router.post("/analyze", response_model=AnalysisResult)
async def analyze(
    file: UploadFile = File(...),
    ratios: str | None = Form(None),
) -> AnalysisResult:
    pdf_bytes = await _read_pdf_upload(file)
    ratio_specs = _parse_ratio_form(ratios)

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


@router.post("/analyze/jobs", response_model=AnalyzeJobCreated)
async def create_analyze_job(
    file: UploadFile = File(...),
    ratios: str | None = Form(None),
) -> AnalyzeJobCreated:
    pdf_bytes = await _read_pdf_upload(file)
    ratio_specs = _parse_ratio_form(ratios)
    job = store.create()
    _executor.submit(run_analysis_job, job, pdf_bytes, ratio_specs, analyze_pdf)
    return AnalyzeJobCreated(job_id=job.id, status=job.status)


@router.get("/analyze/jobs/{job_id}", response_model=AnalyzeJobStatus)
def get_analyze_job(job_id: str) -> AnalyzeJobStatus:
    job = store.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Analysejob niet gevonden.")
    return AnalyzeJobStatus.model_validate(job_to_payload(job))


@router.delete("/analyze/jobs/{job_id}", response_model=AnalyzeJobStatus)
def cancel_analyze_job(job_id: str) -> AnalyzeJobStatus:
    job = store.request_cancel(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Analysejob niet gevonden.")
    return AnalyzeJobStatus.model_validate(job_to_payload(job))
