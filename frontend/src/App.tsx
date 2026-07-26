import { useState } from "react";
import { analyzePdf } from "./api/client";
import { RatioDashboard } from "./components/RatioDashboard";
import { StatementTable } from "./components/StatementTable";
import { UploadZone } from "./components/UploadZone";
import type { AnalysisResult } from "./types";

type Tab = "balans_activa" | "balans_passiva" | "resultaten" | "ratios";

const TABS: { id: Tab; label: string }[] = [
  { id: "balans_activa", label: "Balans activa" },
  { id: "balans_passiva", label: "Balans passiva" },
  { id: "resultaten", label: "Resultatenrekening" },
  { id: "ratios", label: "Ratio's" },
];

/**
 * Enige orchestrator-component:
 * - result / loading / error / activeTab state
 * - sessionStorage cache zodat refresh de laatste analyse behoudt
 * - na succesvolle upload → tab "ratios" openen
 */
function App() {
  // Init uit sessionStorage (zelfde tab-sessie, geen database)
  const [result, setResult] = useState<AnalysisResult | null>(() => {
    const cached = sessionStorage.getItem("analysisResult");
    return cached ? (JSON.parse(cached) as AnalysisResult) : null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("balans_activa");

  async function handleUpload(file: File) {
    setLoading(true);
    setError(null);
    try {
      const data = await analyzePdf(file);
      setResult(data);
      sessionStorage.setItem("analysisResult", JSON.stringify(data));
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
        <div className="mx-auto max-w-6xl px-4 py-6">
          <h1 className="text-2xl font-bold text-slate-900">
            Jaarrekening Analyzer
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <UploadZone onFile={handleUpload} loading={loading} />

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800">
            {error}
          </div>
        )}

        {result && (
          <>
            {result.warnings.length > 0 && (
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

            <div className="flex flex-wrap gap-2">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                    activeTab === tab.id
                      ? "bg-emerald-600 text-white"
                      : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === "balans_activa" && (
              <StatementTable
                title="Balans — Activa"
                lines={result.balance_assets}
              />
            )}
            {activeTab === "balans_passiva" && (
              <StatementTable
                title="Balans — Passiva"
                lines={result.balance_liabilities}
              />
            )}
            {activeTab === "resultaten" && (
              <StatementTable
                title="Resultatenrekening"
                lines={result.income_statement}
              />
            )}
            {activeTab === "ratios" && (
              <RatioDashboard ratios={result.ratios} />
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
