import { MAR_LABELS, nbbGlossaryLabel } from "../i18n/marLabels";
import type { RatioSpec, TableColumn } from "../types";

export interface CellRefSuggestion {
  insert: string;
  label: string;
  detail?: string;
  kind: "mar" | "ratio" | "cell" | "pct";
}

export interface RefSuggestContext {
  type: "mar" | "ratio" | "cell" | "pct";
  query: string;
}

const MAR_CODES = Object.keys(MAR_LABELS).sort();

function isCodeColumn(column: TableColumn, index: number): boolean {
  const key = `${column.id} ${column.label}`.toLowerCase();
  return key.includes("code") || index === 0;
}

function amountColumns(columns: TableColumn[]): TableColumn[] {
  return columns.filter((column, index) => !isCodeColumn(column, index));
}

/** Detect whether the caret is in a ref prefix the user is still typing. */
export function detectRefContext(value: string): RefSuggestContext | null {
  const mar = /^(mar\.(?:current|previous|prev|boekjaar|vorig):|mar:|@)(.*)$/i.exec(
    value,
  );
  if (mar) return { type: "mar", query: mar[2] };

  const ratio = /^(?:ratio:|ratio\/)(.*)$/i.exec(value);
  if (ratio) return { type: "ratio", query: ratio[1] };

  const cell = /^cell:(.*)$/i.exec(value);
  if (cell) return { type: "cell", query: cell[1] };

  const pct = /^pct:(.*)$/i.exec(value);
  if (pct) return { type: "pct", query: pct[1] };

  return null;
}

function matchQuery(haystack: string, query: string): boolean {
  if (!query) return true;
  return haystack.toLowerCase().includes(query.toLowerCase());
}

export function getCellRefSuggestions(
  value: string,
  columns: TableColumn[],
  ratioSpecs: RatioSpec[],
): CellRefSuggestion[] {
  const ctx = detectRefContext(value);
  if (!ctx) return [];

  const limit = 12;

  if (ctx.type === "mar") {
    const q = ctx.query.trim();
    return MAR_CODES.filter((code) => {
      if (matchQuery(code, q)) return true;
      const label = nbbGlossaryLabel(code);
      return label ? matchQuery(label, q) : false;
    })
      .slice(0, limit)
      .map((code) => {
        const prefix = value.match(/^(mar\.(?:current|previous|prev|boekjaar|vorig):|mar:|@)/i)?.[0] ?? "mar:";
        const insert =
          prefix.toLowerCase().startsWith("mar.") || prefix === "@"
            ? `${prefix}${code}`
            : `mar:${code}`;
        return {
          insert,
          label: code,
          detail: nbbGlossaryLabel(code) ?? undefined,
          kind: "mar" as const,
        };
      });
  }

  if (ctx.type === "ratio") {
    const q = ctx.query.trim().toLowerCase();
    return ratioSpecs
      .filter(
        (spec) =>
          matchQuery(spec.id, q) ||
          matchQuery(spec.name, q) ||
          matchQuery(spec.category, q),
      )
      .slice(0, limit)
      .map((spec) => ({
        insert: `ratio:${spec.id}`,
        label: spec.id,
        detail: spec.name,
        kind: "ratio" as const,
      }));
  }

  if (ctx.type === "cell") {
    const q = ctx.query.trim().toLowerCase();
    return columns
      .filter(
        (column) =>
          matchQuery(column.id, q) || matchQuery(column.label, q),
      )
      .slice(0, limit)
      .map((column) => ({
        insert: `cell:${column.id}`,
        label: column.id,
        detail: column.label || undefined,
        kind: "cell" as const,
      }));
  }

  const q = ctx.query.trim().toLowerCase();
  const amounts = amountColumns(columns);
  const pairs: CellRefSuggestion[] = [];
  for (const from of amounts) {
    for (const to of amounts) {
      if (from.id === to.id) continue;
      const insert = `pct:${from.id},${to.id}`;
      const label = `${from.label || from.id} → ${to.label || to.id}`;
      if (!q || matchQuery(insert, q) || matchQuery(label, q)) {
        pairs.push({
          insert,
          label,
          detail: "% verschil",
          kind: "pct",
        });
      }
    }
  }
  return pairs.slice(0, limit);
}
