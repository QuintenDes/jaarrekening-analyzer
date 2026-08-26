"""In-memory analysis jobs with stage progress and cooperative cancellation."""

from __future__ import annotations

import logging
import threading
import time
import uuid
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Literal

from app.models.schemas import AnalysisResult
from app.services.progress import (
    STAGE_LABELS,
    STAGE_ORDER,
    AnalysisCancelled,
    StageId,
)

logger = logging.getLogger(__name__)

JobStatus = Literal["queued", "running", "completed", "error", "canceled"]

JOB_TTL_SECONDS = 3600.0
MAX_JOBS = 50

STAGE_ERRORS: dict[StageId, str] = {
    "validate_pdf": "Het PDF-bestand kon niet gecontroleerd worden.",
    "extract": "Financiële gegevens konden niet uit de PDF gehaald worden.",
    "aggregate": "De geëxtraheerde gegevens konden niet verwerkt worden.",
    "ratios": "De ratio's konden niet berekend worden.",
    "finalize": "De analyse kon niet afgerond worden.",
}


@dataclass
class AnalysisJob:
    id: str
    status: JobStatus = "queued"
    current_stage: StageId | None = None
    completed_stages: list[StageId] = field(default_factory=list)
    error: str | None = None
    error_stage: StageId | None = None
    error_detail: str | None = None
    result: AnalysisResult | None = None
    created_at: float = field(default_factory=time.monotonic)
    cancel_event: threading.Event = field(default_factory=threading.Event)


class JobStore:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._jobs: dict[str, AnalysisJob] = {}

    def create(self) -> AnalysisJob:
        job = AnalysisJob(id=str(uuid.uuid4()))
        with self._lock:
            self._purge_unlocked()
            self._jobs[job.id] = job
        return job

    def get(self, job_id: str) -> AnalysisJob | None:
        with self._lock:
            self._purge_unlocked()
            return self._jobs.get(job_id)

    def request_cancel(self, job_id: str) -> AnalysisJob | None:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return None
            if job.status in ("queued", "running"):
                job.cancel_event.set()
                if job.status == "queued":
                    job.status = "canceled"
            return job

    def _purge_unlocked(self) -> None:
        now = time.monotonic()
        stale = [
            job_id
            for job_id, job in self._jobs.items()
            if now - job.created_at > JOB_TTL_SECONDS
        ]
        for job_id in stale:
            del self._jobs[job_id]
        if len(self._jobs) > MAX_JOBS:
            oldest = sorted(self._jobs.values(), key=lambda j: j.created_at)
            for job in oldest[: len(self._jobs) - MAX_JOBS]:
                if job.status not in ("queued", "running"):
                    self._jobs.pop(job.id, None)


store = JobStore()


def run_analysis_job(
    job: AnalysisJob,
    pdf_bytes: bytes,
    ratio_specs: list[dict] | None,
    analyze: Callable[..., AnalysisResult],
) -> None:
    def on_progress(stage: StageId) -> None:
        with store._lock:
            if job.current_stage and job.current_stage not in job.completed_stages:
                if job.current_stage in STAGE_ORDER:
                    prev_index = STAGE_ORDER.index(job.current_stage)
                    new_index = STAGE_ORDER.index(stage)
                    if new_index > prev_index:
                        job.completed_stages.append(job.current_stage)
            job.current_stage = stage
            job.status = "running"

    def cancel_check() -> None:
        if job.cancel_event.is_set():
            raise AnalysisCancelled()

    try:
        cancel_check()
        result = analyze(
            pdf_bytes,
            ratio_specs=ratio_specs,
            on_progress=on_progress,
            cancel_check=cancel_check,
        )
        with store._lock:
            if job.cancel_event.is_set():
                job.status = "canceled"
                job.result = None
                return
            if job.current_stage and job.current_stage not in job.completed_stages:
                job.completed_stages.append(job.current_stage)
            job.current_stage = None
            job.result = result
            job.status = "completed"
    except AnalysisCancelled:
        with store._lock:
            job.status = "canceled"
            job.result = None
    except ValueError as exc:
        _fail(job, str(exc), technical=None)
    except Exception as exc:
        logger.exception("Analysis job %s failed", job.id)
        _fail(
            job,
            "Analyse mislukt. Controleer of het bestand een geldige tekst-PDF is.",
            technical=f"{type(exc).__name__}: {exc}",
        )


def _fail(job: AnalysisJob, message: str, *, technical: str | None) -> None:
    with store._lock:
        if job.cancel_event.is_set():
            job.status = "canceled"
            job.result = None
            return
        stage = job.current_stage
        job.status = "error"
        job.error_stage = stage
        job.error = STAGE_ERRORS.get(stage, message) if stage else message
        if stage and message and message != job.error:
            job.error_detail = message if technical is None else f"{message}\n{technical}"
        else:
            job.error_detail = technical
        job.result = None


def job_to_payload(job: AnalysisJob) -> dict:
    return {
        "job_id": job.id,
        "status": job.status,
        "current_stage": job.current_stage,
        "current_stage_label": STAGE_LABELS.get(job.current_stage) if job.current_stage else None,
        "completed_stages": list(job.completed_stages),
        "stage_labels": dict(STAGE_LABELS),
        "stage_order": list(STAGE_ORDER),
        "error": job.error,
        "error_stage": job.error_stage,
        "error_stage_label": STAGE_LABELS.get(job.error_stage) if job.error_stage else None,
        "error_detail": job.error_detail,
        "result": job.result.model_dump() if job.result is not None else None,
    }
