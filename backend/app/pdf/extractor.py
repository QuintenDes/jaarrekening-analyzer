"""Kolom-gebaseerde extractie uit Belgische NBB-jaarrekening-PDF's.

Een PDF-regel zoals "Handelsvorderingen 40 1.234.567 1.100.000" wordt een Row
met MAR-code, omschrijving, toelichting en bedragen. Later mapt row_to_statement()
naar het Engelse API-model StatementLine (current/previous).

Extractievenster: start na JAARREKENING, stop vóór TOELICHTING.
"""

from __future__ import annotations

import io
import re
from dataclasses import dataclass, field
from pathlib import Path

import pdfplumber

from app.models.schemas import ScanHighlight, StatementLine
from app.pdf.format import SCHEMA_HEADER_RE, detect_schema_format_from_text

# --- 1. Regex-patronen -------------------------------------------------------
# NBB-PDF's hebben vaste kolommen: omschrijving | toel. | code | boekjaar | vorig jaar.
# We parsen van rechts naar links: eerst bedragen, dan code, dan toelichting, rest = label.

AMOUNT_AT_END = re.compile(r"(-?\d{1,3}(?:\.\d{3})+)$")  # Belgisch formaat: 1.234.567
# Bedrag met of zonder duizendpunten (1.064 of 80)
AMOUNT_TOKEN = r"-?\d{1,3}(?:\.\d{3})+|-?\d+"
# MAR-code, optioneel tussen haakjes (kruisverwijzing zoals (9905) of (14))
MAR_CODE = r"\d{1,4}(?:/\d{1,4})?[A-Z]?"
CODE_AT_END = re.compile(rf"({MAR_CODE})$")  # normale code zonder haakjes
# Kruisverwijzing + optionele bedragen (ook zonder duizendtallen: 236 911)
PAREN_CODE_SUFFIX = re.compile(
    rf"\(({MAR_CODE})\)"
    rf"(?:\s+(-?\d{{1,3}}(?:\.\d{{3}})*))?"
    rf"(?:\s+(-?\d{{1,3}}(?:\.\d{{3}})*))?$"
)
# Normale code + bedragen (gemengd: 75/76B 1.064 80 of 14P 911 911)
PLAIN_CODE_AMOUNTS = re.compile(
    rf"\s({MAR_CODE})"
    rf"(?:\s+({AMOUNT_TOKEN}))"
    rf"(?:\s+({AMOUNT_TOKEN}))?$"
)
TOEL_AT_END = re.compile(r"(\d+(?:\.\d+)*(?:/\d+(?:\.\d+)*)?)$")  # toelichtingsnr.
# Tekenkolom vóór de MAR-code: (+)/(-), (-) of (+)
SIGN_PREFIX = re.compile(r"^(?:\(\+\)/\(-\)|\(-\)|\(\+\))\s*")
CODE_FIRST_LINE = re.compile(
    r"^(?:(\d+(?:\.\d+)+)\s+)?"  # optionele toelichting vooraan
    rf"\(?({MAR_CODE})\)?\s+"
    r"(-?\d{1,3}(?:\.\d{3})+)(?:\s+(-?\d{1,3}(?:\.\d{3})+))?$"
)
# Voortzetting omschrijving tussen haakjes, maar geen MAR-code zoals (9905)
CONTINUATION_ONLY = re.compile(rf"^\((?!{MAR_CODE}\))[^)]+\)$")

JAARREKENING_GATE = re.compile(r"^JAARREKENING$", re.IGNORECASE)

# Voetteksten zoals "5 / 55" (pagina / totaal) — geen MAR-codes.
PAGE_NUMBER_RE = re.compile(r"^\d+\s*/\s*\d+$")

# Toelichting begint typisch bij sectie 6 (VOL/VKT/MIC-kap/inb 6.x); vaak zonder
# exacte titelregel "TOELICHTING".
TOELICHTING_SECTION_RE = re.compile(
    r"\b(?:VOL|VKT|MIC)-(?:kap|inb)\s+([6-9]|\d{2,})\b",
    re.IGNORECASE,
)

STOP_PATTERNS = (
    re.compile(r"^TOELICHTING$", re.IGNORECASE),
    re.compile(r"^SOCIALE\s+BALANS$", re.IGNORECASE),
    re.compile(r"^STAAT VAN DE\b", re.IGNORECASE),
    TOELICHTING_SECTION_RE,
)

