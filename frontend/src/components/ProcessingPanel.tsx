import type { AnalyzeJobStatus } from "../types";

const FALLBACK_STAGES = [
  { id: "validate_pdf", label: "PDF controleren" },
  { id: "extract", label: "Financiële gegevens extraheren" },
  { id: "aggregate", label: "Gegevens verwerken" },
  { id: "ratios", label: "Ratio's berekenen" },
  { id: "finalize", label: "Analyse afronden" },
];

interface ProcessingPanelProps {
  job: AnalyzeJobStatus | null;
  onCancel: () => void;
}

export function ProcessingPanel({ job, onCancel }: ProcessingPanelProps) {
  const stages =
    job?.stage_order?.length && job.stage_labels
      ? job.stage_order.map((id) => ({
          id,
          label: job.stage_labels[id] ?? id,
        }))
      : FALLBACK_STAGES;

  const completed = new Set(job?.completed_stages ?? []);
  const current = job?.current_stage ?? null;
  const failed = job?.status === "error" ? job.error_stage : null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Analyse bezig</h2>
          <p className="mt-1 text-sm text-slate-600">
            {job?.current_stage_label ?? "Verwerken…"}
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
        >
          Annuleren
        </button>
      </div>
      <ol className="mt-4 space-y-2">
        {stages.map((stage) => {
          const isDone = completed.has(stage.id);
          const isCurrent = current === stage.id && !isDone;
          const isFailed = failed === stage.id;
          return (
            <li
              key={stage.id}
              className={`flex items-center gap-2 text-sm ${
                isFailed
                  ? "font-medium text-red-700"
                  : isDone
                    ? "text-emerald-800"
                    : isCurrent
                      ? "font-medium text-slate-900"
                      : "text-slate-400"
              }`}
            >
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  isFailed
                    ? "bg-red-500"
                    : isDone
                      ? "bg-emerald-500"
                      : isCurrent
                        ? "bg-emerald-600"
                        : "bg-slate-300"
                }`}
              />
              {stage.label}
              {isFailed ? " — mislukt" : isDone ? " — klaar" : isCurrent ? " — bezig" : ""}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
