import { useState, type ChangeEvent } from "react";
import { analyzePdf } from "./api/client";

/** Tijdelijke test-UI voor step 12 — echte UploadZone volgt in step 13. */
function App() {
  const [status, setStatus] = useState<string | null>(null);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setStatus("Bezig met analyseren…");
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
      // Zelfde bestand opnieuw kunnen kiezen
      event.target.value = "";
    }
  }

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-semibold text-slate-800">
        Jaarrekening Analyzer
      </h1>
      <p className="mt-2 text-slate-600">
        Step 12: API-client + proxy — kies een PDF om te testen.
      </p>

      <input
        type="file"
        accept="application/pdf,.pdf"
        className="mt-6 block"
        onChange={handleFileChange}
      />

      {status && <p className="mt-4 text-sm text-slate-700">{status}</p>}
    </main>
  );
}

export default App;
