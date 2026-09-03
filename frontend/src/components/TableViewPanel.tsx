import { useEffect, useState } from "react";
import { getTablesConfig } from "../api/client";
import type {
  AmountFormat,
  AnalysisResult,
  FinancialTableConfig,
  ModelKind,
  TabellenViewId,
} from "../types";
import { inferModelFromSchema } from "../tables/rowCells";
import {
  MODEL_LABELS,
  tableIdForView,
  VIEW_ITEMS,
  type ResultGroup,
} from "../tables/views";
import { EditableFinancialTable } from "./EditableFinancialTable";
import { SubTabs } from "./SubTabs";

interface TableViewPanelProps {
  analysisResult?: AnalysisResult | null;
  amountFormat?: AmountFormat;
}

export function TableViewPanel({
  analysisResult = null,
  amountFormat = "full",
}: TableViewPanelProps) {
  const [tables, setTables] = useState<FinancialTableConfig[]>([]);
  const [view, setView] = useState<TabellenViewId>("cashflow");
  const [resultGroup, setResultGroup] = useState<ResultGroup>("full");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewModel, setViewModel] = useState<ModelKind>("full");

  const activeTableId = tableIdForView(view, resultGroup);
  const activeTable = tables.find((table) => table.id === activeTableId) ?? null;

  useEffect(() => {
    if (!activeTable) return;
    const inferred = inferModelFromSchema(analysisResult?.schema_format);
    if (inferred && activeTable.model_scope.includes(inferred)) {
      setViewModel(inferred);
      return;
    }
    if (!activeTable.model_scope.includes(viewModel)) {
      setViewModel(activeTable.model_scope[0] ?? "full");
    }
  }, [activeTable?.id, analysisResult?.schema_format]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void getTablesConfig()
      .then((config) => {
        if (cancelled) return;
        setTables(config.tables);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Kon tabellen niet laden.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-w-0 space-y-3">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="space-y-3 border-b border-slate-100 p-3">
          <SubTabs items={VIEW_ITEMS} value={view} onChange={setView} />

          {view === "herwerkte_resultatenrekening" && (
            <div
              role="group"
              aria-label="Resultatenrekening variant"
              className="inline-flex overflow-hidden rounded-lg ring-1 ring-slate-200"
            >
              <button
                type="button"
                onClick={() => setResultGroup("full")}
                className={`px-3 py-1.5 text-sm font-medium ${
                  resultGroup === "full"
                    ? "bg-slate-800 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {MODEL_LABELS.full}
              </button>
              <button
                type="button"
                onClick={() => setResultGroup("verkort_micro")}
                className={`px-3 py-1.5 text-sm font-medium ${
                  resultGroup === "verkort_micro"
                    ? "bg-slate-800 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                Verkort + Micro
              </button>
            </div>
          )}

          {activeTable && activeTable.model_scope.length > 1 && (
            <div
              role="group"
              aria-label="Model weergave"
              className="inline-flex flex-wrap gap-1"
            >
              {activeTable.model_scope.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setViewModel(kind)}
                  className={`rounded-md px-2.5 py-1 text-sm font-medium ring-1 ${
                    viewModel === kind
                      ? "bg-slate-800 text-white ring-slate-800"
                      : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {MODEL_LABELS[kind]}
                </button>
              ))}
            </div>
          )}
        </div>

        {activeTable && (
          <EditableFinancialTable
            table={activeTable}
            editable={false}
            analysisResult={analysisResult}
            amountFormat={amountFormat}
            activeModel={viewModel}
          />
        )}

        {loading && (
          <p className="p-3 text-sm text-slate-600">Tabellen laden…</p>
        )}
      </div>
    </div>
  );
}
