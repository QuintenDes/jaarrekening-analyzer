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


COMPANY_LABEL_RE = re.compile(
    r"^(?:naam|name|nom)\b(?:\s+(?:naam|name|nom)\b)*\s*[:.]?\s*(.*)$",
    re.IGNORECASE,
)
NEXT_IDENTITY_FIELD_RE = re.compile(
    r"^(?:rechtsvorm|legal\s+form|forme\s+juridique|adres|address|adresse|"
    r"ondernemingsnummer|enterprise\s+number|num[eé]ro\s+d['’]entreprise|"
    r"identiteit|identit[eé]|jaarrekening|annual\s+accounts|comptes\s+annuels|"
    r"benaming|d[eé]nomination|"
    r"naamloze\s+vennootschap|besloten\s+vennootschap|"
    r"vennootschap\s+onder\s+firma|commanditaire\s+vennootschap)\b",
    re.IGNORECASE,
)
FILLER_RE = re.compile(r"^[.\s_/-]+$")


def _clean_company_name(value: str) -> str:
    cleaned = re.sub(r"\s+", " ", value).strip(" \t.:-_")
    return cleaned


def is_plausible_company_name(value: str) -> bool:
    """True if the captured text looks like an enterprise name, not a form label."""
    cleaned = _clean_company_name(value)
    if len(cleaned) < 2 or len(cleaned) > 160:
        return False
    if FILLER_RE.fullmatch(cleaned):
        return False
    if not re.search(r"[A-Za-zÀ-ÿ]", cleaned):
        return False
    if SCHEMA_FORMAT_RE.search(cleaned):
        return False
    if NEXT_IDENTITY_FIELD_RE.match(cleaned):
        return False
    label_match = COMPANY_LABEL_RE.match(cleaned)
    if label_match is not None and not _clean_company_name(label_match.group(1) or ""):
        return False
    return True


def detect_company_name_from_lines(lines: list[str]) -> str | None:
    """Haal de ondernemingsnaam uit NBB-identiteitstekst (vóór JAARREKENING)."""
    waiting = False
    for raw in lines:
        stripped = raw.strip()
        if not stripped or FILLER_RE.fullmatch(stripped):
            continue
        if waiting:
            if NEXT_IDENTITY_FIELD_RE.match(stripped):
                waiting = False
                continue
            if is_plausible_company_name(stripped):
                return _clean_company_name(stripped)
            waiting = False

        match = COMPANY_LABEL_RE.match(stripped)
        if match is None:
            continue
        rest = _clean_company_name(match.group(1) or "")
        if rest and is_plausible_company_name(rest):
            return rest
        waiting = True
    return None


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
