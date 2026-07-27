"""Detecteer het NBB-jaarrekeningmodel uit PDF-paginakoppen.

Zes standaardmodellen: (VOL|VKT|MIC)-(kap|inb), bijv. MIC-inb of VOL-kap.
"""

from __future__ import annotations

import io
import re
from pathlib import Path

import pdfplumber

SCHEMA_FORMAT_RE = re.compile(r"\b(VOL|VKT|MIC)-(kap|inb)\b", re.IGNORECASE)

# Paginakop zoals "MIC-inb 3.1" of "VOL-kap 2.2"
SCHEMA_HEADER_RE = re.compile(
    r"\b(?:VOL|VKT|MIC)-(?:kap|inb)(?:\s+\d+(?:\.\d+)*)?\b",
    re.IGNORECASE,
)


def normalize_schema_format(match: re.Match[str]) -> str:
    """Normaliseer naar canonieke vorm, bijv. 'mic-inb' → 'MIC-inb'."""
    depth, equity = match.group(1), match.group(2)
    return f"{depth.upper()}-{equity.lower()}"


def detect_schema_format_from_text(text: str) -> str | None:
    """Zoek het eerste schema-label in platte tekst."""
    match = SCHEMA_FORMAT_RE.search(text)
    if match is None:
        return None
    return normalize_schema_format(match)


def detect_schema_format(pdf_source: bytes | Path, *, max_pages: int = 5) -> str | None:
    """Lees de eerste pagina's en detecteer VOL/VKT/MIC × kap/inb."""
    if isinstance(pdf_source, bytes):
        pdf_handle = pdfplumber.open(io.BytesIO(pdf_source))
    else:
        pdf_handle = pdfplumber.open(str(pdf_source))

    with pdf_handle as pdf:
        for page in pdf.pages[:max_pages]:
            text = page.extract_text() or ""
            found = detect_schema_format_from_text(text)
            if found is not None:
                return found
    return None
