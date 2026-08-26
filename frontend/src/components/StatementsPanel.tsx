import { useState } from "react";
import type {
  AmountFormat,
  AnalysisResult,
  SourceSelection,
  StatementSectionId,
} from "../types";
import { StatementTable } from "./StatementTable";
import { SubTabs } from "./SubTabs";

export type StatementViewId =
  | "balans_activa"
  | "balans_passiva"
  | "resultaten"
  | "resultaatverwerking";

const STATEMENT_VIEWS: {
  id: StatementViewId;
  label: string;
  section: StatementSectionId;
  resultKey:
    | "balance_assets"
    | "balance_liabilities"
    | "income_statement"
    | "appropriation_of_result";
}[] = [
  {
    id: "balans_activa",
    label: "Balans activa",
    section: "balans_activa",
    resultKey: "balance_assets",
  },
  {
    id: "balans_passiva",
    label: "Balans passiva",
    section: "balans_passiva",
    resultKey: "balance_liabilities",
  },
  {
    id: "resultaten",
    label: "Resultatenrekening",
    section: "resultatenrekening",
    resultKey: "income_statement",
  },
  {
    id: "resultaatverwerking",
    label: "Resultaatverwerking",
    section: "resultaatverwerking",
    resultKey: "appropriation_of_result",
  },
];

interface StatementsPanelProps {
  result: AnalysisResult;
  amountFormat: AmountFormat;
  selection: SourceSelection | null;
  onSelectRow: (section: StatementSectionId, code: string) => void;
  readOnly: boolean;
}

export function StatementsPanel({
  result,
  amountFormat,
  selection,
  onSelectRow,
  readOnly,
}: StatementsPanelProps) {
  const [view, setView] = useState<StatementViewId>("balans_activa");
  const current = STATEMENT_VIEWS.find((item) => item.id === view) ?? STATEMENT_VIEWS[0];
  const lines = result[current.resultKey] ?? [];

  return (
    <div className="space-y-6">
      <SubTabs
        items={STATEMENT_VIEWS.map((item) => ({
          id: item.id,
          label: item.label,
        }))}
        value={view}
        onChange={setView}
      />
      <StatementTable
        title={current.label}
        lines={lines}
        amountFormat={amountFormat}
        selectedCode={
          selection?.section === current.section ? selection.code : null
        }
        onSelectRow={(code) => onSelectRow(current.section, code)}
        readOnly={readOnly}
      />
    </div>
  );
}
