import type {
  AnalysisResult,
  ScanHighlight,
  SourceSelection,
  StatementLine,
  StatementSectionId,
} from "../types";

export const SECTION_ORDER: StatementSectionId[] = [
  "balans_activa",
  "balans_passiva",
  "resultatenrekening",
  "resultaatverwerking",
];

export const SECTION_TITLES: Record<StatementSectionId, string> = {
  balans_activa: "Activa",
  balans_passiva: "Passiva",
  resultatenrekening: "Resultatenrekening",
  resultaatverwerking: "Resultaatverwerking",
};

export interface SourceOccurrence {
  occurrenceIndex: number;
  highlightIndex: number;
  page: number;
  highlight: ScanHighlight;
}

export interface SourceEntry {
  key: string;
  section: StatementSectionId;
  code: string;
  label: string;
  amount: number | null;
  occurrences: SourceOccurrence[];
}

function isSection(value: string): value is StatementSectionId {
  return (SECTION_ORDER as string[]).includes(value);
}

function linesForSection(
  result: AnalysisResult,
  section: StatementSectionId,
): StatementLine[] {
  if (section === "balans_activa") return result.balance_assets;
  if (section === "balans_passiva") return result.balance_liabilities;
  if (section === "resultatenrekening") return result.income_statement;
  return result.appropriation_of_result ?? [];
}

export function buildSourceEntries(result: AnalysisResult): SourceEntry[] {
  const highlights = result.highlights ?? [];
  const grouped = new Map<string, ScanHighlight[]>();
  const order: string[] = [];

  for (const highlight of highlights) {
    if (!isSection(highlight.section)) continue;
    const key = `${highlight.section}:${highlight.code}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
      order.push(key);
    }
    grouped.get(key)!.push(highlight);
  }

  const entries: SourceEntry[] = [];
  for (const key of order) {
    const items = grouped.get(key)!;
    const first = items[0];
    if (!isSection(first.section)) continue;
    const line = linesForSection(result, first.section).find(
      (item) => item.code === first.code,
    );
    entries.push({
      key,
      section: first.section,
      code: first.code,
      label: line?.label ?? first.code,
      amount: line?.current ?? null,
      occurrences: items.map((highlight, occurrenceIndex) => ({
        occurrenceIndex,
        highlightIndex: highlights.indexOf(highlight),
        page: highlight.page,
        highlight,
      })),
    });
  }
  return entries;
}

export function defaultOccurrence(entry: SourceEntry): SourceOccurrence {
  return entry.occurrences[entry.occurrences.length - 1];
}

export function selectionForEntry(
  entry: SourceEntry,
  occurrenceIndex?: number,
): SourceSelection {
  const occurrence =
    entry.occurrences.find((item) => item.occurrenceIndex === occurrenceIndex) ??
    defaultOccurrence(entry);
  return {
    section: entry.section,
    code: entry.code,
    occurrenceIndex: occurrence.occurrenceIndex,
    page: occurrence.page,
  };
}

export function findEntry(
  entries: SourceEntry[],
  section: string,
  code: string,
): SourceEntry | undefined {
  return entries.find((entry) => entry.section === section && entry.code === code);
}

export function matchesSearch(entry: SourceEntry, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const amountText =
    entry.amount === null || entry.amount === undefined
      ? ""
      : String(entry.amount);
  const hay = `${entry.label} ${entry.code} ${amountText}`.toLowerCase();
  return hay.includes(q);
}

export function tabForSection(section: StatementSectionId) {
  if (section === "resultatenrekening") return "resultaten" as const;
  return section;
}
