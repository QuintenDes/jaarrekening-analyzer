import { useEffect, useMemo, useState } from "react";
import {
  ApiError,
  getRatiosConfig,
  getTablesConfig,
  getTablesHistory,
  resetTablesConfig,
  restoreTablesHistory,
  saveTablesConfig,
} from "../api/client";
import type {
  FinancialTableConfig,
  RatioSpec,
  TableHistoryEntry,
  TabellenViewId,
  TablesConfigMeta,
} from "../types";
import {
  MODEL_LABELS,
  tableIdForView,
  VIEW_ITEMS,
  type ResultGroup,
} from "../tables/views";
import {
  addTableColumn,
  addTableRow,
  EditableFinancialTable,
} from "./EditableFinancialTable";
import { PlusIcon, ResetIcon, SaveIcon } from "./icons";
import { SubTabs } from "./SubTabs";

const ADMIN_TOKEN_KEY = "ratioConfigAdminToken";

function loadAdminToken(): string {
  return sessionStorage.getItem(ADMIN_TOKEN_KEY) ?? "";
}

function persistAdminToken(token: string) {
  if (token) {
    sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
  } else {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  }
}

function formatUpdatedAt(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("nl-BE");
}

function cloneTables(tables: FinancialTableConfig[]): FinancialTableConfig[] {
  return tables.map((table) => ({
    ...table,
    model_scope: [...table.model_scope],
    columns: table.columns.map((column) => ({ ...column })),
    rows: table.rows.map((row) => ({ ...row, cells: [...row.cells] })),
  }));
}

function serializeTables(tables: FinancialTableConfig[]): string {
  return JSON.stringify(tables);
}

