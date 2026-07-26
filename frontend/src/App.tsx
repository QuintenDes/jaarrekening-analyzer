import { useState } from "react";
import { analyzePdf } from "./api/client";
import { UploadZone } from "./components/UploadZone";

/** Step 13: UploadZone wired; tables/ratios volgen later. */
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
    <main className="mx-auto min-h-screen max-w-3xl p-8">
      <h1 className="text-2xl font-semibold text-slate-800">
        Jaarrekening Analyzer
      </h1>
      <p className="mt-2 text-slate-600">
        Step 13: UploadZone — kies een PDF om te testen.
      </p>

      <div className="mt-6">
        <UploadZone onFile={handleFile} loading={loading} />
      </div>

      {status && <p className="mt-4 text-sm text-slate-700">{status}</p>}
    </main>
  );
}

export default App;
