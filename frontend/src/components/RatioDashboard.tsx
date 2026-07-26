import type { RatioResult } from "../types";
import { formatRatio } from "../utils/format";

interface RatioDashboardProps {
  ratios: RatioResult[];
}

/** Groepeer ratio's per category uit ratios.yaml (liquiditeit / solvabiliteit / …). */
const CATEGORY_LABELS: Record<string, string> = {
  liquiditeit: "Liquiditeit",
  solvabiliteit: "Solvabiliteit",
  rentabiliteit: "Rentabiliteit",
  overig: "Overig",
};

/**
 * Presentational dashboard: groepeert RatioResult[] per category,
 * toont waarde (formatRatio), formule en ontbrekende MAR-codes.
 */
export function RatioDashboard({ ratios }: RatioDashboardProps) {
  const categories = [...new Set(ratios.map((ratio) => ratio.category))];

  return (
    <div className="space-y-6">
      {categories.map((category) => (
        <div
          key={category}
          className="rounded-xl border border-slate-200 bg-white shadow-sm"
        >
          <div className="border-b border-slate-200 bg-slate-100 px-4 py-3">
            <h3 className="font-semibold text-slate-800">
              {CATEGORY_LABELS[category] ?? category}
            </h3>
          </div>
          <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {ratios
              .filter((ratio) => ratio.category === category)
              .map((ratio) => (
                <div
                  key={ratio.id}
                  className="rounded-lg border border-slate-100 bg-slate-50 p-4"
                >
                  <p className="text-sm text-slate-500">{ratio.name}</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900">
                    {formatRatio(ratio.value, ratio.unit)}
                  </p>
                  <p className="mt-2 font-mono text-xs text-slate-400">
                    {ratio.formula}
                  </p>
                  {ratio.missing_codes.length > 0 && (
                    <p className="mt-2 text-xs text-amber-700">
                      Ontbrekend: {ratio.missing_codes.join(", ")}
                    </p>
                  )}
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
