import type { AmountFormat } from "../types";

interface AmountFormatToggleProps {
  value: AmountFormat;
  onChange: (value: AmountFormat) => void;
}

export function AmountFormatToggle({ value, onChange }: AmountFormatToggleProps) {
  return (
    <div
      role="group"
      aria-label="Bedragweergave"
      className="inline-flex overflow-hidden rounded-lg ring-1 ring-slate-200"
    >
      <button
        type="button"
        onClick={() => onChange("full")}
        className={`px-3 py-1.5 text-sm font-medium ${
          value === "full"
            ? "bg-slate-800 text-white"
            : "bg-white text-slate-600 hover:bg-slate-50"
        }`}
      >
        Volledig
      </button>
      <button
        type="button"
        onClick={() => onChange("compact")}
        className={`px-3 py-1.5 text-sm font-medium ${
          value === "compact"
            ? "bg-slate-800 text-white"
            : "bg-white text-slate-600 hover:bg-slate-50"
        }`}
      >
        Compact
      </button>
    </div>
  );
}
