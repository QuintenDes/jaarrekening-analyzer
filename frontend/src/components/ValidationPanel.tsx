import { useState } from "react";

interface ValidationPanelProps {
  validations: string[];
}

export function ValidationPanel({ validations }: ValidationPanelProps) {
  if (validations.length === 0) return null;

  return (
    <div className="space-y-2">
      {validations.map((message) => {
        const warning = message.includes("WAARSCHUWING") || message.includes("≠");
        return (
          <ValidationItem key={message} message={message} warning={warning} />
        );
      })}
    </div>
  );
}

function ValidationItem({ message, warning }: { message: string; warning: boolean }) {
  const [open, setOpen] = useState(false);
  const title = warning
    ? "Balansverschil (waarschuwing)"
    : "Balanscontrole";
  const explanation = warning
    ? "Activa en passiva komen niet overeen. De analyse blijft bruikbaar; controleer de bronregels in de PDF."
    : "Activa en passiva komen overeen voor het huidige boekjaar.";

  return (
    <div
      className={`rounded-lg border px-4 py-2 text-sm ${
        warning
          ? "border-amber-200 bg-amber-50 text-amber-900"
          : "border-emerald-200 bg-emerald-50 text-emerald-900"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{title}</p>
          <p className="mt-0.5">{message}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="shrink-0 text-xs underline"
        >
          {open ? "Minder" : "Toelichting"}
        </button>
      </div>
      {open && <p className="mt-2 text-xs opacity-90">{explanation}</p>}
    </div>
  );
}