SKIP_PATTERNS = (
    re.compile(r"^N[r°º.]?\s*\.?\s*\d{10}", re.IGNORECASE),  # Nr. 0425716964 …
    re.compile(r"^N.o", re.IGNORECASE),
    SCHEMA_HEADER_RE,
    PAGE_NUMBER_RE,
    re.compile(r"^Page \d+ of \d+$", re.IGNORECASE),
    re.compile(r"^BALANS", re.IGNORECASE),
    re.compile(r"^Toel\.", re.IGNORECASE),
    re.compile(r"^Codes\s+Boekjaar", re.IGNORECASE),
    re.compile(r"^\d{10}$"),  # ondernemingsnummer
)

# --- 2. Sectie-detectie ------------------------------------------------------
# Headers wisselen de huidige sectie binnen het JAARREKENING-venster.

SECTION_LINE_PATTERNS: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"^ACTIVA$", re.IGNORECASE), "balans_activa"),
    (re.compile(r"^VLOTTENDE ACTIVA\s*$", re.IGNORECASE), "balans_activa"),
    (re.compile(r"^PASSIVA$", re.IGNORECASE), "balans_passiva"),
    (re.compile(r"^RESULTATENREKENING$", re.IGNORECASE), "resultatenrekening"),
    (re.compile(r"^RESULTAATVERWERKING$", re.IGNORECASE), "resultaatverwerking"),
)

SECTION_KEYS = (
    "balans_activa",
    "balans_passiva",
    "resultatenrekening",
    "resultaatverwerking",
)


@dataclass
class Row:
    """Intern model met Nederlandse veldnamen; tests asserten op boekjaar/vorig_boekjaar."""

    sectie: str
    omschrijving: str
    toelichting: str
    code: str
    boekjaar: int | None
    vorig_boekjaar: int | None


@dataclass
class TextLine:
    """Eén tekstregel, optioneel met pdfplumber-geometrie (PDF-punten, top-left)."""

    text: str
    page: int | None = None
    x0: float | None = None
    top: float | None = None
    x1: float | None = None
    bottom: float | None = None


# NBB multi-line labels place the amounts column between wrapped description lines.
# Cluster lines whose tops are within this delta into one visual statement row.
CLUSTER_MAX_TOP_DELTA = 11.0


def cluster_text_lines(
    lines: list[TextLine],
    *,
    max_top_delta: float = CLUSTER_MAX_TOP_DELTA,
) -> list[list[TextLine]]:
    """Group vertically interleaved pdfplumber lines into visual rows."""
    if not lines:
        return []

    clusters: list[list[TextLine]] = [[lines[0]]]
    for line in lines[1:]:
        prev = clusters[-1][-1]
        can_cluster = (
            line.page is not None
            and prev.page is not None
            and line.page == prev.page
            and line.top is not None
            and prev.top is not None
            and (line.top - prev.top) <= max_top_delta
        )
        if can_cluster:
            clusters[-1].append(line)
        else:
            clusters.append([line])
    return clusters


# Alleen een MAR-code op de regel (zoals losse "19" naast een wrap-label)
CODE_ONLY_LINE = re.compile(rf"^({MAR_CODE})$")


def _is_code_only_fragment(text: str) -> bool:
    return CODE_ONLY_LINE.match(text.strip()) is not None


def _is_code_column_fragment(text: str) -> bool:
    """True if this fragment is the NBB code column (sign + code + optional amounts).

    Two common layouts:
    - Pure code column: \"(+)/(-) 635/8\" (no amounts) between wrapped labels
    - Mixed wrap + code/amounts on one line: \"…toevoegingen (+)/(-) 631/4 -1.109.904 407.102\"
      (must still sort after pure description fragments so the code stays at the end)
    """
    stripped = text.strip()
    if not stripped:
        return False
    if _is_code_only_fragment(stripped):
        return True
    if CODE_FIRST_LINE.match(stripped):
        return True
    if PAREN_CODE_SUFFIX.search(stripped):
        return True

    rest = stripped
    amount_count = 0
    for _ in range(2):
        match = AMOUNT_AT_END.search(rest)
        if not match:
            break
        amount_count += 1
        rest = rest[: match.start()].rstrip()

    code_match = CODE_AT_END.search(rest)
    if not code_match:
        return False

    # Code + bedragen: ook als er nog wrap-tekst vóór de code staat
    if amount_count > 0:
        return True

    # Zonder bedragen: alleen zuivere codekolom zoals "(+)/(-) 635/8"
    before = SIGN_PREFIX.sub("", rest[: code_match.start()].rstrip()).strip()
    if not before:
        return True
    return TOEL_AT_END.fullmatch(before) is not None


