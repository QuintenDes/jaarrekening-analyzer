import { useEffect, useState } from "react";
import { getTablesConfig } from "../api/client";
import type { FinancialTableConfig, TabellenViewId } from "../types";
import {
  MODEL_LABELS,
  tableIdForView,
  VIEW_ITEMS,
  type ResultGroup,
} from "../tables/views";
import { EditableFinancialTable } from "./EditableFinancialTable";
import { SubTabs } from "./SubTabs";

export function TableViewPanel() {
  const [tables, setTables] = useState<FinancialTableConfig[]>([]);
  const [view, setView] = useState<TabellenViewId>("cashflow");
  const [resultGroup, setResultGroup] = useState<ResultGroup>("full");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeTableId = tableIdForView(view, resultGroup);
  const activeTable = tables.find((table) => table.id === activeTableId) ?? null;

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
    <div className="min-w-0 space-y-4">
      <div>
        <h3 className="font-semibold text-slate-800">Tabellen</h3>
        <p className="mt-1 text-sm text-slate-600">
          Overzicht van de geconfigureerde financiële tabellen.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <SubTabs items={VIEW_ITEMS} value={view} onChange={setView} />

      {view === "herwerkte_resultatenrekening" && (
        <div
          role="group"
          aria-label="Modelgroep"
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
            Full
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

      {activeTable && (
        <div className="min-w-0 space-y-3">
          <div>
            <h4 className="font-semibold text-slate-800">
              {VIEW_ITEMS.find((item) => item.id === view)?.label}
            </h4>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <span>Gebruikt voor:</span>
              {activeTable.model_scope.map((kind) => (
                <span
                  key={kind}
                  className="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-1 text-sm font-medium text-slate-700 ring-1 ring-slate-200"
                >
                  {MODEL_LABELS[kind]}
                </span>
              ))}
            </div>
          </div>

          <EditableFinancialTable table={activeTable} editable={false} />
        </div>
      )}

      {loading && <p className="text-sm text-slate-600">Tabellen laden…</p>}
    </div>
  );
}
