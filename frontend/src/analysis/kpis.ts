import type { AnalysisResult, StatementLine } from "../types";

export interface KpiDefinition {
  id: string;
  label: string;
  codes: readonly string[];
}

export interface KpiSelection extends KpiDefinition {
  line: StatementLine | null;
  change: number | null;
}

export const KPI_DEFINITIONS: readonly KpiDefinition[] = [
  { id: "revenue", label: "Omzet", codes: ["70", "70/76A", "70/76"] },
  { id: "result", label: "Nettowinst", codes: ["9904"] },
  { id: "total-assets", label: "Totaal activa", codes: ["20/58", "20/59"] },
  { id: "equity", label: "Eigen vermogen", codes: ["10/15"] },
  { id: "cash", label: "Liquide middelen", codes: ["54/58", "55", "57/58", "54"] },
  {
    id: "operating-result",
    label: "Bedrijfsresultaat",
    codes: ["9901"],
  },
];

function allStatementLines(result: AnalysisResult): StatementLine[] {
  return [
    ...result.balance_assets,
    ...result.balance_liabilities,
    ...result.income_statement,
    ...(result.appropriation_of_result ?? []),
  ];
}

export function findMarLine(
  result: AnalysisResult,
  codes: readonly string[],
): StatementLine | null {
  const lines = allStatementLines(result);
  let unavailableMatch: StatementLine | null = null;
  for (const code of codes) {
    const line = lines.find((candidate) => candidate.code.trim() === code);
    if (!line) continue;
    if (line.current !== null || line.previous !== null) return line;
    unavailableMatch ??= line;
  }
  return unavailableMatch;
}

export function percentageChange(
  current: number | null,
  previous: number | null,
): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function selectKpis(result: AnalysisResult): KpiSelection[] {
  return KPI_DEFINITIONS.map((definition) => {
    const line = findMarLine(result, definition.codes);
    return {
      ...definition,
      line,
      change: line ? percentageChange(line.current, line.previous) : null,
    };
  });
}
