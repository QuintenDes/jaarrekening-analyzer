import { useEffect, useId, useRef, useState } from "react";
import { selectKpis, type KpiSelection } from "../analysis/kpis";
import {
  keyRatiosForCategory,
  RATIO_CATEGORY_ORDER,
  RATIO_VIEWS,
  ratiosInCategory,
  type RatioView,
} from "../analysis/keyRatios";
import type { AmountFormat, AnalysisResult, RatioResult } from "../types";
import { formatAmount, formatRatio, formatSignedPercent } from "../utils/format";

interface RatioDashboardProps {
  result: AnalysisResult;
  ratios: RatioResult[];
  amountFormat: AmountFormat;
  updating?: boolean;
  staleFailure?: boolean;
}

function titleCase(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

/** Split op gedeelde ' / ' zodat MAR-codes (29/58) niet verward worden met deling. */
function FormulaDisplay({ formula }: { formula: string }) {
  const parts = formula.split(" / ");
  if (parts.length === 2) {
    return (
      <div className="inline-flex flex-col items-center font-mono text-xs text-slate-600">
        <span>{parts[0]}</span>
        <span className="my-0.5 w-full border-t border-slate-300" />
        <span>{parts[1]}</span>
      </div>
    );
  }
  return <p className="font-mono text-xs text-slate-600">{formula}</p>;
}

interface RatioCardProps {
  ratio: RatioResult;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}

function RatioCard({ ratio, open, onToggle, onClose }: RatioCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (cardRef.current && !cardRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  return (
    <div
      ref={cardRef}
      className="relative rounded-lg border border-slate-100 bg-slate-50 p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-slate-500">{ratio.name}</p>
        <button
          type="button"
          aria-label="Formule"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-slate-400 ring-1 ring-slate-300 hover:bg-white hover:text-slate-600"
        >
          i
        </button>
      </div>
      <p className="mt-1 text-2xl font-semibold text-slate-900">
        {formatRatio(ratio.value, ratio.unit)}
      </p>
      {open && (
        <div
          id={panelId}
          role="tooltip"
          className="absolute right-3 top-10 z-10 rounded-md border border-slate-200 bg-white px-3 py-2 shadow-sm"
        >
          <FormulaDisplay formula={ratio.formula} />
        </div>
      )}
      {ratio.missing_codes.length > 0 && (
        <p className="mt-2 text-xs text-amber-700">
          Niet beschikbaar — ontbrekende gegevens: {ratio.missing_codes.join(", ")}
        </p>
      )}
    </div>
  );
}

function trendClass(change: number): string {
  if (Math.abs(change) < 0.05) return "text-slate-500";
  return change > 0 ? "text-emerald-700" : "text-red-700";
}

function KpiCard({
  kpi,
  amountFormat,
}: {
  kpi: KpiSelection;
  amountFormat: AmountFormat;
}) {
  const value = kpi.line?.current ?? null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{kpi.label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">
        {formatAmount(value, amountFormat)}
      </p>
      {kpi.change !== null ? (
        <p className={`mt-2 text-xs ${trendClass(kpi.change)}`}>
          {formatSignedPercent(kpi.change)} t.o.v. vorig jaar
        </p>
      ) : value === null ? (
        <p className="mt-2 text-xs text-amber-700">Niet beschikbaar</p>
      ) : (
        <p className="mt-2 text-xs text-slate-400">Geen vergelijking met vorig jaar</p>
      )}
    </div>
  );
}

function RatioGrid({
  items,
  openFormulaId,
  onToggle,
  onClose,
}: {
  items: RatioResult[];
  openFormulaId: string | null;
  onToggle: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((ratio) => (
        <RatioCard
          key={ratio.id}
          ratio={ratio}
          open={openFormulaId === ratio.id}
          onToggle={() => onToggle(ratio.id)}
          onClose={onClose}
        />
      ))}
    </div>
  );
}

function CategorySection({
  category,
  items,
  onViewAll,
  openFormulaId,
  onToggle,
  onClose,
}: {
  category: string;
  items: RatioResult[];
  onViewAll?: () => void;
  openFormulaId: string | null;
  onToggle: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-100 px-4 py-3">
        <h3 className="font-semibold text-slate-800">{titleCase(category)}</h3>
        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
          >
            Bekijk alle →
          </button>
        )}
      </div>
      <RatioGrid
        items={items}
        openFormulaId={openFormulaId}
        onToggle={onToggle}
        onClose={onClose}
      />
    </div>
  );
}

/**
 * Ratio area: dashboard (KPIs + 3 key metrics per category) and
 * dedicated category views with the full existing list.
 */
export function RatioDashboard({
  result,
  ratios,
  amountFormat,
  updating = false,
  staleFailure = false,
}: RatioDashboardProps) {
  const [view, setView] = useState<RatioView>("dashboard");
  const [openFormulaId, setOpenFormulaId] = useState<string | null>(null);
  const kpis = selectKpis(result);

  function toggleFormula(id: string) {
    setOpenFormulaId((current) => (current === id ? null : id));
  }

  const statusBanners = (
    <>
      {updating && (
        <p className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-900">
          Wordt bijgewerkt
        </p>
      )}
      {staleFailure && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          Deze waarden weerspiegelen niet de laatste sandbox-wijzigingen.
        </p>
      )}
    </>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {RATIO_VIEWS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setView(item.id);
              setOpenFormulaId(null);
            }}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              view === item.id
                ? "bg-emerald-600 text-white"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {statusBanners}

      {view === "dashboard" ? (
        <>
          <section>
            <h2 className="mb-3 text-lg font-semibold text-slate-900">
              Kerncijfers
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {kpis.map((kpi) => (
                <KpiCard key={kpi.id} kpi={kpi} amountFormat={amountFormat} />
              ))}
            </div>
          </section>
          {RATIO_CATEGORY_ORDER.map((category) => (
            <CategorySection
              key={category}
              category={category}
              items={keyRatiosForCategory(ratios, category)}
              onViewAll={() => {
                setView(category);
                setOpenFormulaId(null);
              }}
              openFormulaId={openFormulaId}
              onToggle={toggleFormula}
              onClose={() => setOpenFormulaId(null)}
            />
          ))}
        </>
      ) : (
        <CategorySection
          category={view}
          items={ratiosInCategory(ratios, view)}
          openFormulaId={openFormulaId}
          onToggle={toggleFormula}
          onClose={() => setOpenFormulaId(null)}
        />
      )}
    </div>
  );
}

