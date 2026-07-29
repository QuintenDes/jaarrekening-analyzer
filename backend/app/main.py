import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.middleware.rate_limit import RateLimitMiddleware

app = FastAPI(title="Jaarrekening Analyzer", version="1.0.0")

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
