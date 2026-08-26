import { useEffect, useRef } from "react";
import { nbbGlossaryLabel } from "../i18n/marLabels";
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
 * Kolommen mirroren de NBB-PDF: code | omschrijving | toelichting | boekjaar | vorig.
 * Hiërarchie (vet/inspringing) volgt MAR-nesting zoals in de PDF.
 */
export function StatementTable({
  title,
  lines,
  amountFormat = "full",
  selectedCode,
  onSelectRow,
  readOnly = false,
}: StatementTableProps) {
  const depths = assignLineDepths(lines);
  const selectedRef = useRef<HTMLTableRowElement | null>(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedCode]);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-100 px-4 py-3">
        <h3 className="font-semibold text-slate-800">{title}</h3>
        <p className="text-sm text-slate-500">{lines.length} regels</p>
      </div>
      <div className="max-h-[70vh] overflow-auto">
        <table className="min-w-full table-fixed text-left text-sm">
          <thead className="sticky top-0 bg-white text-slate-500">
            <tr>
              <th className="w-20 px-4 py-2 align-top font-medium">Code</th>
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
              const glossary = nbbGlossaryLabel(line.code);
              const showGlossary =
                glossary &&
                glossary.toLowerCase() !== (line.label || "").toLowerCase();

              return (
                <tr
                  key={`${line.code}-${index}`}
                  ref={selected ? selectedRef : undefined}
                  onClick={() => onSelectRow?.(line.code)}
                  className={`border-t ${onSelectRow ? "cursor-pointer" : ""} ${
                    selected
                      ? "bg-emerald-50 ring-1 ring-inset ring-emerald-300"
                      : emphasize
                        ? "border-slate-200 bg-slate-50/80 hover:bg-slate-50"
                        : "border-slate-100 hover:bg-slate-50"
                  } ${readOnly ? "" : ""}`}
                >
                  <td
                    className={`px-4 py-2 align-top font-mono ${
                      emphasize
                        ? "font-semibold text-emerald-800"
                        : "text-emerald-600/80"
                    }`}
                  >
                    {line.code}
                  </td>
                  <td
                    className={`py-2 pr-4 align-top text-slate-800 ${indentClass} ${
                      emphasize ? "font-semibold" : ""
                    }`}
                  >
                    <span>{line.label || "—"}</span>
                    {showGlossary && (
                      <span className="mt-0.5 block text-xs font-normal text-slate-500">
                        {glossary}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 align-top text-slate-500">
                    {line.footnote || "—"}
                  </td>
                  <td className="px-4 py-2 align-top text-right font-mono">
                    {formatAmount(line.current, amountFormat)}
                  </td>
                  <td className="px-4 py-2 align-top text-right font-mono">
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
