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

function normalizeLabel(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Presentational table: toont StatementLine[] zonder API-calls.
 * Kolommen: code | PDF-omschrijving + MAR-label | toelichting | boekjaar | vorig.
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
                Boolean(glossary) &&
                normalizeLabel(glossary ?? "") !==
                  normalizeLabel(line.label || "");

              return (
                <tr
                  key={`${line.code}-${index}`}
                  ref={selected ? selectedRef : undefined}
                  onClick={() => onSelectRow?.(line.code)}
                  className={`border-t border-slate-100 ${onSelectRow ? "cursor-pointer" : ""} ${
                    selected
                      ? "bg-emerald-50 ring-1 ring-inset ring-emerald-300"
                      : "hover:bg-slate-50"
                  } ${readOnly ? "" : ""}`}
                >
                  <td
                    className={`px-4 py-2.5 align-top font-mono ${
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
                    <span>{line.label || "—"}</span>
                    {showGlossary ? (
                      <span className="mt-1 flex items-baseline gap-1.5 text-xs font-normal text-slate-500">
                        <span className="shrink-0 rounded bg-slate-100 px-1 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                          MAR
                        </span>
                        <span>{glossary}</span>
                      </span>
                    ) : null}
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