def merge_cluster(cluster: list[TextLine]) -> TextLine:
    """Merge a visual row into one TextLine with union bbox.

    Description fragments first, code-column fragments last —
    NBB PDFs often interleave the code/amounts column between wrapped labels.
    """
    if len(cluster) == 1:
        return cluster[0]

    ordered = sorted(
        cluster,
        key=lambda item: (
            item.top if item.top is not None else 0.0,
            item.x0 if item.x0 is not None else 0.0,
        ),
    )
    descriptions: list[TextLine] = []
    code_column: list[TextLine] = []
    for part in ordered:
        if _is_code_column_fragment(part.text):
            code_column.append(part)
        else:
            descriptions.append(part)

    parts = descriptions + code_column
    text = " ".join(part.text.strip() for part in parts if part.text.strip())
    xs0 = [part.x0 for part in cluster if part.x0 is not None]
    tops = [part.top for part in cluster if part.top is not None]
    xs1 = [part.x1 for part in cluster if part.x1 is not None]
    bottoms = [part.bottom for part in cluster if part.bottom is not None]
    return TextLine(
        text=text,
        page=cluster[0].page,
        x0=min(xs0) if xs0 else None,
        top=min(tops) if tops else None,
        x1=max(xs1) if xs1 else None,
        bottom=max(bottoms) if bottoms else None,
    )


@dataclass
class ExtractionResult:
    """Rijen per sectie plus gedetecteerd NBB-schema (of None)."""

    rows: dict[str, list[Row]]
    schema_format: str | None
    highlights: list[ScanHighlight] = field(default_factory=list)
    page_count: int | None = None
    page_sizes: list[tuple[float, float]] = field(default_factory=list)


def parse_amount(value: str) -> int:
    """'1.234.567' → 1234567 (hele euro's)."""
    return int(value.replace(".", ""))


def _is_amount_token(text: str) -> bool:
    stripped = text.strip()
    return bool(re.fullmatch(AMOUNT_TOKEN, stripped))


def detect_year_column_midpoint(words: list[dict[str, object]]) -> float | None:
    """Midden tussen kolommen Boekjaar en Vorig boekjaar (pdfplumber x)."""
    boekjaar = next((w for w in words if w.get("text") == "Boekjaar"), None)
    vorig = next((w for w in words if w.get("text") == "Vorig"), None)
    if boekjaar is None or vorig is None:
        return None
    # Gebruik rechterkant Boekjaar-header en linkerkant Vorig-header
    return (float(boekjaar["x1"]) + float(vorig["x0"])) / 2.0


def realign_single_amount_by_geometry(
    row: Row,
    line: TextLine,
    page_words: list[dict[str, object]],
    column_mid_x: float | None,
) -> Row:
    """Zet één bedrag in vorig boekjaar als het rechts in die kolom staat.

    PDF-tekst is 'Onbeschikbaar 111 18.600' zowel voor enkel huidig als enkel vorig
    jaar — alleen de x-positie onderscheidt de kolom.
    """
    if column_mid_x is None:
        return row
    if row.boekjaar is None or row.vorig_boekjaar is not None:
        return row
    if line.top is None or line.bottom is None:
        return row

    pad = 4.0
    matches: list[dict[str, object]] = []
    for word in page_words:
        text = str(word.get("text") or "")
        if not _is_amount_token(text):
            continue
        try:
            value = parse_amount(text)
        except ValueError:
            continue
        if value != row.boekjaar:
            continue
        top = float(word["top"])
        if top < line.top - pad or top > line.bottom + pad:
            continue
        # Negeer MAR-codes in de codecolom (links van de bedragen)
        if float(word["x0"]) < column_mid_x - 80:
            continue
        matches.append(word)

    if not matches:
        return row

    amount_word = max(matches, key=lambda item: float(item["x0"]))
    if float(amount_word["x0"]) >= column_mid_x:
        row.vorig_boekjaar = row.boekjaar
        row.boekjaar = None
    return row


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


