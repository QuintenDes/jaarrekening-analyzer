import type { StatementLine } from "../types";
import { formatAmount } from "../utils/format";

interface StatementTableProps {
  title: string;
  lines: StatementLine[];
}

/**
 * Presentational table: toont StatementLine[] zonder API-calls.
 * Kolommen mirroren de NBB-PDF: code | omschrijving | toelichting | boekjaar | vorig.
 */
export function StatementTable({ title, lines }: StatementTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-100 px-4 py-3">
        <h3 className="font-semibold text-slate-800">{title}</h3>
        <p className="text-sm text-slate-500">{lines.length} regels</p>
      </div>
      <div className="max-h-[32rem] overflow-auto">
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
            {lines.map((line, index) => (
              <tr
                key={`${line.code}-${index}`}
                className="border-t border-slate-100 hover:bg-slate-50"
              >
                <td className="px-4 py-2 font-mono text-emerald-700">{line.code}</td>
                <td className="px-4 py-2 text-slate-800">{line.label || "—"}</td>
                <td className="px-4 py-2 text-slate-500">{line.footnote || "—"}</td>
                <td className="px-4 py-2 text-right font-mono">
                  {formatAmount(line.current)}
                </td>
                <td className="px-4 py-2 text-right font-mono">
                  {formatAmount(line.previous)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
