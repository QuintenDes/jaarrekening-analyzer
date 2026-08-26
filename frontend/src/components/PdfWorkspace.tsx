import { useEffect, useMemo, useState } from "react";
import { buildSourceEntries } from "../analysis/sources";
import type {
  AnalysisResult,
  AmountFormat,
  ScanHighlight,
  SourceSelection,
} from "../types";
import { PdfHighlightViewer } from "./PdfHighlightViewer";
import { SourcePanel } from "./SourcePanel";

interface PdfWorkspaceProps {
  pdfUrl: string;
  result: AnalysisResult;
  amountFormat: AmountFormat;
  selection: SourceSelection | null;
  onSelectionChange: (selection: SourceSelection) => void;
  analysisKey: string;
  onBack?: () => void;
  backLabel?: string;
}

export function PdfWorkspace({
  pdfUrl,
  result,
  amountFormat,
  selection,
  onSelectionChange,
  analysisKey,
  onBack,
  backLabel,
}: PdfWorkspaceProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const entries = useMemo(() => buildSourceEntries(result), [result]);

  useEffect(() => {
    setCollapsed(false);
    setDrawerOpen(false);
  }, [analysisKey]);

  function selectFromHighlight(highlight: ScanHighlight, occurrenceIndex: number) {
    onSelectionChange({
      section: highlight.section as SourceSelection["section"],
      code: highlight.code,
      occurrenceIndex,
      page: highlight.page,
    });
  }

  const panel = (
    <SourcePanel
      entries={entries}
      selection={selection}
      amountFormat={amountFormat}
      onSelect={(next) => {
        onSelectionChange(next);
        setDrawerOpen(false);
      }}
    />
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">PDF scan</h2>
        <div className="flex gap-2">
          {onBack && (
            <button
              type="button"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-50"
              onClick={onBack}
            >
              {backLabel ?? "Terug"}
            </button>
          )}
          <button
            type="button"
            className="hidden rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 lg:inline-flex"
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed ? "Toon bronnen" : "Verberg bronnen"}
          </button>
          <button
            type="button"
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 lg:hidden"
            onClick={() => setDrawerOpen(true)}
          >
            Bronnen
          </button>
        </div>
      </div>

      <div
        className={`grid min-h-[32rem] gap-3 ${
          collapsed ? "lg:grid-cols-1" : "lg:grid-cols-[minmax(0,1.7fr)_minmax(16rem,0.85fr)]"
        }`}
      >
        <PdfHighlightViewer
          pdfUrl={pdfUrl}
          highlights={result.highlights ?? []}
          pageSizes={result.page_sizes ?? []}
          pageCount={result.page_count ?? null}
          selection={selection}
          onSelectHighlight={selectFromHighlight}
          onBack={onBack}
          backLabel={backLabel}
        />
        {!collapsed && (
          <div className="hidden min-h-0 overflow-hidden rounded-lg border border-slate-200 lg:block">
            {panel}
          </div>
        )}
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            aria-label="Sluit bronnen"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 right-0 w-[min(100%,22rem)] border-l border-slate-200 bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
              <span className="text-sm font-semibold">Bronnen</span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="text-sm text-slate-600"
              >
                Sluiten
              </button>
            </div>
            <div className="h-[calc(100%-3rem)]">{panel}</div>
          </div>
        </div>
      )}
    </div>
  );
}
