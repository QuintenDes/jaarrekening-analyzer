import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.middleware.rate_limit import RateLimitMiddleware
from app.ratios.store import seed_if_missing as seed_ratios_if_missing
from app.tables.store import seed_if_missing as seed_tables_if_missing

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    seed_ratios_if_missing()
    seed_tables_if_missing()
    if not os.environ.get("ADMIN_TOKEN", "").strip():
        logger.warning(
            "ADMIN_TOKEN is not set; live configuration writes are disabled."
        )
    yield


app = FastAPI(title="Jaarrekening Analyzer", version="1.0.0", lifespan=lifespan)

# Dev: Vite on :5173. Prod: same-origin via Caddy; CORS_ORIGINS overrides defaults.
_default_origins = "http://localhost:5173,http://127.0.0.1:5173"
_raw = os.getenv("CORS_ORIGINS", _default_origins).strip()
allow_origins = ["*"] if _raw == "*" else [o.strip() for o in _raw.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RateLimitMiddleware)

app.include_router(router)
