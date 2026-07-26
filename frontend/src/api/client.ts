import type { AnalysisResult } from "../types";

/**
 * Upload een PDF naar POST /api/analyze.
 * FormData met veldnaam "file" (zoals FastAPI UploadFile verwacht).
 * In dev gaat /api via de Vite-proxy naar poort 8000.
 */
export async function analyzePdf(file: File): Promise<AnalysisResult> {
  const form = new FormData();
  form.append("file", file);

  const response = await fetch("/api/analyze", {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    // FastAPI zet fouten in { detail: string | object }
    const payload = await response.json().catch(() => ({}));
    const detail = payload.detail ?? `Analyse mislukt (${response.status})`;
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }

  return response.json();
}
