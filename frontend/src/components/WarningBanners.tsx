import { useState } from "react";

interface WarningBannersProps {
  warnings: string[];
}

export function WarningBanners({ warnings }: WarningBannersProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  if (warnings.length === 0) return null;

  return (
    <div className="space-y-2">
      {warnings.map((warning) => {
        const important =
          /balans|resultatenrekening|acti|passi/i.test(warning) &&
          /geen|ontbreek|niet/i.test(warning);
        if (!important && dismissed.has(warning)) return null;
        return (
          <div
            key={warning}
            className="flex items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900"
          >
            <p>{warning}</p>
            {!important && (
              <button
                type="button"
                className="shrink-0 text-xs underline"
                onClick={() =>
                  setDismissed((current) => new Set(current).add(warning))
                }
              >
                Verbergen
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
