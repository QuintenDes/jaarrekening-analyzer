import type { AmountFormat } from "../types";
import { AmountFormatToggle } from "./AmountFormatToggle";

interface SettingsPanelProps {
  amountFormat: AmountFormat;
  onAmountFormatChange: (value: AmountFormat) => void;
}

export function SettingsPanel({
  amountFormat,
  onAmountFormatChange,
}: SettingsPanelProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="font-semibold text-slate-800">Instellingen</h3>
      <p className="mt-1 text-sm text-slate-600">
        Deze voorkeuren blijven bewaard in deze browser.
      </p>
      <div className="mt-4">
        <p className="text-sm font-medium text-slate-800">Bedragweergave</p>
        <p className="mb-2 text-sm text-slate-500">
          Onderliggende waarden wijzigen niet. Standaard: volledige gehele euro’s.
        </p>
        <AmountFormatToggle value={amountFormat} onChange={onAmountFormatChange} />
      </div>
    </div>
  );
}
