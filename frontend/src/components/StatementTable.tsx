import type { StatementLine } from "../types";
import { formatAmount } from "../utils/format";
import { assignLineDepths } from "../utils/marDepth";

interface StatementTableProps {
  title: string;
  lines: StatementLine[];
}

const INDENT_CLASS = ["pl-4", "pl-8", "pl-12", "pl-16"] as const;

/**
 * Presentational table: toont StatementLine[] zonder API-calls.
 * Kolommen mirroren de NBB-PDF: code | omschrijving | toelichting | boekjaar | vorig.
 * Hiërarchie (vet/inspringing) volgt MAR-nesting zoals in de PDF.
 */
export function StatementTable({ title, lines }: StatementTableProps) {
  const depths = assignLineDepths(lines);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-100 px-4 py-3">
        <h3 className="font-semibold text-slate-800">{title}</h3>
        <p className="text-sm text-slate-500">{lines.length} regels</p>
      </div>
      <div className="max-h-[70vh] overflow-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="sticky top-0 bg-white text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Code</th>
              <th className="px-4 py-2 font-medium">Omschrijving</th>
              <th className="px-4 py-2 font-medium">Toel.</th>
              <th className="px-4 py-2 text-right font-medium">Boekjaar</th>
              <th className="px-4 py-2 text-right font-medium">Vorig boekjaar</th>
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

              return (
                <tr
                  key={`${line.code}-${index}`}
                  className={`border-t hover:bg-slate-50 ${
                    emphasize
                      ? "border-slate-200 bg-slate-50/80"
                      : "border-slate-100"
                  }`}
                >
                  <td
                    className={`px-4 py-2 font-mono ${
                      emphasize
                        ? "font-semibold text-emerald-800"
                        : "text-emerald-600/80"
                    }`}
                  >
                    {line.code}
                  </td>
                  <td
                    className={`py-2 pr-4 text-slate-800 ${indentClass} ${
                      emphasize ? "font-semibold" : ""
                    }`}
                  >
                    {line.label || "—"}
                  </td>
                  <td className="px-4 py-2 text-slate-500">
                    {line.footnote || "—"}
                  </td>
                  <td className="px-4 py-2 text-right font-mono">
                    {formatAmount(line.current)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono">
                    {formatAmount(line.previous)}
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
