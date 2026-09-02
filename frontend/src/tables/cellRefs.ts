import type {
  AmountFormat,
  AnalysisResult,
  RatioResult,
  StatementLine,
  TableColumn,
} from "../types";
import { formatAmount, formatRatio } from "../utils/format";

export type CellYear = "current" | "previous";

export type ParsedCellRef =
  | { kind: "literal"; text: string }
  | { kind: "mar"; expr: string; year: CellYear | "auto" }
  | { kind: "ratio"; id: string };

export interface ResolvedCell {
  /** Display text for the cell. */
  text: string;
  /** Tooltip / title with the original reference when resolved. */
  title?: string;
  /** True when the cell is a mar:/ratio: reference. */
  isRef: boolean;
  /** True when a reference could not be resolved. */
  missing: boolean;
}

/** VOL→MIC style aliases, mirrored from backend CodeAggregator. */
const CODE_ALIASES: Record<string, readonly string[]> = {
  "70/76A": ["70"],
};

function allStatementLines(result: AnalysisResult): StatementLine[] {
  return [
    ...result.balance_assets,
    ...result.balance_liabilities,
    ...result.income_statement,
    ...(result.appropriation_of_result ?? []),
  ];
}

function buildAmountMaps(lines: StatementLine[]): {
  current: Map<string, number>;
  previous: Map<string, number>;
} {
  const current = new Map<string, number>();
  const previous = new Map<string, number>();
  for (const line of lines) {
    const code = line.code.trim();
    if (!code) continue;
    if (line.current !== null) current.set(code, line.current);
    if (line.previous !== null) previous.set(code, line.previous);
  }
  return { current, previous };
}

function lookupCode(
  maps: { current: Map<string, number>; previous: Map<string, number> },
  code: string,
  year: CellYear,
): number | null {
  const store = year === "current" ? maps.current : maps.previous;
  if (store.has(code)) return store.get(code) ?? null;
  for (const alias of CODE_ALIASES[code] ?? []) {
    if (store.has(alias)) return store.get(alias) ?? null;
  }
  return null;
}

/** Evaluate a MAR expression like `29/58` or `29/58 - 3` (slash is part of the code). */
export function evaluateMarExpr(
  expr: string,
  maps: { current: Map<string, number>; previous: Map<string, number> },
  year: CellYear,
): { value: number | null; missing: string[] } {
  const trimmed = expr.trim();
  if (!trimmed) return { value: null, missing: [] };

  if (!trimmed.includes("+") && !trimmed.includes("-")) {
    const value = lookupCode(maps, trimmed, year);
    return value === null ? { value: null, missing: [trimmed] } : { value, missing: [] };
  }

  const parts = trimmed.split(/\s*([+-])\s*/);
  if (!parts.length || !parts[0]?.trim()) {
    return { value: null, missing: [trimmed] };
  }

  const first = lookupCode(maps, parts[0].trim(), year);
  if (first === null) return { value: null, missing: [parts[0].trim()] };

  let total = first;
  for (let i = 1; i < parts.length; i += 2) {
    const op = parts[i];
    const token = parts[i + 1]?.trim() ?? "";
    if (!token) return { value: null, missing: [trimmed] };
    const value = lookupCode(maps, token, year);
    if (value === null) return { value: null, missing: [token] };
    total = op === "+" ? total + value : total - value;
  }
  return { value: total, missing: [] };
}

export function defaultYearForColumn(column: TableColumn): CellYear {
  const key = `${column.id} ${column.label}`.toLowerCase();
  if (
    key.includes("vorig") ||
    key.includes("previous") ||
    key.includes("prev")
  ) {
    return "previous";
  }
  return "current";
}

/**
 * Parse a stored cell string into a reference or literal.
 *
 * Supported forms:
 * - `mar:29/58` / `mar:29/58 - 3` (year from column)
 * - `mar.current:…` / `mar.previous:…` / `mar.prev:…`
 * - `@29/58` (shorthand for mar:)
 * - `ratio:current_ratio` (ratio id)
 * - anything else → literal text
 */
