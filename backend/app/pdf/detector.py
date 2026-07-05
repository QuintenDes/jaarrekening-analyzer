"""Controleert of een PDF tekst bevat (vs. gescand/beeld)."""

from __future__ import annotations

import io

import pdfplumber

# Minimaal aantal tekens per pagina om als "tekst-PDF" te tellen.
# Gescande jaarrekeningen leveren bij pdfplumber.extract_text() lege strings op
# (alleen pixels, geen embedded tekstlaag) — die willen we vroeg afwijzen i.p.v.
# een lege extractie door te sturen naar de ratio-engine.
MIN_TEXT_CHARS_PER_PAGE = 80


def is_text_pdf(pdf_bytes: bytes) -> bool:
    """Return False wanneer de eerste pagina's gescand lijken (bijna geen tekst)."""
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        if not pdf.pages:
            return False
        sample_pages = pdf.pages[: min(5, len(pdf.pages))]
        chars = sum(len((page.extract_text() or "").strip()) for page in sample_pages)
        return chars >= MIN_TEXT_CHARS_PER_PAGE * len(sample_pages)
