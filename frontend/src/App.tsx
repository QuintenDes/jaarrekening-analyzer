import { useEffect, useMemo, useState } from "react";
import {
  buildSourceEntries,
  findEntry,
  selectionForEntry,
} from "./analysis/sources";
import { useAnalysisSession } from "./analysis/useAnalysisSession";
import { AmountFormatToggle } from "./components/AmountFormatToggle";
import { AnalysisErrorCard } from "./components/AnalysisErrorCard";
import { PdfWorkspace } from "./components/PdfWorkspace";
import { ProcessingPanel } from "./components/ProcessingPanel";
import { RatioConfigPanel } from "./components/RatioConfigPanel";
import { RatioDashboard } from "./components/RatioDashboard";
import { SettingsPanel } from "./components/SettingsPanel";
import {
  StatementsPanel,
  type StatementViewId,
} from "./components/StatementsPanel";
import { HeaderUploadButton, UploadZone } from "./components/UploadZone";
import { ValidationPanel } from "./components/ValidationPanel";
import { WarningBanners } from "./components/WarningBanners";
import { loadAmountFormat, saveAmountFormat } from "./persistence/preferences";
import type {
  AmountFormat,
  SourceSelection,
  StatementSectionId,
  Tab,
} from "./types";

const TABS: { id: Tab; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "ratios", label: "Ratio's" },
  { id: "tables", label: "Jaarrekening" },
  { id: "pdf_scan", label: "PDF scan" },
  { id: "ratio_config", label: "Ratio-configuratie" },
  { id: "settings", label: "Instellingen" },
];

