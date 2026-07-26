import { useState } from "react";
import { analyzePdf } from "./api/client";
import { StatementTable } from "./components/StatementTable";
import { UploadZone } from "./components/UploadZone";
import type { StatementLine } from "./types";

/** Mock data om StatementTable te verifiëren (echte API-data in step 16). */
const MOCK_LINES: StatementLine[] = [
  {
    section: "resultatenrekening",
    label: "Omzet",
    footnote: "",
    code: "70",
    current: 4_254_284_170,
    previous: 7_467_200_746,
  },
  {
    section: "resultatenrekening",
    label: "Handelsgoederen, grond- en hulpstoffen",
    footnote: "",
    code: "60",
    current: -3_000_000_000,
    previous: -5_000_000_000,
  },
];

/** Step 14: StatementTable met mock-regels; upload blijft voor API-smoke-test. */
function App() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleFile(file: File) {
    setLoading(true);
    setStatus(null);
    try {
      const result = await analyzePdf(file);
      console.log("AnalysisResult", result);
      setStatus(
        `OK — ${result.ratios.length} ratio's, ${result.balance_assets.length} activa-regels (zie console)`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(message);
      setStatus(`Fout: ${message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-4xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">
          Jaarrekening Analyzer
        </h1>
        <p className="mt-2 text-slate-600">
          Step 14: StatementTable met mock-data onderaan.
        </p>
      </div>

      <UploadZone onFile={handleFile} loading={loading} />

      {status && <p className="text-sm text-slate-700">{status}</p>}

      <StatementTable title="Resultatenrekening (mock)" lines={MOCK_LINES} />
    </main>
  );
}

export default App;