def is_stop_header(line: str) -> bool:
    stripped = line.strip()
    return any(pattern.search(stripped) for pattern in STOP_PATTERNS)


def parse_line(line: str, section: str, *, require_description: bool = True) -> Row | None:
    """Parse één PDF-regel: label links, code en bedragen rechts (max. 2 bedragen)."""
    stripped = line.strip()
    if should_skip(stripped):
        return None

    # Kruisverwijzingen: "... (9905) 1.093.780 3.554.703" of "... (14) 236 911"
    paren_match = PAREN_CODE_SUFFIX.search(stripped)
    if paren_match:
        code = paren_match.group(1)
        raw_curr = paren_match.group(2)
        raw_prev = paren_match.group(3)
        omschrijving = stripped[: paren_match.start()].rstrip()
        if require_description and not omschrijving:
            return None
        return Row(
            sectie=section,
            omschrijving=omschrijving,
            toelichting="",
            code=code,
            boekjaar=parse_amount(raw_curr) if raw_curr else None,
            vorig_boekjaar=parse_amount(raw_prev) if raw_prev else None,
        )

    amounts: list[int] = []
    rest = stripped

    # Stap A: trek tot 2 bedragen van rechts af (Belgisch met punten)
    for _ in range(2):
        match = AMOUNT_AT_END.search(rest)
        if not match:
            break
        amounts.insert(0, parse_amount(match.group(1)))
        rest = rest[: match.start()].rstrip()

    # Mix: "111 0 13.067" — na een gedoteerd bedrag nog een kale 0/80/... pellen,
    # maar alleen als er daarna nog een MAR-code overblijft (niet "Omzet 70").
    if amounts and len(amounts) < 2:
        plain = re.search(r"(-?\d+)$", rest)
        if plain:
            trial = rest[: plain.start()].rstrip()
            if CODE_AT_END.search(trial):
                amounts.insert(0, parse_amount(plain.group(1)))
                rest = trial

    # Stap A2: geen gedoteerde bedragen → code + kale gehele bedragen (14P 911 911)
    if not amounts:
        plain_match = PLAIN_CODE_AMOUNTS.search(stripped)
        if plain_match:
            code = plain_match.group(1)
            omschrijving = stripped[: plain_match.start()].rstrip()
            if require_description and not omschrijving:
                return None
            raw_curr = plain_match.group(2)
            raw_prev = plain_match.group(3)
            return Row(
                sectie=section,
                omschrijving=omschrijving,
                toelichting="",
                code=code,
                boekjaar=parse_amount(raw_curr) if raw_curr else None,
                vorig_boekjaar=parse_amount(raw_prev) if raw_prev else None,
            )

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


def _highlight_from_line(line: TextLine, section: str, code: str) -> ScanHighlight | None:
    if (
        line.page is None
        or line.x0 is None
        or line.top is None
        or line.x1 is None
        or line.bottom is None
    ):
        return None
    return ScanHighlight(
        page=line.page,
        x0=line.x0,
        top=line.top,
        x1=line.x1,
        bottom=line.bottom,
        section=section,
        code=code,
    )


def extract_rows_from_lines(
    lines: list[TextLine],
    *,
    page_words: dict[int, list[dict[str, object]]] | None = None,
    page_column_mids: dict[int, float] | None = None,
) -> ExtractionResult:
    """Parse tekstregels (met optionele geometrie) via de JAARREKENING-state machine."""
    grouped: dict[str, list[Row]] = {key: [] for key in SECTION_KEYS}
    highlights: list[ScanHighlight] = []
    schema_format: str | None = None
    in_statements = False
    current_section: str | None = None
    pending_description = ""
    words_by_page = page_words or {}
    mids_by_page = page_column_mids or {}

    for line in lines:
        stripped = line.text.strip()

        if schema_format is None:
            schema_format = detect_schema_format_from_text(stripped)

        if not in_statements:
            if JAARREKENING_GATE.match(stripped):
                in_statements = True
            continue

        if is_stop_header(stripped):
            break

        # Herhaalde JAARREKENING-titel op latere pagina's overslaan
        if JAARREKENING_GATE.match(stripped):
            continue

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
            if line.page is not None:
                row = realign_single_amount_by_geometry(
                    row,
                    line,
                    words_by_page.get(line.page, []),
                    mids_by_page.get(line.page),
                )
            grouped[current_section].append(row)
            highlight = _highlight_from_line(line, current_section, row.code)
            if highlight is not None:
                highlights.append(highlight)
            continue

        code_first = parse_code_first_line(stripped, current_section)
        if code_first is not None:
            if pending_description:
                code_first.omschrijving = pending_description
                pending_description = ""
            if line.page is not None:
                code_first = realign_single_amount_by_geometry(
                    code_first,
                    line,
                    words_by_page.get(line.page, []),
                    mids_by_page.get(line.page),
                )
            grouped[current_section].append(code_first)
            highlight = _highlight_from_line(line, current_section, code_first.code)
            if highlight is not None:
                highlights.append(highlight)
            continue

        pending_description = f"{pending_description} {stripped}".strip()

    return ExtractionResult(
        rows=grouped,
        schema_format=schema_format,
        highlights=highlights,
    )


