import type {
  AnalysisResult,
  AnalyzeJobCreated,
  AnalyzeJobStatus,
  RatioComputeResponse,
  RatioSpec,
  StatementLine,
} from "../types";

async function readError(response: Response): Promise<string> {
  const payload = await response.json().catch(() => ({}));
  const detail = payload.detail ?? `Verzoek mislukt (${response.status})`;
  return typeof detail === "string" ? detail : JSON.stringify(detail);
}

function appendRatios(form: FormData, ratios?: RatioSpec[]) {
  if (ratios && ratios.length > 0) {
    form.append("ratios", JSON.stringify(ratios));
  }
}

/** Start een asynchrone analysejob. */
export async function startAnalyzeJob(
  file: File,
  ratios?: RatioSpec[],
): Promise<AnalyzeJobCreated> {
  const form = new FormData();
  form.append("file", file);
  appendRatios(form, ratios);

  const response = await fetch("/api/analyze/jobs", {
    method: "POST",
    body: form,
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return response.json();
}

export async function getAnalyzeJob(jobId: string): Promise<AnalyzeJobStatus> {
  const response = await fetch(`/api/analyze/jobs/${jobId}`);
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return response.json();
}

export async function cancelAnalyzeJob(jobId: string): Promise<AnalyzeJobStatus> {
  const response = await fetch(`/api/analyze/jobs/${jobId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return response.json();
}

/** Upload een PDF naar POST /api/analyze (synchrone fallback / tests). */
export async function analyzePdf(
  file: File,
  ratios?: RatioSpec[],
): Promise<AnalysisResult> {
  const form = new FormData();
  form.append("file", file);
  appendRatios(form, ratios);

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

export async function computeRatios(payload: {
  balance_assets: StatementLine[];
  balance_liabilities: StatementLine[];
  income_statement: StatementLine[];
  ratios?: RatioSpec[];
}): Promise<RatioComputeResponse> {
  const response = await fetch("/api/ratios/compute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return response.json();
}
