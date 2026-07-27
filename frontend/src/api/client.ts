import type { AnalysisResult, RatioSpec } from "../types";

async function readError(response: Response): Promise<string> {
  const payload = await response.json().catch(() => ({}));
  const detail = payload.detail ?? `Verzoek mislukt (${response.status})`;
  return typeof detail === "string" ? detail : JSON.stringify(detail);
}

/**
 * Upload een PDF naar POST /api/analyze.
 * FormData met veldnaam "file" (zoals FastAPI UploadFile verwacht).
 * Optioneel: ratios JSON-array als sandbox-override.
 */
export async function analyzePdf(
  file: File,
  ratios?: RatioSpec[],
): Promise<AnalysisResult> {
  const form = new FormData();
  form.append("file", file);
  if (ratios && ratios.length > 0) {
    form.append("ratios", JSON.stringify(ratios));
  }

  const response = await fetch("/api/analyze", {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return response.json();
}

/** Read-only defaults van de server (ratios.yaml). */
export async function getRatiosConfig(): Promise<RatioSpec[]> {
  const response = await fetch("/api/ratios");
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  const data = (await response.json()) as { ratios: RatioSpec[] };
  return data.ratios;
}

/** Parse YAML-tekst naar gevalideerde ratio-specs (geen schijfschrijven). */
export async function parseRatiosYaml(yamlText: string): Promise<RatioSpec[]> {
  const response = await fetch("/api/ratios/parse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ yaml: yamlText }),
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  const data = (await response.json()) as { ratios: RatioSpec[] };
  return data.ratios;
}
