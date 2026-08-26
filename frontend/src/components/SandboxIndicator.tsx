import { useMemo, useState } from "react";
import type { RatioSpec } from "../types";

interface SandboxIndicatorProps {
  enabled: boolean;
  draft: RatioSpec[];
  defaults: RatioSpec[] | null;
  onOpenSandbox: () => void;
}

function specsDiffer(a: RatioSpec[], b: RatioSpec[]): boolean {
  return JSON.stringify(a) !== JSON.stringify(b);
}

export function SandboxIndicator({
  enabled,
  draft,
  defaults,
  onOpenSandbox,
}: SandboxIndicatorProps) {
  const [open, setOpen] = useState(false);

  const modified = useMemo(() => {
    if (!defaults || defaults.length === 0) {
      return draft.map((spec) => spec.name || spec.id);
    }
    const defaultById = new Map(defaults.map((spec) => [spec.id, spec]));
    return draft
      .filter((spec) => {
        const original = defaultById.get(spec.id);
        if (!original) return true;
        return specsDiffer([spec], [original]);
      })
      .map((spec) => spec.name || spec.id);
  }, [defaults, draft]);

  if (!enabled) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        onMouseEnter={() => setOpen(true)}
        className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900 ring-1 ring-amber-200"
      >
        Sandbox actief
        {modified.length > 0 ? ` · ${modified.length}` : ""}
      </button>
      {open && (
        <div
          className="absolute left-0 z-20 mt-2 w-72 rounded-lg border border-amber-200 bg-white p-3 text-sm text-slate-800 shadow-sm"
          onMouseLeave={() => setOpen(false)}
        >
          <p className="font-medium text-amber-950">
            {modified.length} aangepaste ratio
            {modified.length === 1 ? "" : "'s"}
          </p>
          {modified.length > 0 ? (
            <ul className="mt-2 max-h-40 list-disc space-y-1 overflow-auto pl-4 text-xs text-slate-700">
              {modified.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-xs text-slate-600">
              Standaarddefinities, sandbox staat aan.
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onOpenSandbox();
            }}
            className="mt-3 rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-800"
          >
            Open sandbox
          </button>
        </div>
      )}
    </div>
  );
}