function yearFromToken(token: string): CellYear | "auto" {
  const value = token.toLowerCase();
  if (value === "previous" || value === "prev" || value === "vorig") {
    return "previous";
  }
  if (value === "current" || value === "boekjaar") {
    return "current";
  }
  return "auto";
}

export function parseCellRef(raw: string): ParsedCellRef {
  const text = raw.trim();
  if (!text) return { kind: "literal", text: "" };

  const ratioMatch = /^(?:ratio:|ratio\/)(.+)$/i.exec(text);
  if (ratioMatch) {
    return { kind: "ratio", id: ratioMatch[1].trim() };
  }

  const marYear = /^mar\.(current|previous|prev|boekjaar|vorig):(.+)$/i.exec(text);
  if (marYear) {
    return {
      kind: "mar",
      expr: marYear[2].trim(),
      year: yearFromToken(marYear[1]),
    };
  }

  const atYear = /^@(current|previous|prev):(.+)$/i.exec(text);
  if (atYear) {
    return {
      kind: "mar",
      expr: atYear[2].trim(),
      year: yearFromToken(atYear[1]),
    };
  }

  const marSimple = /^mar:(.+)$/i.exec(text);
  if (marSimple) {
    return { kind: "mar", expr: marSimple[1].trim(), year: "auto" };
  }

  const atSimple = /^@(.+)$/i.exec(text);
  if (atSimple) {
    return { kind: "mar", expr: atSimple[1].trim(), year: "auto" };
  }

  return { kind: "literal", text: raw };
}

export function isCellRef(raw: string): boolean {
  return parseCellRef(raw).kind !== "literal";
}

export function cellRefKind(raw: string): "mar" | "ratio" | null {
  const parsed = parseCellRef(raw);
  if (parsed.kind === "mar") return "mar";
  if (parsed.kind === "ratio") return "ratio";
  return null;
}

function findRatio(
  ratios: RatioResult[] | undefined,
  id: string,
): RatioResult | undefined {
  const needle = id.trim().toLowerCase();
  return ratios?.find((ratio) => ratio.id.toLowerCase() === needle);
}

export function resolveCellValue(
  raw: string,
  column: TableColumn,
  result: AnalysisResult | null | undefined,
  amountFormat: AmountFormat = "full",
): ResolvedCell {
  const parsed = parseCellRef(raw);

  if (parsed.kind === "literal") {
    return { text: raw, isRef: false, missing: false };
  }

  if (!result) {
    return {
      text: raw.trim(),
      title: "Analyseer eerst een PDF om deze verwijzing te berekenen.",
      isRef: true,
      missing: true,
    };
  }

  if (parsed.kind === "ratio") {
    const ratio = findRatio(result.ratios, parsed.id);
    if (!ratio) {
      return {
        text: "—",
        title: `Onbekende ratio-id: ${parsed.id}`,
        isRef: true,
        missing: true,
      };
    }
    if (ratio.value === null) {
      return {
        text: "—",
        title: ratio.missing_codes.length
          ? `Ratio ${ratio.id}: ontbrekende codes ${ratio.missing_codes.join(", ")}`
          : `Ratio ${ratio.id}: geen waarde`,
        isRef: true,
        missing: true,
      };
    }
    return {
      text: formatRatio(ratio.value, ratio.unit),
      title: `${ratio.name} (${ratio.id})`,
      isRef: true,
      missing: false,
    };
  }

  const year =
    parsed.year === "auto" ? defaultYearForColumn(column) : parsed.year;
  const maps = buildAmountMaps(allStatementLines(result));
  const { value, missing } = evaluateMarExpr(parsed.expr, maps, year);
  if (value === null) {
    return {
      text: "—",
      title: missing.length
        ? `Ontbrekende MAR-code(s): ${missing.join(", ")}`
        : `Geen bedrag voor ${parsed.expr}`,
      isRef: true,
      missing: true,
    };
  }
  return {
    text: formatAmount(value, amountFormat),
    title: `${parsed.expr} (${year === "current" ? "boekjaar" : "vorig"})`,
    isRef: true,
    missing: false,
  };
}