function mapWriteError(err: unknown): string {
  if (err instanceof ApiError && err.status === 401) {
    return "Ongeldig admin-wachtwoord.";
  }
  if (err instanceof ApiError && err.status === 409) {
    return err.message;
  }
  if (err instanceof ApiError && err.status === 422) {
    return err.message;
  }
  if (err instanceof ApiError && err.status === 503) {
    return err.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "Netwerkfout. Probeer opnieuw.";
}

interface TableConfigPanelProps {
  onDirtyChange?: (dirty: boolean) => void;
}

export function TableConfigPanel({ onDirtyChange }: TableConfigPanelProps) {
  const [adminToken, setAdminToken] = useState(loadAdminToken);
  const [draft, setDraft] = useState<FinancialTableConfig[]>([]);
  const [saved, setSaved] = useState<FinancialTableConfig[]>([]);
  const [meta, setMeta] = useState<Pick<
    TablesConfigMeta,
    "source" | "version" | "updated_at"
  > | null>(null);
  const [history, setHistory] = useState<TableHistoryEntry[]>([]);
  const [view, setView] = useState<TabellenViewId>("cashflow");
  const [resultGroup, setResultGroup] = useState<ResultGroup>("full");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [ratioSpecs, setRatioSpecs] = useState<RatioSpec[]>([]);

  const dirty = useMemo(
    () => serializeTables(draft) !== serializeTables(saved),
    [draft, saved],
  );

  const activeTableId = tableIdForView(view, resultGroup);
  const activeTable = draft.find((table) => table.id === activeTableId) ?? null;

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    return () => onDirtyChange?.(false);
  }, [onDirtyChange]);

  function applyServerConfig(config: TablesConfigMeta) {
    const tables = cloneTables(config.tables);
    setDraft(tables);
    setSaved(cloneTables(tables));
    setMeta({
      source: config.source,
      version: config.version,
      updated_at: config.updated_at,
    });
  }

  async function loadConfig() {
    setLoading(true);
    setError(null);
    try {
      const config = await getTablesConfig();
      applyServerConfig(config);
      const items = await getTablesHistory().catch(() => [] as TableHistoryEntry[]);
      setHistory(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kon configuratie niet laden.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadConfig();
    void getRatiosConfig()
      .then(setRatioSpecs)
      .catch(() => setRatioSpecs([]));
  }, []);

  function handleTokenChange(value: string) {
    setAdminToken(value);
    persistAdminToken(value);
  }

  function updateActiveTable(next: FinancialTableConfig) {
    setDraft((current) =>
      current.map((table) => (table.id === next.id ? next : table)),
    );
  }

  async function handleSave() {
    if (!adminToken.trim()) {
      setError("Vul het admin-wachtwoord in om op te slaan.");
      return;
    }
    if (!meta) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const result = await saveTablesConfig(
        draft,
        adminToken.trim(),
        meta.version,
      );
      applyServerConfig(result);
      setHistory(await getTablesHistory().catch(() => []));
      setNotice("Alle tabelconfiguraties zijn opgeslagen.");
    } catch (err) {
      setError(mapWriteError(err));
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    if (
      !window.confirm(
        "Niet-opgeslagen wijzigingen in alle tabelconfiguraties verwerpen?",
      )
    ) {
      return;
    }
    setDraft(cloneTables(saved));
    setError(null);
    setNotice("Wijzigingen verworpen.");
  }

  async function handleReset() {
    if (!adminToken.trim()) {
      setError("Vul het admin-wachtwoord in om te resetten.");
      return;
    }
    if (
      !window.confirm(
        "De actieve configuratie wordt vervangen door de standaard tables.yaml. Alle vier de tabellen worden hersteld. Doorgaan?",
      )
    ) {
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const result = await resetTablesConfig(adminToken.trim());
      applyServerConfig(result);
      setHistory(await getTablesHistory().catch(() => []));
      setNotice("Standaardconfiguratie hersteld.");
    } catch (err) {
      setError(mapWriteError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleRestore(version: number) {
    if (!adminToken.trim()) {
      setError("Vul het admin-wachtwoord in om een snapshot te herstellen.");
      return;
    }
    if (
      !window.confirm(
        `Snapshot versie ${version} terugzetten als nieuwe actieve configuratie? Alle vier de tabellen worden hersteld.`,
      )
    ) {
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const result = await restoreTablesHistory(version, adminToken.trim());
      applyServerConfig(result);
      setHistory(await getTablesHistory().catch(() => []));
      setNotice(`Versie ${version} hersteld als nieuwe configuratie.`);
    } catch (err) {
      setError(mapWriteError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-w-0 space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="font-semibold text-slate-800">Tabellen configuratie</h3>
        <p className="mt-1 text-sm text-slate-600">
          Configureer de herwerkte financiële tabellen. Wijzigingen worden op de
          server bewaard en gelden voor iedereen. Opslaan schrijft alle vier de
          tabelconfiguraties als één versie.
        </p>
        <p className="mt-2 text-sm text-slate-600">
          In bedragkolommen kun je verwijzingen zetten:{" "}
          <code className="rounded bg-slate-100 px-1 font-mono text-[12px]">
            mar:29/58
          </code>{" "}
          of{" "}
          <code className="rounded bg-slate-100 px-1 font-mono text-[12px]">
            @29/58
          </code>{" "}
          (PDF/MAR, expressies met{" "}
          <code className="rounded bg-slate-100 px-1 font-mono text-[12px]">
            +
          </code>
          /
          <code className="rounded bg-slate-100 px-1 font-mono text-[12px]">
            -
          </code>{" "}
          mogen), en{" "}
          <code className="rounded bg-slate-100 px-1 font-mono text-[12px]">
            ratio:current_ratio
          </code>{" "}
          (ratio-id),{" "}
          <code className="rounded bg-slate-100 px-1 font-mono text-[12px]">
            cell:boekjaar
          </code>{" "}
          (andere kolom in dezelfde rij), en{" "}
          <code className="rounded bg-slate-100 px-1 font-mono text-[12px]">
            pct:vorig,boekjaar
          </code>{" "}
          (% verschil tussen twee kolommen). Typ{" "}
          <code className="rounded bg-slate-100 px-1 font-mono text-[12px]">
            mar:
          </code>
          ,{" "}
          <code className="rounded bg-slate-100 px-1 font-mono text-[12px]">
            ratio:
          </code>
          ,{" "}
          <code className="rounded bg-slate-100 px-1 font-mono text-[12px]">
            cell:
          </code>{" "}
          of{" "}
          <code className="rounded bg-slate-100 px-1 font-mono text-[12px]">
            pct:
          </code>{" "}
          voor suggesties. Het jaar volgt de kolom (boekjaar/vorig), of forceer met{" "}
          <code className="rounded bg-slate-100 px-1 font-mono text-[12px]">
            mar.current:
          </code>{" "}
          /
          <code className="rounded bg-slate-100 px-1 font-mono text-[12px]">
            mar.previous:
          </code>
          .
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-slate-600">
            Admin-wachtwoord
            <input
              type="password"
              value={adminToken}
              autoComplete="off"
              onChange={(event) => handleTokenChange(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <div className="text-sm text-slate-600">
            <p>
              Status:{" "}
              <span className="font-medium text-slate-800">
                {meta?.source === "saved" ? "opgeslagen" : "bundled"}
              </span>
            </p>
            <p>Versie: {meta?.version ?? "—"}</p>
            <p>Laatst bijgewerkt: {formatUpdatedAt(meta?.updated_at ?? null)}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || loading || !dirty || !adminToken.trim()}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          <SaveIcon />
          {saving ? "Opslaan…" : "Opslaan"}
        </button>
        <button
          type="button"
          onClick={handleDiscard}
          disabled={saving || loading || !dirty}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-3 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50"
        >
          Wijzigingen verwerpen
        </button>
        <button
          type="button"
          onClick={() => void handleReset()}
          disabled={saving || loading}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-3 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50"
        >
          <ResetIcon />
          Reset naar defaults
        </button>
        <p className="text-xs text-slate-500">
          Opslaan — alle tabelconfiguraties worden opgeslagen
        </p>
      </div>

      {dirty && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          Niet-opgeslagen wijzigingen
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      )}

      <SubTabs items={VIEW_ITEMS} value={view} onChange={setView} />

      {view === "herwerkte_resultatenrekening" && (
        <div
          role="group"
          aria-label="Modelgroep"
          className="inline-flex overflow-hidden rounded-lg ring-1 ring-slate-200"
        >
          <button
            type="button"
            onClick={() => setResultGroup("full")}
            className={`px-3 py-1.5 text-sm font-medium ${
              resultGroup === "full"
                ? "bg-slate-800 text-white"
                : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            Full
          </button>
          <button
            type="button"
            onClick={() => setResultGroup("verkort_micro")}
            className={`px-3 py-1.5 text-sm font-medium ${
              resultGroup === "verkort_micro"
                ? "bg-slate-800 text-white"
                : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            Verkort + Micro
          </button>
        </div>
      )}

      {activeTable && (
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h4 className="font-semibold text-slate-800">
                {VIEW_ITEMS.find((item) => item.id === view)?.label}
              </h4>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                <span>Gebruikt voor:</span>
                {activeTable.model_scope.map((kind) => (
                  <span
                    key={kind}
                    className="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-1 text-sm font-medium text-slate-700 ring-1 ring-slate-200"
                  >
                    {MODEL_LABELS[kind]}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={saving || loading}
                onClick={() => updateActiveTable(addTableRow(activeTable))}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-3 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50"
              >
                <PlusIcon />
                + Rij
              </button>
              <button
                type="button"
                disabled={saving || loading}
                onClick={() => updateActiveTable(addTableColumn(activeTable))}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-3 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50"
              >
                <PlusIcon />
                + Kolom
              </button>
            </div>
          </div>

          <EditableFinancialTable
            table={activeTable}
            onChange={updateActiveTable}
            disabled={saving || loading}
            editable={true}
            ratioSpecs={ratioSpecs}
          />
        </div>
      )}

      {loading && (
        <p className="text-sm text-slate-600">Configuratie laden…</p>
      )}

      {history.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h4 className="font-semibold text-slate-800">Geschiedenis</h4>
          <p className="mt-1 text-sm text-slate-600">
            Een herstel maakt een nieuwe versie van alle vier de
            tabelconfiguraties; de huidige configuratie wordt eerst bewaard.
          </p>
          <ul className="mt-3 space-y-2">
            {history.slice(0, 20).map((item) => (
              <li
                key={item.version}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <span className="text-slate-700">
                  Versie {item.version}
                  <span className="ml-2 text-slate-500">
                    {formatUpdatedAt(item.updated_at)}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleRestore(item.version)}
                  className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50"
                >
                  Herstellen
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
