import { useMemo, useState } from "react";
import {
  matchesSearch,
  SECTION_ORDER,
  SECTION_TITLES,
  selectionForEntry,
  type SourceEntry,
} from "../analysis/sources";
import { nbbGlossaryLabel } from "../i18n/marLabels";
import type { AmountFormat, SourceSelection } from "../types";
import { formatAmount } from "../utils/format";

interface SourcePanelProps {
  entries: SourceEntry[];
  selection: SourceSelection | null;
  amountFormat: AmountFormat;
  onSelect: (selection: SourceSelection) => void;
}

export function SourcePanel({
  entries,
  selection,
  amountFormat,
  onSelect,
}: SourcePanelProps) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filtered = useMemo(
    () => entries.filter((entry) => matchesSearch(entry, query)),
    [entries, query],
  );

  const grouped = useMemo(() => {
    return SECTION_ORDER.map((section) => ({
      section,
      title: SECTION_TITLES[section],
      items: filtered.filter((entry) => entry.section === section),
    })).filter((group) => group.items.length > 0);
  }, [filtered]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="border-b border-slate-200 px-3 py-2">
        <p className="text-sm font-semibold text-slate-800">Bronnen</p>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Zoek label, MAR of bedrag"
          className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {grouped.map((group) => (
          <section key={group.section} className="border-b border-slate-100">
            <h3 className="sticky top-0 bg-slate-100 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
              {group.title}
            </h3>
            <ul>
              {group.items.map((entry) => {
                const selected = selection?.section === entry.section && selection.code === entry.code;
                const open = expanded.has(entry.key);
                const glossary = nbbGlossaryLabel(entry.code);
                return (
                  <li key={entry.key} className="border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => onSelect(selectionForEntry(entry))}
                      className={`flex w-full items-baseline gap-2 px-3 py-2 text-left text-sm ${
                        selected ? "bg-emerald-50" : "hover:bg-slate-50"
                      }`}
                    >
                      <span className="shrink-0 font-mono text-xs text-slate-600">
                        {entry.code}
                      </span>
                      <span className="min-w-0 flex-1 font-medium text-slate-800">
                        {glossary ?? entry.label}
                      </span>
                      <span className="shrink-0 font-mono text-xs text-slate-600">
                        {formatAmount(entry.amount, amountFormat)}
                      </span>
                    </button>
                    {entry.occurrences.length > 1 && (
                      <div className="px-3 pb-2">
                        <button
                          type="button"
                          onClick={() =>
                            setExpanded((current) => {
                              const next = new Set(current);
                              if (next.has(entry.key)) next.delete(entry.key);
                              else next.add(entry.key);
                              return next;
                            })
                          }
                          className="text-xs font-medium text-emerald-800"
                        >
                          {entry.occurrences.length} bronnen
                        </button>
                        {open && (
                          <ul className="mt-1 space-y-1">
                            {entry.occurrences.map((occurrence) => (
                              <li key={occurrence.occurrenceIndex}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onSelect(
                                      selectionForEntry(entry, occurrence.occurrenceIndex),
                                    )
                                  }
                                  className={`w-full rounded px-2 py-1 text-left text-xs ${
                                    selected &&
                                    selection?.occurrenceIndex === occurrence.occurrenceIndex
                                      ? "bg-emerald-100 text-emerald-900"
                                      : "text-slate-600 hover:bg-slate-50"
                                  }`}
                                >
                                  Bron {occurrence.occurrenceIndex + 1} · p.{" "}
                                  {occurrence.page + 1}
                                  {occurrence.occurrenceIndex ===
                                  entry.occurrences.length - 1
                                    ? " (geaggregeerd)"
                                    : ""}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        {filtered.length === 0 && (
          <p className="px-3 py-4 text-sm text-slate-500">Geen bronnen gevonden.</p>
        )}
      </div>
    </div>
  );
}
