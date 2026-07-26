/** Eén regel uit balans of resultatenrekening (spiegel van backend StatementLine). */
export interface StatementLine {
  section: string;
  label: string;
  footnote: string;
  code: string;
  current: number | null; // bedrag huidig boekjaar in EUR
  previous: number | null; // bedrag vorig boekjaar in EUR
}

/** Eén berekende ratio (spiegel van backend RatioResult). */
export interface RatioResult {
  id: string;
  name: string;
  category: string; // liquiditeit | solvabiliteit | rentabiliteit
  value: number | null;
  unit: string; // %, x, EUR
  formula: string;
  missing_codes: string[]; // MAR-codes die ontbraken
}

/** Percentage-verdeling t.o.v. een totaal (balans/omzet). */
export interface StructureItem {
  code: string;
  label: string;
  current: number | null;
  previous: number | null;
  pct_current: number | null;
  pct_previous: number | null;
}

/**
 * Volledig antwoord van POST /api/analyze.
 * Velden komen 1-op-1 overeen met backend AnalysisResult.
 */
export interface AnalysisResult {
  balance_assets: StatementLine[]; // balans activa
  balance_liabilities: StatementLine[]; // balans passiva
  income_statement: StatementLine[]; // resultatenrekening
  ratios: RatioResult[]; // berekende ratio's
  balance_structure: StructureItem[]; // aandeel per activapost
  income_structure: StructureItem[]; // aandeel t.o.v. omzet
  warnings: string[]; // niet-fatale meldingen
  validations: string[]; // balanscontroles
}
