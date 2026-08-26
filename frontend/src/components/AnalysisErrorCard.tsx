import { useState } from "react";

interface AnalysisErrorCardProps {
  message: string;
  stageLabel?: string | null;
  detail?: string | null;
  hasPrevious: boolean;
  onRetry?: () => void;
  onUploadAnother: () => void;
}

export function AnalysisErrorCard({
  message,
  stageLabel,
  detail,
  hasPrevious,
  onRetry,
  onUploadAnother,
}: AnalysisErrorCardProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-900">
      <p className="font-medium">
        {stageLabel ? `${stageLabel}: ${message}` : message}
      </p>
      {hasPrevious && (
        <p className="mt-1 text-sm text-red-800">
          De vorige geslaagde analyse blijft beschikbaar.
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-800"
          >
            Opnieuw proberen
          </button>
        )}
        <button
          type="button"
          onClick={onUploadAnother}
          className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-red-800 ring-1 ring-red-200 hover:bg-red-100"
        >
          Andere PDF uploaden
        </button>
      </div>
      {detail && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="text-sm underline"
          >
            {open ? "Technische details verbergen" : "Technische details"}
          </button>
          {open && (
            <pre className="mt-2 overflow-auto rounded bg-white/80 p-2 text-xs text-red-900">
              {detail}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
