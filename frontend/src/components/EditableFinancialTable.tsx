import { useEffect, useId, useRef, useState } from "react";
import { CellRefInput } from "./CellRefInput";
import {
  cellRefKind,
  resolveCellValue,
} from "../tables/cellRefs";
import type {
  AmountFormat,
  AnalysisResult,
  FinancialTableConfig,
  RatioSpec,
  TableColumn,
  TableRow,
} from "../types";
import {
  DeleteIcon,
  EyeIcon,
  IndentDecreaseIcon,
  IndentIncreaseIcon,
} from "./icons";

interface EditableFinancialTableProps {
  table: FinancialTableConfig;
  onChange?: (table: FinancialTableConfig) => void;
  disabled?: boolean;
  editable?: boolean;
  /** When set in view mode, mar:/ratio: cells are resolved to live values. */
  analysisResult?: AnalysisResult | null;
  amountFormat?: AmountFormat;
  ratioSpecs?: RatioSpec[];
}

const MAX_INDENT = 6;
const INDENT_CLASS = [
  "",
  "pl-4",
  "pl-8",
  "pl-12",
  "pl-16",
  "pl-20",
  "pl-24",
] as const;

function newId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function rowIndent(row: TableRow): number {
  const value = row.indent ?? 0;
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(MAX_INDENT, Math.floor(value));
}

