import { useEffect, useId, useRef, useState } from "react";
import type { RatioResult } from "../types";
import { formatRatio } from "../utils/format";

interface RatioDashboardProps {
  ratios: RatioResult[];
  updating?: boolean;
  staleFailure?: boolean;
}

function titleCase(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

/** Split op gedeelde ' / ' zodat MAR-codes (29/58) niet verward worden met deling. */
function FormulaDisplay({ formula }: { formula: string }) {
  const parts = formula.split(" / ");
  if (parts.length === 2) {
    return (
      <div className="inline-flex flex-col items-center font-mono text-xs text-slate-600">
        <span>{parts[0]}</span>
        <span className="my-0.5 w-full border-t border-slate-300" />
        <span>{parts[1]}</span>
      </div>
    );
  }
  return <p className="font-mono text-xs text-slate-600">{formula}</p>;
}

interface RatioCardProps {
  ratio: RatioResult;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}

function RatioCard({ ratio, open, onToggle, onClose }: RatioCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (cardRef.current && !cardRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  return (
    <div
      ref={cardRef}
      className="relative rounded-lg border border-slate-100 bg-slate-50 p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-slate-500">{ratio.name}</p>
        <button
          type="button"
          aria-label="Formule"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-slate-400 ring-1 ring-slate-300 hover:bg-white hover:text-slate-600"
        >
          i
        </button>
      </div>
      <p className="mt-1 text-2xl font-semibold text-slate-900">
        {formatRatio(ratio.value, ratio.unit)}
      </p>
      {open && (
        <div
          id={panelId}
          role="tooltip"
          className="absolute right-3 top-10 z-10 rounded-md border border-slate-200 bg-white px-3 py-2 shadow-sm"
        >
          <FormulaDisplay formula={ratio.formula} />
        </div>
      )}
      {ratio.missing_codes.length > 0 && (
        <p className="mt-2 text-xs text-amber-700">
          Niet beschikbaar — ontbrekende gegevens: {ratio.missing_codes.join(", ")}
        </p>
      )}
    </div>
  );
}

/**
 * Presentational dashboard: groepeert RatioResult[] per category,
 * toont waarde (formatRatio), formule via info-knop en ontbrekende MAR-codes.
 */
export function RatioDashboard({
  ratios,
  updating = false,
  staleFailure = false,
}: RatioDashboardProps) {
  const categories = [...new Set(ratios.map((ratio) => ratio.category))];
  const [openFormulaId, setOpenFormulaId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {updating && (
        <p className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-900">
          Wordt bijgewerkt
        </p>
      )}
      {staleFailure && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          Deze waarden weerspiegelen niet de laatste sandbox-wijzigingen.
        </p>
      )}
      {categories.map((category) => (
        <div
          key={category}
          className="rounded-xl border border-slate-200 bg-white shadow-sm"
        >
          <div className="border-b border-slate-200 bg-slate-100 px-4 py-3">
            <h3 className="font-semibold text-slate-800">
              {titleCase(category)}
            </h3>
          </div>
          <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {ratios
              .filter((ratio) => ratio.category === category)
              .map((ratio) => (
                <RatioCard
                  key={ratio.id}
                  ratio={ratio}
                  open={openFormulaId === ratio.id}
                  onToggle={() =>
                    setOpenFormulaId((current) =>
                      current === ratio.id ? null : ratio.id,
                    )
                  }
                  onClose={() => setOpenFormulaId(null)}
                />
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
