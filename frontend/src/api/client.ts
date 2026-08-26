import type {
  AnalysisResult,
  AnalyzeJobCreated,
  AnalyzeJobStatus,
  RatioComputeResponse,
  RatioHistoryEntry,
  RatioSpec,
  RatiosConfigMeta,
  StatementLine,
} from "../types";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function readError(response: Response): Promise<string> {
  const payload = await response.json().catch(() => ({}));
  const detail = payload.detail ?? `Verzoek mislukt (${response.status})`;
  return typeof detail === "string" ? detail : JSON.stringify(detail);
}

async function throwIfNotOk(response: Response): Promise<void> {
  if (!response.ok) {
    throw new ApiError(await readError(response), response.status);
  }
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
  await throwIfNotOk(response);
  return response.json();
}

export async function getAnalyzeJob(jobId: string): Promise<AnalyzeJobStatus> {
  const response = await fetch(`/api/analyze/jobs/${jobId}`);
  await throwIfNotOk(response);
  return response.json();
}

export async function cancelAnalyzeJob(jobId: string): Promise<AnalyzeJobStatus> {
  const response = await fetch(`/api/analyze/jobs/${jobId}`, {
    method: "DELETE",
  });
  await throwIfNotOk(response);
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
  await throwIfNotOk(response);
  return response.json();
}

export async function getRatiosConfig(): Promise<RatioSpec[]> {
  const data = await getRatiosConfigMeta();
  return data.ratios;
}

function asConfigMeta(data: {
  ratios: RatioSpec[];
  source?: "bundled" | "saved";
  version?: number;
  updated_at?: string | null;
  dashboard_ratio_count?: number;
  categories?: string[];
  dashboard_key_ids?: Record<string, string[]>;
}): RatiosConfigMeta {
  const count = data.dashboard_ratio_count;
  return {
    ratios: data.ratios,
    source: data.source === "saved" ? "saved" : "bundled",
    version: typeof data.version === "number" ? data.version : 1,
    updated_at: data.updated_at ?? null,
    dashboard_ratio_count:
      typeof count === "number" && Number.isFinite(count) && count >= 1
        ? Math.floor(count)
        : 3,
    categories: Array.isArray(data.categories)
      ? data.categories.filter((item): item is string => typeof item === "string")
      : [],
    dashboard_key_ids:
      data.dashboard_key_ids && typeof data.dashboard_key_ids === "object"
        ? data.dashboard_key_ids
        : {},
  };
}

export async function getRatiosConfigMeta(): Promise<RatiosConfigMeta> {
  const response = await fetch("/api/ratios");
  await throwIfNotOk(response);
  return asConfigMeta(await response.json());
}

export async function saveRatiosConfig(
  ratios: RatioSpec[],
  adminToken: string,
  version: number,
  extras?: {
    dashboard_ratio_count?: number;
    categories?: string[];
    dashboard_key_ids?: Record<string, string[]>;
  },
): Promise<RatiosConfigMeta> {
  const response = await fetch("/api/ratios", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Token": adminToken,
    },
    body: JSON.stringify({
      ratios,
      version,
      dashboard_ratio_count: extras?.dashboard_ratio_count,
      categories: extras?.categories,
      dashboard_key_ids: extras?.dashboard_key_ids,
    }),
  });
  await throwIfNotOk(response);
  return asConfigMeta(await response.json());
}

export async function resetRatiosConfig(
  adminToken: string,
): Promise<RatiosConfigMeta> {
  const response = await fetch("/api/ratios/reset", {
    method: "POST",
    headers: { "X-Admin-Token": adminToken },
  });
  await throwIfNotOk(response);
  return asConfigMeta(await response.json());
}

export async function getRatiosHistory(): Promise<RatioHistoryEntry[]> {
  const response = await fetch("/api/ratios/history");
  await throwIfNotOk(response);
  const data = (await response.json()) as { items?: RatioHistoryEntry[] };
  return data.items ?? [];
}

export async function restoreRatiosHistory(
  version: number,
  adminToken: string,
): Promise<RatiosConfigMeta> {
  const response = await fetch(`/api/ratios/history/${version}/restore`, {
    method: "POST",
    headers: { "X-Admin-Token": adminToken },
  });
  await throwIfNotOk(response);
  return asConfigMeta(await response.json());
}

/** Parse YAML-tekst naar gevalideerde ratio-config (geen schijfschrijven). */
export async function parseRatiosYaml(yamlText: string): Promise<RatiosConfigMeta> {
  const response = await fetch("/api/ratios/parse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ yaml: yamlText }),
  });
  await throwIfNotOk(response);
  return asConfigMeta(await response.json());
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
  await throwIfNotOk(response);
  return response.json();
}
