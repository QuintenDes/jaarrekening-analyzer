"""Kolom-gebaseerde extractie uit Belgische NBB-jaarrekening-PDF's.

Een PDF-regel zoals "Handelsvorderingen 40 1.234.567 1.100.000" wordt een Row
met MAR-code, omschrijving, toelichting en bedragen. Later mapt row_to_statement()
naar het Engelse API-model StatementLine (current/previous).
"""

from __future__ import annotations

import io
import re
from dataclasses import dataclass
from pathlib import Path

import pdfplumber

from app.models.schemas import StatementLine

# --- 1. Regex-patronen -------------------------------------------------------
# NBB-PDF's hebben vaste kolommen: omschrijving | toel. | code | boekjaar | vorig jaar.
# We parsen van rechts naar links: eerst bedragen, dan code, dan toelichting, rest = label.

AMOUNT_AT_END = re.compile(r"(-?\d{1,3}(?:\.\d{3})+)$")  # Belgisch formaat: 1.234.567
CODE_AT_END = re.compile(r"(\d{1,4}(?:/\d{1,4})?[A-Z]?)$")  # bijv. 70, 29/58, 416A
TOEL_AT_END = re.compile(r"(\d+(?:\.\d+)*(?:/\d+(?:\.\d+)*)?)$")  # toelichtingsnr.
CODE_FIRST_LINE = re.compile(
    r"^(?:(\d+(?:\.\d+)+)\s+)?"  # optionele toelichting vooraan
    r"(\d{1,4}(?:/\d{1,4})?[A-Z]?)\s+"
    r"(-?\d{1,3}(?:\.\d{3})+)(?:\s+(-?\d{1,3}(?:\.\d{3})+))?$"
)
CONTINUATION_ONLY = re.compile(r"^\([^)]+\)$")  # voortzetting omschrijving op volgende regel

SKIP_PATTERNS = (
    re.compile(r"^N.o", re.IGNORECASE),
    re.compile(r"VOL-kap", re.IGNORECASE),
    re.compile(r"^Page \d+ of \d+$", re.IGNORECASE),
    re.compile(r"^JAARREKENING$", re.IGNORECASE),
    re.compile(r"^BALANS", re.IGNORECASE),
    re.compile(r"^Toel\.", re.IGNORECASE),
    re.compile(r"^\d{10}$"),  # ondernemingsnummer
)

# --- 2. Sectie-detectie ------------------------------------------------------
# Headers ACTIVA / PASSIVA / RESULTATENREKENING wisselen de huidige sectie.

SECTION_LINE_PATTERNS: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"^ACTIVA$", re.IGNORECASE), "balans_activa"),
    (re.compile(r"^VLOTTENDE ACTIVA\s*$", re.IGNORECASE), "balans_activa"),
    (re.compile(r"^PASSIVA$", re.IGNORECASE), "balans_passiva"),
    (re.compile(r"^RESULTATENREKENING$", re.IGNORECASE), "resultatenrekening"),
)

SECTION_KEYS = ("balans_activa", "balans_passiva", "resultatenrekening")


@dataclass
class Row:
    """Intern model met Nederlandse veldnamen; tests asserten op boekjaar/vorig_boekjaar."""

    sectie: str
    omschrijving: str
    toelichting: str
    code: str
    boekjaar: int | None
    vorig_boekjaar: int | None


def parse_amount(value: str) -> int:
    """'1.234.567' → 1234567 (hele euro's)."""
    return int(value.replace(".", ""))


def should_skip(line: str) -> bool:
    stripped = line.strip()
    if not stripped:
        return True
    return any(pattern.search(stripped) for pattern in SKIP_PATTERNS)


def detect_section_header(line: str) -> str | None:
    stripped = line.strip()
    for pattern, section in SECTION_LINE_PATTERNS:
        if pattern.search(stripped):
            return section
    return None


