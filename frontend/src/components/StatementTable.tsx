import { useEffect, useRef } from "react";
import { cleanStatementLabel } from "../i18n/marLabels";
import type { AmountFormat, StatementLine } from "../types";
import { formatAmount } from "../utils/format";
import { assignLineDepths } from "../utils/marDepth";

interface StatementTableProps {
  title: string;
  lines: StatementLine[];
  amountFormat?: AmountFormat;
  selectedCode?: string | null;
  onSelectRow?: (code: string) => void;
  readOnly?: boolean;
}

const INDENT_CLASS = ["pl-4", "pl-8", "pl-12", "pl-16"] as const;

/**
 * Presentational table: toont StatementLine[] zonder API-calls.
 * Kolommen: code | PDF-omschrijving | toelichting | boekjaar | vorig.
 * Hiërarchie (vet/inspringing) volgt MAR-nesting zoals in de PDF.
 */
export function StatementTable({
  title,
  lines,
  amountFormat = "full",
  selectedCode,
  onSelectRow,
  readOnly: _readOnly = false,
}: StatementTableProps) {
  const depths = assignLineDepths(lines);
  const selectedRef = useRef<HTMLTableRowElement | null>(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedCode]);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="px-4 py-3">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <p className="mt-0.5 text-sm text-slate-500">
          {lines.length} regels · klik een regel om de bron in de PDF te zien
        </p>
      </div>
      <div className="max-h-[70vh] overflow-auto">
        <table className="min-w-full table-fixed text-left text-sm">
          <thead className="sticky top-0 bg-white text-slate-500">
            <tr className="border-y border-slate-200">
              <th className="w-28 px-4 py-2 align-top font-medium">Code</th>
              <th className="px-4 py-2 align-top font-medium">Omschrijving</th>
              <th className="w-16 px-4 py-2 align-top font-medium">Toel.</th>
              <th className="w-28 px-4 py-2 align-top text-right font-medium">
                Boekjaar
              </th>
              <th className="w-32 px-4 py-2 align-top text-right font-medium">
                Vorig boekjaar
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => {
              const { depth, isGroup } = depths[index];
              const emphasize = isGroup || depth <= 1;
              const indentClass =
                depth > 0
                  ? INDENT_CLASS[Math.min(depth, INDENT_CLASS.length) - 1]
                  : "pl-4";
              const selected = selectedCode === line.code;
              const printedLabel = cleanStatementLabel(line.label || "");

              return (
                <tr
                  key={`${line.code}-${index}`}
                  ref={selected ? selectedRef : undefined}
                  onClick={() => onSelectRow?.(line.code)}
                  className={`${onSelectRow ? "cursor-pointer" : ""} ${
                    selected
                      ? "bg-emerald-50/80 shadow-[inset_3px_0_0_0_theme(colors.emerald.600)]"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <td
                    className={`whitespace-nowrap px-4 py-2.5 align-top font-mono ${
                      emphasize
                        ? "font-semibold text-emerald-800"
                        : "text-slate-600"
                    }`}
                  >
                    {line.code}
                  </td>
                  <td
                    className={`py-2.5 pr-4 align-top ${indentClass} ${
                      emphasize ? "font-semibold text-slate-900" : "text-slate-800"
                    }`}
                  >
                    {printedLabel || "—"}
                  </td>
                  <td className="px-4 py-2.5 align-top text-slate-500">
                    {line.footnote || "—"}
                  </td>
                  <td className="px-4 py-2.5 align-top text-right font-mono text-slate-800">
                    {formatAmount(line.current, amountFormat)}
                  </td>
                  <td className="px-4 py-2.5 align-top text-right font-mono text-slate-800">
                    {formatAmount(line.previous, amountFormat)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