def extract_rows_from_text(lines: list[str]) -> ExtractionResult:
    """Parse platte tekstregels (ook bruikbaar in unit tests zonder PDF)."""
    return extract_rows_from_lines([TextLine(text=line) for line in lines])


def extract_rows_from_pdf(pdf_source: bytes | Path) -> ExtractionResult:
    """--- 3. Hoofdlus: pagina's lezen met geometrie, JAARREKENING-venster ---"""
    if isinstance(pdf_source, bytes):
        pdf_handle = pdfplumber.open(io.BytesIO(pdf_source))
    else:
        pdf_handle = pdfplumber.open(str(pdf_source))

    all_lines: list[TextLine] = []
    page_sizes: list[tuple[float, float]] = []
    page_words: dict[int, list[dict[str, object]]] = {}
    page_column_mids: dict[int, float] = {}
    with pdf_handle as pdf:
        for page_index, page in enumerate(pdf.pages):
            page_sizes.append((float(page.width), float(page.height)))
            words = page.extract_words() or []
            page_words[page_index] = words
            mid = detect_year_column_midpoint(words)
            if mid is not None:
                page_column_mids[page_index] = mid
            for raw in page.extract_text_lines() or []:
                all_lines.append(
                    TextLine(
                        text=raw.get("text") or "",
                        page=page_index,
                        x0=float(raw["x0"]),
                        top=float(raw["top"]),
                        x1=float(raw["x1"]),
                        bottom=float(raw["bottom"]),
                    )
                )

    result = extract_rows_from_lines(
        [merge_cluster(cluster) for cluster in cluster_text_lines(all_lines)],
        page_words=page_words,
        page_column_mids=page_column_mids,
    )
    result.page_count = len(page_sizes)
    result.page_sizes = page_sizes
    result.highlights = expand_highlights_to_content_width(result.highlights)
    return result


def expand_highlights_to_content_width(
    highlights: list[ScanHighlight],
) -> list[ScanHighlight]:
    """Stretch highlights to the widest content on that page.

    Rows without bedragen only span the label width, so they look unselected
    next to full-width amount rows — expand x0/x1 per page for a clear band.
    """
    if not highlights:
        return highlights

    by_page: dict[int, list[ScanHighlight]] = {}
    for highlight in highlights:
        by_page.setdefault(highlight.page, []).append(highlight)

    expanded: list[ScanHighlight] = []
    for page_highlights in by_page.values():
        left = min(item.x0 for item in page_highlights)
        right = max(item.x1 for item in page_highlights)
        for item in page_highlights:
            expanded.append(
                ScanHighlight(
                    page=item.page,
                    x0=left,
                    top=item.top,
                    x1=right,
                    bottom=item.bottom,
                    section=item.section,
                    code=item.code,
                )
            )
    return expanded


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


def extract_statements(
    pdf_source: bytes | Path,
) -> tuple[dict[str, list[StatementLine]], str | None, list[ScanHighlight], int | None, list[tuple[float, float]]]:
    """Publieke API: PDF → (secties, schema_format, highlights, page_count, page_sizes)."""
    result = extract_rows_from_pdf(pdf_source)
    statements = {
        key: [row_to_statement(row) for row in result.rows[key]] for key in SECTION_KEYS
    }
    return (
        statements,
        result.schema_format,
        result.highlights,
        result.page_count,
        result.page_sizes,
    )