function rowInfo(row: TableRow): string {
  return row.info ?? "";
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

function cellPlaceholder(column: TableColumn, index: number): string {
  const key = `${column.id} ${column.label}`.toLowerCase();
  if (key.includes("code")) return "29/58";
  if (
    key.includes("verschil") ||
    key.includes("diff") ||
    key.includes("%") ||
    key.includes("pct")
  ) {
    return "pct:vorig,boekjaar";
  }
  if (
    key.includes("boekjaar") ||
    key.includes("vorig") ||
    key.includes("bedrag") ||
    key.includes("amount") ||
    index > 0
  ) {
    return "mar:29/58 of cell:boekjaar";
  }
  return "";
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
        indent: 0,
        info: "",
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

function RowInfoBadge({
  info,
  editable,
  disabled,
  onChange,
  rowLabel,
}: {
  info: string;
  editable: boolean;
  disabled?: boolean;
  onChange?: (value: string) => void;
  rowLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const hasInfo = info.trim().length > 0;

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (!editable && !hasInfo) {
    return null;
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        disabled={disabled}
        aria-label={
          hasInfo
            ? `Informatie voor ${rowLabel || "rij"}`
            : `Informatie toevoegen voor ${rowLabel || "rij"}`
        }
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        title={hasInfo ? "Informatie bekijken" : "Informatie toevoegen"}
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex h-6 w-6 items-center justify-center rounded-full ring-1 transition ${
          hasInfo
            ? "bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100"
            : "bg-white text-slate-400 ring-slate-200 hover:bg-slate-50 hover:text-slate-600"
        } disabled:opacity-40`}
      >
        <EyeIcon className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label={`Informatie ${rowLabel || "rij"}`}
          className="absolute left-0 top-8 z-40 w-64 rounded-lg border border-slate-200 bg-white p-2 shadow-lg"
        >
          {editable ? (
            <textarea
              value={info}
              disabled={disabled}
              onChange={(event) => onChange?.(event.target.value)}
              rows={4}
              placeholder="Toelichting bij deze rij…"
              className="w-full resize-y rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          ) : (
            <p className="whitespace-pre-wrap px-1 py-1 text-sm text-slate-700">
              {info}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function EditableFinancialTable({
  table,
  onChange,
  disabled,
  editable = true,
  analysisResult = null,
  amountFormat = "full",
  ratioSpecs = [],
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

  function updateRow(
    index: number,
    updater: (row: TableRow) => TableRow,
  ) {
    patch({
      ...table,
      rows: table.rows.map((row, i) => (i === index ? updater(row) : row)),
    });
  }

  function updateRowLabel(index: number, label: string) {
    updateRow(index, (row) => ({ ...row, label }));
  }

  function updateRowIndent(index: number, delta: number) {
    updateRow(index, (row) => ({
      ...row,
      indent: Math.max(0, Math.min(MAX_INDENT, rowIndent(row) + delta)),
    }));
  }

  function updateRowInfo(index: number, info: string) {
    updateRow(index, (row) => ({ ...row, info }));
  }

  function updateCell(rowIndex: number, cellIndex: number, value: string) {
    updateRow(rowIndex, (row) => {
      const cells = [...row.cells];
      cells[cellIndex] = value;
      return { ...row, cells };
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
            {table.rows.map((row, rowIndex) => {
              const indent = rowIndent(row);
              const info = rowInfo(row);
              const indentClass = INDENT_CLASS[indent] ?? INDENT_CLASS[MAX_INDENT];

              return (
                <tr key={row.id} className="group">
                  <th
                    scope="row"
                    className={
                      editable
                        ? "sticky left-0 z-10 border-b border-slate-100 bg-white px-2 py-0.5 text-left font-medium text-slate-800 group-hover:bg-slate-50"
                        : "sticky left-0 z-10 border-b border-slate-100 bg-white px-3 py-2 text-left text-sm font-medium text-slate-800"
                    }
                  >
                    <div className={`flex min-w-[15rem] items-center gap-1 ${indentClass}`}>
                      {editable && (
                        <div className="flex shrink-0 items-center">
                          <button
                            type="button"
                            disabled={disabled || indent <= 0}
                            onClick={() => updateRowIndent(rowIndex, -1)}
                            title="Minder inspringen"
                            aria-label={`Minder inspringen voor ${row.label || `rij ${rowIndex + 1}`}`}
                            className="rounded p-0.5 text-slate-400 hover:bg-white hover:text-slate-700 disabled:opacity-25"
                          >
                            <IndentDecreaseIcon className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={disabled || indent >= MAX_INDENT}
                            onClick={() => updateRowIndent(rowIndex, 1)}
                            title="Meer inspringen"
                            aria-label={`Meer inspringen voor ${row.label || `rij ${rowIndex + 1}`}`}
                            className="rounded p-0.5 text-slate-400 hover:bg-white hover:text-slate-700 disabled:opacity-25"
                          >
                            <IndentIncreaseIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                      <RowInfoBadge
                        info={info}
                        editable={editable}
                        disabled={disabled}
                        rowLabel={row.label || `rij ${rowIndex + 1}`}
                        onChange={(value) => updateRowInfo(rowIndex, value)}
                      />
                      {editable ? (
                        <input
                          value={row.label}
                          disabled={disabled}
                          onChange={(event) =>
                            updateRowLabel(rowIndex, event.target.value)
                          }
                          aria-label={`Rijlabel ${rowIndex + 1}`}
                          className="min-w-0 flex-1 rounded bg-transparent px-2 py-1.5 text-sm font-medium text-slate-800 outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500"
                        />
                      ) : (
                        <span className="min-w-0 flex-1">{row.label}</span>
                      )}
                    </div>
                  </th>
                  {table.columns.map((column, cellIndex) => {
                    const raw = row.cells[cellIndex] ?? "";
                    const refKind = cellRefKind(raw);
                    const resolved =
                      !editable && refKind
                        ? resolveCellValue(raw, {
                            row,
                            columns: table.columns,
                            cellIndex,
                            column,
                            result: analysisResult,
                            amountFormat,
                          })
                        : null;

                    return (
                      <td
                        key={column.id}
                        className={
                          editable
                            ? "border-b border-l border-slate-100 bg-white px-1 py-0.5 group-hover:bg-slate-50"
                            : `border-b border-l border-slate-100 bg-white ${cellTextClass(column, cellIndex)}`
                        }
                      >
                        {editable ? (
                          <CellRefInput
                            value={raw}
                            disabled={disabled}
                            column={column}
                            cellIndex={cellIndex}
                            columns={table.columns}
                            ratioSpecs={ratioSpecs}
                            placeholder={cellPlaceholder(column, cellIndex)}
                            ariaLabel={`${row.label || `Rij ${rowIndex + 1}`}, ${column.label}`}
                            className={cellInputClass(column, cellIndex)}
                            onChange={(value) =>
                              updateCell(rowIndex, cellIndex, value)
                            }
                          />
                        ) : resolved ? (
                          <span
                            title={resolved.title}
                            className={
                              resolved.missing ? "text-slate-400" : undefined
                            }
                          >
                            {resolved.text}
                          </span>
                        ) : (
                          raw
                        )}
                      </td>
                    );
                  })}
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
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
