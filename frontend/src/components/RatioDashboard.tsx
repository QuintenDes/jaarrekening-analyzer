import { useEffect, useId, useMemo, useRef, useState } from "react";
import { selectKpis, type KpiSelection } from "../analysis/kpis";
import {
  categoryLabel,
  cloneKeyIds,
  DEFAULT_DASHBOARD_RATIO_COUNT,
  keyRatiosForCategory,
  orderedCategories,
  RATIO_CATEGORY_ORDER,
  ratiosInCategory,
  type RatioView,
} from "../analysis/keyRatios";
import { getRatiosConfigMeta } from "../api/client";
import type { AmountFormat, AnalysisResult, RatioResult } from "../types";
import { formatAmount, formatRatio, formatSignedPercent } from "../utils/format";
import { SubTabs } from "./SubTabs";

interface RatioDashboardProps {
  result: AnalysisResult;
  ratios: RatioResult[];
  amountFormat: AmountFormat;
  updating?: boolean;
  staleFailure?: boolean;
}

function titleCase(value: string): string {
  return categoryLabel(value);
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
      className="relative rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
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
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
  separated,
}: {
  category: string;
  items: RatioResult[];
  onViewAll?: () => void;
  openFormulaId: string | null;
  onToggle: (id: string) => void;
  onClose: () => void;
  separated?: boolean;
}) {
  return (
    <section className={separated ? "border-t border-slate-200 pt-6" : undefined}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {titleCase(category)}
        </h2>
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
      {items.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
          Geen ratio’s in deze categorie.
        </p>
      ) : (
        <RatioGrid
          items={items}
          openFormulaId={openFormulaId}
          onToggle={onToggle}
          onClose={onClose}
        />
      )}
    </section>
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
  const [dashboardCount, setDashboardCount] = useState(DEFAULT_DASHBOARD_RATIO_COUNT);
  const [extraCategories, setExtraCategories] = useState<string[]>([]);
  const [keyIds, setKeyIds] = useState<Record<string, string[]>>(() =>
    cloneKeyIds(undefined),
  );
  const kpis = selectKpis(result);

  useEffect(() => {
    let cancelled = false;
    void getRatiosConfigMeta()
      .then((config) => {
        if (cancelled) return;
        setDashboardCount(config.dashboard_ratio_count);
        setKeyIds(cloneKeyIds(config.dashboard_key_ids));
        setExtraCategories(
          orderedCategories(config.categories).filter(
            (category) =>
              !(RATIO_CATEGORY_ORDER as readonly string[]).includes(category),
          ),
        );
      })
      .catch(() => {
        /* keep defaults */
      });
    return () => {
      cancelled = true;
    };
  }, [updating, ratios]);

  const dashboardCategories = useMemo(
    () => [...RATIO_CATEGORY_ORDER, ...extraCategories],
    [extraCategories],
  );

  const views = useMemo(
    () => [
      { id: "dashboard" as const, label: "Dashboard" },
      ...dashboardCategories.map((category) => ({
        id: category,
        label: categoryLabel(category),
      })),
    ],
    [dashboardCategories],
  );

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
          Deze waarden weerspiegelen niet de laatste configuratiewijzigingen.
        </p>
      )}
    </>
  );

  return (
    <div className="space-y-6">
      <SubTabs
        items={views}
        value={view}
        onChange={(id) => {
          setView(id);
          setOpenFormulaId(null);
        }}
      />

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
          {dashboardCategories.map((category, index) => (
            <CategorySection
              key={category}
              category={category}
              separated={index > 0}
              items={keyRatiosForCategory(
                ratios,
                category,
                dashboardCount,
                keyIds[category],
              )}
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

