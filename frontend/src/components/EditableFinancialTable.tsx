import type { FinancialTableConfig, TableColumn } from "../types";
import { DeleteIcon } from "./icons";

interface EditableFinancialTableProps {
  table: FinancialTableConfig;
  onChange?: (table: FinancialTableConfig) => void;
  disabled?: boolean;
  editable?: boolean;
}

function newId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cellAlignClass(column: TableColumn, index: number): string {
  const key = `${column.id} ${column.label}`.toLowerCase();
  const align =
    key.includes("code") || index === 0
      ? "text-left"
      : "text-right tabular-nums";
  const mono = key.includes("code") ? "font-mono text-[13px]" : "";
  return `${align} ${mono}`.trim();
}

function cellInputClass(column: TableColumn, index: number): string {
  return `w-full min-w-[5.5rem] rounded bg-transparent px-2 py-1.5 text-sm text-slate-800 outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500 ${cellAlignClass(column, index)}`.trim();
}

function cellTextClass(column: TableColumn, index: number): string {
  return `px-3 py-2 text-sm text-slate-800 ${cellAlignClass(column, index)}`.trim();
}

export function addTableRow(table: FinancialTableConfig): FinancialTableConfig {
  return {
    ...table,
    rows: [
      ...table.rows,
      {
        id: newId("row"),
        label: "",
        cells: table.columns.map(() => ""),
      },
    ],
  };
}

export function addTableColumn(table: FinancialTableConfig): FinancialTableConfig {
  return {
    ...table,
    columns: [...table.columns, { id: newId("col"), label: "Kolom" }],
    rows: table.rows.map((row) => ({ ...row, cells: [...row.cells, ""] })),
  };
}

export function EditableFinancialTable({
  table,
  onChange,
  disabled,
  editable = true,
}: EditableFinancialTableProps) {
  function patch(next: FinancialTableConfig) {
    onChange?.(next);
  }

  function updateColumnLabel(index: number, label: string) {
    patch({
      ...table,
      columns: table.columns.map((column, i) =>
        i === index ? { ...column, label } : column,
      ),
    });
  }

  function updateRowLabel(index: number, label: string) {
    patch({
      ...table,
      rows: table.rows.map((row, i) =>
        i === index ? { ...row, label } : row,
      ),
    });
  }

  function updateCell(rowIndex: number, cellIndex: number, value: string) {
    patch({
      ...table,
      rows: table.rows.map((row, i) => {
        if (i !== rowIndex) return row;
        const cells = [...row.cells];
        cells[cellIndex] = value;
        return { ...row, cells };
      }),
    });
  }

  function removeColumn(index: number) {
    if (table.columns.length <= 1) return;
    patch({
      ...table,
      columns: table.columns.filter((_, i) => i !== index),
      rows: table.rows.map((row) => ({
        ...row,
        cells: row.cells.filter((_, i) => i !== index),
      })),
    });
  }

  function removeRow(index: number) {
    if (table.rows.length <= 1) return;
    patch({
      ...table,
      rows: table.rows.filter((_, i) => i !== index),
    });
  }

  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="max-h-[70vh] min-w-0 overflow-auto">
        <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 top-0 z-30 min-w-[16rem] border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Omschrijving
              </th>
              {table.columns.map((column, index) => (
                <th
                  key={column.id}
                  scope="col"
                  className={
                    editable
                      ? "sticky top-0 z-20 min-w-[8rem] border-b border-l border-slate-200 bg-slate-50 px-2 py-1.5 align-bottom"
                      : "sticky top-0 z-20 min-w-[8rem] border-b border-l border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600"
                  }
                >
                  {editable ? (
                    <div className="flex items-center gap-1">
                      <input
                        value={column.label}
                        disabled={disabled}
                        onChange={(event) =>
                          updateColumnLabel(index, event.target.value)
                        }
                        aria-label={`Kolomkop ${index + 1}`}
                        className="min-w-0 flex-1 rounded bg-transparent px-1.5 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500"
                      />
                      <button
                        type="button"
                        disabled={disabled || table.columns.length <= 1}
                        onClick={() => removeColumn(index)}
                        title="Kolom verwijderen"
                        aria-label={`Kolom ${column.label || index + 1} verwijderen`}
                        className="rounded p-1 text-slate-400 hover:bg-white hover:text-red-600 disabled:opacity-30"
                      >
                        <DeleteIcon />
                      </button>
                    </div>
                  ) : (
                    column.label
                  )}
                </th>
              ))}
              {editable && (
                <th
                  scope="col"
                  className="sticky top-0 z-20 w-10 border-b border-l border-slate-200 bg-slate-50"
                >
                  <span className="sr-only">Rijacties</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, rowIndex) => (
              <tr key={row.id} className="group">
                <th
                  scope="row"
                  className={
                    editable
                      ? "sticky left-0 z-10 border-b border-slate-100 bg-white px-2 py-0.5 text-left font-medium text-slate-800 group-hover:bg-slate-50"
                      : "sticky left-0 z-10 border-b border-slate-100 bg-white px-3 py-2 text-left text-sm font-medium text-slate-800"
                  }
                >
                  {editable ? (
                    <input
                      value={row.label}
                      disabled={disabled}
                      onChange={(event) =>
                        updateRowLabel(rowIndex, event.target.value)
                      }
                      aria-label={`Rijlabel ${rowIndex + 1}`}
                      className="w-full min-w-[15rem] rounded bg-transparent px-2 py-1.5 text-sm font-medium text-slate-800 outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500"
                    />
                  ) : (
                    row.label
                  )}
                </th>
                {table.columns.map((column, cellIndex) => (
                  <td
                    key={column.id}
                    className={
                      editable
                        ? "border-b border-l border-slate-100 bg-white px-1 py-0.5 group-hover:bg-slate-50"
                        : `border-b border-l border-slate-100 bg-white ${cellTextClass(column, cellIndex)}`
                    }
                  >
                    {editable ? (
                      <input
                        value={row.cells[cellIndex] ?? ""}
                        disabled={disabled}
                        onChange={(event) =>
                          updateCell(rowIndex, cellIndex, event.target.value)
                        }
                        aria-label={`${row.label || `Rij ${rowIndex + 1}`}, ${column.label}`}
                        className={cellInputClass(column, cellIndex)}
                      />
                    ) : (
                      (row.cells[cellIndex] ?? "")
                    )}
                  </td>
                ))}
                {editable && (
                  <td className="border-b border-l border-slate-100 bg-white px-1 py-0.5 text-center group-hover:bg-slate-50">
                    <button
                      type="button"
                      disabled={disabled || table.rows.length <= 1}
                      onClick={() => removeRow(rowIndex)}
                      title="Rij verwijderen"
                      aria-label={`Rij ${row.label || rowIndex + 1} verwijderen`}
                      className="rounded p-1 text-slate-400 hover:text-red-600 disabled:opacity-30"
                    >
                      <DeleteIcon />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