def parse_line(line: str, section: str, *, require_description: bool = True) -> Row | None:
    """Parse één PDF-regel: label links, code en bedragen rechts (max. 2 bedragen)."""
    stripped = line.strip()
    if should_skip(stripped):
        return None

    amounts: list[int] = []
    rest = stripped

    # Stap A: trek tot 2 bedragen van rechts af
    for _ in range(2):
        match = AMOUNT_AT_END.search(rest)
        if not match:
            break
        amounts.insert(0, parse_amount(match.group(1)))
        rest = rest[: match.start()].rstrip()

    # Stap B: MAR-code direct links van de bedragen
    code_match = CODE_AT_END.search(rest)
    if not code_match:
        return None

    code = code_match.group(1)
    rest = rest[: code_match.start()].rstrip()

    # Stap C: optioneel toelichtingsnummer
    toelichting = ""
    toel_match = TOEL_AT_END.search(rest)
    if toel_match:
        toelichting = toel_match.group(1)
        rest = rest[: toel_match.start()].rstrip()

    omschrijving = rest.strip()
    if require_description and not omschrijving:
        return None

    boekjaar = amounts[0] if len(amounts) >= 1 else None
    vorig_boekjaar = amounts[1] if len(amounts) >= 2 else None

    return Row(
        sectie=section,
        omschrijving=omschrijving,
        toelichting=toelichting,
        code=code,
        boekjaar=boekjaar,
        vorig_boekjaar=vorig_boekjaar,
    )


def parse_code_first_line(line: str, section: str) -> Row | None:
    """Alternatief formaat: code staat vooraan, omschrijving volgt op volgende regel."""
    match = CODE_FIRST_LINE.match(line.strip())
    if not match:
        return None

    toelichting = match.group(1) or ""
    code = match.group(2)
    boekjaar = parse_amount(match.group(3))
    vorig_boekjaar = parse_amount(match.group(4)) if match.group(4) else None

    return Row(
        sectie=section,
        omschrijving="",
        toelichting=toelichting,
        code=code,
        boekjaar=boekjaar,
        vorig_boekjaar=vorig_boekjaar,
    )


def extract_rows_from_pdf(pdf_source: bytes | Path) -> dict[str, list[Row]]:
    """--- 3. Hoofdlus: pagina's lezen, sectie bijhouden, regels parsen ---"""
    grouped: dict[str, list[Row]] = {key: [] for key in SECTION_KEYS}
    current_section: str | None = None
    pending_description = ""

    if isinstance(pdf_source, bytes):
        pdf_handle = pdfplumber.open(io.BytesIO(pdf_source))
    else:
        pdf_handle = pdfplumber.open(str(pdf_source))

    with pdf_handle as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            for line in text.splitlines():
                stripped = line.strip()
                header_section = detect_section_header(stripped)
                if header_section is not None:
                    current_section = header_section
                    pending_description = ""
                    continue

                if current_section is None:
                    continue

                if should_skip(stripped):
                    continue

                # Omschrijving die over meerdere regels loopt (tussen haakjes)
                if CONTINUATION_ONLY.match(stripped):
                    pending_description = f"{pending_description} {stripped}".strip()
                    continue

                candidate = f"{pending_description} {stripped}".strip() if pending_description else stripped
                row = parse_line(candidate, current_section)
                if row is not None:
                    if pending_description and not row.omschrijving.startswith(pending_description):
                        row.omschrijving = f"{pending_description} {row.omschrijving}".strip()
                    pending_description = ""
                    grouped[current_section].append(row)
                    continue

                code_first = parse_code_first_line(stripped, current_section)
                if code_first is not None:
                    if pending_description:
                        code_first.omschrijving = pending_description
                        pending_description = ""
                    grouped[current_section].append(code_first)
                    continue

                pending_description = f"{pending_description} {stripped}".strip()

    return grouped


def row_to_statement(row: Row) -> StatementLine:
    """Map intern Row-model naar API StatementLine (Nederlands → Engels)."""
    return StatementLine(
        section=row.sectie,
        label=row.omschrijving,
        footnote=row.toelichting,
        code=row.code,
        current=row.boekjaar,
        previous=row.vorig_boekjaar,
    )


def extract_statements(pdf_source: bytes | Path) -> dict[str, list[StatementLine]]:
    """Publieke API: PDF → dict met StatementLine-lijsten per sectie."""
    grouped = extract_rows_from_pdf(pdf_source)
    return {key: [row_to_statement(row) for row in grouped[key]] for key in SECTION_KEYS}
