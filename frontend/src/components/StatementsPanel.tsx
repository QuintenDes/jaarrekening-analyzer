import { useState } from "react";
import type {
  AmountFormat,
  AnalysisResult,
  SourceSelection,
  StatementSectionId,
} from "../types";
import { StatementTable } from "./StatementTable";

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
      <div className="flex flex-wrap items-center gap-2">
        {STATEMENT_VIEWS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setView(item.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              view === item.id
                ? "bg-emerald-600 text-white"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
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