function App() {
  const session = useAnalysisSession();
  const [activeTab, setActiveTab] = useState<Tab | null>(null);
  const [amountFormat, setAmountFormat] = useState<AmountFormat>(loadAmountFormat);
  const [selection, setSelection] = useState<SourceSelection | null>(null);
  const [statementView, setStatementView] =
    useState<StatementViewId>("balans_activa");
  const [pdfReturnTo, setPdfReturnTo] = useState<Tab | null>(null);
  const [ratioView, setRatioView] = useState("liquiditeit");

  const analyzing = session.status === "analyzing";
  const showResults =
    Boolean(session.result) &&
    (session.status === "completed" ||
      session.status === "analyzing" ||
      session.status === "error");

  useEffect(() => {
    if (session.status === "completed" && session.result && activeTab === null) {
      setActiveTab("dashboard");
    }
  }, [activeTab, session.result, session.status]);

  useEffect(() => {
    saveAmountFormat(amountFormat);
  }, [amountFormat]);

  const analysisKey = useMemo(
    () => session.contentHash ?? session.pdfFile?.name ?? "none",
    [session.contentHash, session.pdfFile],
  );

  useEffect(() => {
    setSelection(null);
    setPdfReturnTo(null);
    setStatementView("balans_activa");
    setRatioView("liquiditeit");
  }, [analysisKey]);

  const hasDocument = Boolean(session.result || session.pdfFile);

  function openFilePicker() {
    const headerInput = document.getElementById(
      "header-upload-input",
    ) as HTMLInputElement | null;
    if (headerInput) {
      headerInput.click();
      return;
    }
    document.getElementById("upload-zone")?.click();
  }

  function handleStatementSelect(section: StatementSectionId, code: string) {
    if (!session.result) return;
    const entry = findEntry(buildSourceEntries(session.result), section, code);
    if (entry) {
      setSelection(selectionForEntry(entry));
    } else {
      setSelection({
        section,
        code,
        occurrenceIndex: 0,
        page: 0,
      });
    }
  }

  function handleJumpToPdf() {
    if (!selection) return;
    setPdfReturnTo("tables");
    setActiveTab("pdf_scan");
  }

  function handleSourceSelection(next: SourceSelection) {
    setSelection(next);
  }

  const readOnly = session.stale || analyzing;

  return (
    <div
      className={
        activeTab === "pdf_scan" && showResults
          ? "flex h-screen w-full flex-col overflow-hidden"
          : "min-h-screen"
      }
    >
      <header className="shrink-0 border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-3 px-4 py-6">
          <h1 className="text-2xl font-bold text-slate-900">
            Jaarrekening Analyzer
          </h1>
          {(hasDocument || showResults) && (
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <HeaderUploadButton onFile={session.startAnalysis} />
              {showResults && (
                <AmountFormatToggle
                  value={amountFormat}
                  onChange={setAmountFormat}
                />
              )}
            </div>
          )}
        </div>
      </header>

      <main
        className={`mx-auto w-full min-w-0 max-w-6xl px-4 py-8 ${
          activeTab === "pdf_scan" && showResults
            ? "flex min-h-0 flex-1 flex-col gap-6 overflow-hidden"
            : "space-y-6"
        }`}
      >
        {!hasDocument && (
          <UploadZone onFile={session.startAnalysis} loading={analyzing} />
        )}

        {session.cancelMessage && session.status === "canceled" && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {session.cancelMessage}
          </div>
        )}

        {analyzing && (
          <ProcessingPanel
            job={session.job}
            onCancel={() => void session.cancelAnalysis()}
          />
        )}

        {session.status === "error" && (
          <AnalysisErrorCard
            message={session.error ?? "Analyse mislukt."}
            stageLabel={session.errorStageLabel}
            detail={session.errorDetail}
            hasPrevious={Boolean(session.result)}
            onRetry={session.pdfFile ? session.retryAnalysis : undefined}
            onUploadAnother={openFilePicker}
          />
        )}

        {session.stale && session.result && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
            Vorige analyse (alleen-lezen) — nieuwe analyse loopt.
          </div>
        )}

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {TABS.filter(
            (tab) =>
              tab.id === "settings" ||
              tab.id === "ratio_config" ||
              showResults,
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                if (tab.id !== "pdf_scan") {
                  setPdfReturnTo(null);
                }
                setActiveTab(tab.id);
              }}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.id
                  ? "bg-emerald-600 text-white"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
          {showResults && session.result?.schema_format && (
            <div className="ml-auto inline-flex items-center rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200">
              Model: {session.result.schema_format}
            </div>
          )}
        </div>

        {activeTab === "settings" && (
          <SettingsPanel
            amountFormat={amountFormat}
            onAmountFormatChange={setAmountFormat}
          />
        )}

        {activeTab === "ratio_config" && (
          <RatioConfigPanel
            onLiveConfigApplied={() => {
              session.refreshLiveRatios();
            }}
          />
        )}

        {showResults && session.result && (
          <div
            className={
              activeTab === "pdf_scan"
                ? "flex min-h-0 w-full min-w-0 flex-1 flex-col gap-6 overflow-hidden"
                : "contents"
            }
          >
            {session.recomputeError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                Herberekening mislukt: {session.recomputeError}
              </div>
            )}

            {activeTab !== "settings" &&
              activeTab !== "ratio_config" && (
              <WarningBanners warnings={session.result.warnings} />
            )}

            {activeTab === "pdf_scan" &&
              (session.pdfUrl ? (
                <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
                <PdfWorkspace
                  pdfUrl={session.pdfUrl}
                  result={session.result}
                  amountFormat={amountFormat}
                  selection={selection}
                  onSelectionChange={handleSourceSelection}
                  analysisKey={analysisKey}
                  onBack={
                    pdfReturnTo
                      ? () => {
                          setActiveTab(pdfReturnTo);
                          setPdfReturnTo(null);
                        }
                      : undefined
                  }
                  backLabel={
                    pdfReturnTo === "tables" ? "Terug naar jaarrekening" : "Terug"
                  }
                />
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <p>PDF ontbreekt voor deze analyse.</p>
                  <button
                    type="button"
                    onClick={openFilePicker}
                    className="mt-3 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
                  >
                    Kies opnieuw dezelfde PDF
                  </button>
                </div>
              ))}

            {activeTab === "tables" && (
              <StatementsPanel
                key={analysisKey}
                result={session.result}
                amountFormat={amountFormat}
                selection={selection}
                onSelectRow={handleStatementSelect}
                onJumpToPdf={handleJumpToPdf}
                readOnly={readOnly}
                view={statementView}
                onViewChange={setStatementView}
              />
            )}
            {activeTab === "dashboard" && (
              <RatioDashboard
                key={`${analysisKey}-overview`}
                mode="overview"
                companyName={session.result.company_name}
                result={session.result}
                ratios={session.displayedRatios}
                amountFormat={amountFormat}
                updating={session.recomputeState === "updating"}
                staleFailure={session.recomputeState === "failed"}
                onViewAll={(category) => {
                  setRatioView(category);
                  setActiveTab("ratios");
                }}
              />
            )}
            {activeTab === "ratios" && (
              <div className="space-y-6">
                <RatioDashboard
                  key={`${analysisKey}-categories`}
                  mode="categories"
                  result={session.result}
                  ratios={session.displayedRatios}
                  amountFormat={amountFormat}
                  updating={session.recomputeState === "updating"}
                  staleFailure={session.recomputeState === "failed"}
                  view={ratioView}
                  onViewChange={setRatioView}
                />
                <ValidationPanel validations={session.displayedValidations} />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
