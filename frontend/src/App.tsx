import { useEffect, useRef, useState } from "react";
import { analyzePdf } from "./api/client";
import { PdfHighlightViewer } from "./components/PdfHighlightViewer";
import { RatioDashboard } from "./components/RatioDashboard";
import {
  loadSandboxDraft,
  loadSandboxEnabled,
  RatioSandbox,
  SANDBOX_DRAFT_KEY,
  SANDBOX_ENABLED_KEY,
} from "./components/RatioSandbox";
import { StatementTable } from "./components/StatementTable";
import { UploadZone } from "./components/UploadZone";
import type { AnalysisResult, RatioSpec } from "./types";

type Tab =
  | "pdf_scan"
  | "balans_activa"
  | "balans_passiva"
  | "resultaten"
  | "resultaatverwerking"
  | "ratios"
  | "sandbox";

const TABS: { id: Tab; label: string }[] = [
  { id: "ratios", label: "Ratio's" },
  { id: "sandbox", label: "Sandbox" },
  { id: "balans_activa", label: "Balans activa" },
  { id: "balans_passiva", label: "Balans passiva" },
  { id: "resultaten", label: "Resultatenrekening" },
  { id: "resultaatverwerking", label: "Resultaatverwerking" },
  { id: "pdf_scan", label: "PDF scan" },
];

const ANALYSIS_CACHE_KEY = "analysisResult";

function loadCachedAnalysis(): AnalysisResult | null {
  const cached = sessionStorage.getItem(ANALYSIS_CACHE_KEY);
  if (!cached) return null;
  try {
    return JSON.parse(cached) as AnalysisResult;
  } catch {
    sessionStorage.removeItem(ANALYSIS_CACHE_KEY);
    return null;
  }
}

/**
 * Enige orchestrator-component:
 * - result / loading / error / activeTab state
 * - sessionStorage cache zodat refresh de laatste analyse behoudt
 * - PDF blob URL alleen in geheugen (niet in sessionStorage)
 * - ratio sandbox: draft + enabled in sessionStorage, nooit server-write
 */
function App() {
  const [result, setResult] = useState<AnalysisResult | null>(loadCachedAnalysis);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab | null>(() =>
    result ? "ratios" : null,
  );
  const [sandboxEnabled, setSandboxEnabled] = useState(loadSandboxEnabled);
  const [sandboxDraft, setSandboxDraft] = useState<RatioSpec[]>(
    () => loadSandboxDraft() ?? [],
  );
  const uploadSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  useEffect(() => {
    sessionStorage.setItem(SANDBOX_ENABLED_KEY, sandboxEnabled ? "1" : "0");
  }, [sandboxEnabled]);

  useEffect(() => {
    if (sandboxDraft.length > 0) {
      sessionStorage.setItem(SANDBOX_DRAFT_KEY, JSON.stringify(sandboxDraft));
    }
  }, [sandboxDraft]);

  function focusUploadZone() {
    uploadSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    document.getElementById("upload-zone")?.focus();
  }

  async function handleUpload(file: File) {
    setLoading(true);
    setError(null);
    try {
      const override =
        sandboxEnabled && sandboxDraft.length > 0 ? sandboxDraft : undefined;
      const data = await analyzePdf(file, override);
      setResult(data);
      sessionStorage.setItem(ANALYSIS_CACHE_KEY, JSON.stringify(data));

      setPdfUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return URL.createObjectURL(file);
      });
      setActiveTab("ratios");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onbekende fout");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-6">
          <h1 className="text-2xl font-bold text-slate-900">
            Jaarrekening Analyzer
          </h1>
          {sandboxEnabled && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900 ring-1 ring-amber-200">
              Sandbox actief
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <div ref={uploadSectionRef}>
          <UploadZone onFile={handleUpload} loading={loading} />
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {TABS.filter((tab) => tab.id === "sandbox" || result).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                if (tab.id === "sandbox" && activeTab === "sandbox") {
                  setActiveTab(result ? "ratios" : null);
                  return;
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
          {result?.schema_format && (
            <div className="ml-auto inline-flex items-center rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200">
              Model: {result.schema_format}
            </div>
          )}
        </div>

        {activeTab === "sandbox" && (
          <RatioSandbox
            enabled={sandboxEnabled}
            onEnabledChange={setSandboxEnabled}
            draft={sandboxDraft}
            onDraftChange={setSandboxDraft}
          />
        )}

        {result && (
          <>
            {result.warnings.length > 0 && activeTab !== "sandbox" && (
              <div className="space-y-2">
                {result.warnings.map((warning) => (
                  <div
                    key={warning}
                    className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900"
                  >
                    {warning}
                  </div>
                ))}
              </div>
            )}

            {activeTab === "pdf_scan" &&
              (pdfUrl ? (
                <PdfHighlightViewer
                  pdfUrl={pdfUrl}
                  highlights={result.highlights ?? []}
                  pageSizes={result.page_sizes ?? []}
                  pageCount={result.page_count ?? null}
                />
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <p>
                    De analyse blijft bewaard na een refresh, maar het PDF-bestand
                    zelf niet (privacy / geheugen).
                  </p>
                  <button
                    type="button"
                    onClick={focusUploadZone}
                    className="mt-3 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
                  >
                    Kies opnieuw dezelfde PDF hierboven
                  </button>
                </div>
              ))}

            {activeTab === "balans_activa" && (
              <StatementTable
                title="Balans activa"
                lines={result.balance_assets}
              />
            )}
            {activeTab === "balans_passiva" && (
              <StatementTable
                title="Balans passiva"
                lines={result.balance_liabilities}
              />
            )}
            {activeTab === "resultaten" && (
              <StatementTable
                title="Resultatenrekening"
                lines={result.income_statement}
              />
            )}
            {activeTab === "resultaatverwerking" && (
              <StatementTable
                title="Resultaatverwerking"
                lines={result.appropriation_of_result ?? []}
              />
            )}
            {activeTab === "ratios" && (
              <div className="space-y-6">
                {(result.validations ?? []).length > 0 && (
                  <div className="space-y-2">
                    {result.validations.map((message) => {
                      const warning = message.includes("WAARSCHUWING");
                      return (
                        <div
                          key={message}
                          className={`rounded-lg border px-4 py-2 text-sm ${
                            warning
                              ? "border-amber-200 bg-amber-50 text-amber-900"
                              : "border-emerald-200 bg-emerald-50 text-emerald-900"
                          }`}
                        >
                          {message}
                        </div>
                      );
                    })}
                  </div>
                )}
                <RatioDashboard ratios={result.ratios} />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
