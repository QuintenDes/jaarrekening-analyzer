import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  categoryKey,
  categoryLabel,
  cloneKeyIds,
  DEFAULT_DASHBOARD_RATIO_COUNT,
  orderedCategories,
  RATIO_CATEGORY_ORDER,
  rewriteKeyIds,
} from "../analysis/keyRatios";
import {
  ApiError,
  getRatiosConfigMeta,
  getRatiosHistory,
  parseRatiosYaml,
  resetRatiosConfig,
  restoreRatiosHistory,
  saveRatiosConfig,
} from "../api/client";
import type { RatioHistoryEntry, RatioSpec, RatiosConfigMeta } from "../types";
import { ratioIdFromName } from "../utils/ratioId";
import {
  blankRatioSpec,
  downloadRatiosYaml,
  normalizeSpec,
} from "../utils/ratiosYaml";
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

function formulaPreview(spec: RatioSpec): string {
  if (spec.denominator) {
    return `${spec.numerator} / ${spec.denominator}`;
  }
  return spec.numerator || "—";
}

function formatUpdatedAt(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("nl-BE");
}

interface RatioConfigPanelProps {
  onLiveConfigApplied?: () => void;
}

export function RatioConfigPanel({ onLiveConfigApplied }: RatioConfigPanelProps) {
  const [adminToken, setAdminToken] = useState(loadAdminToken);
  const [draft, setDraft] = useState<RatioSpec[]>([]);
  const [meta, setMeta] = useState<Pick<RatiosConfigMeta, "source" | "version" | "updated_at"> | null>(
    null,
  );
  const [exported, setExported] = useState<RatioSpec[]>([]);
  const [history, setHistory] = useState<RatioHistoryEntry[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>(
    RATIO_CATEGORY_ORDER[0],
  );
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [dashboardCount, setDashboardCount] = useState(DEFAULT_DASHBOARD_RATIO_COUNT);
  const [keyIds, setKeyIds] = useState<Record<string, string[]>>(() =>
    cloneKeyIds(undefined),
  );
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categories = useMemo(
    () =>
      orderedCategories([
        ...RATIO_CATEGORY_ORDER,
        ...customCategories,
        ...draft.map((spec) => spec.category),
      ]),
    [customCategories, draft],
  );

  const categoryRows = useMemo(
    () =>
      draft
        .map((spec, index) => ({ spec, index }))
        .filter(({ spec }) => categoryKey(spec.category) === activeCategory),
    [activeCategory, draft],
  );

  useEffect(() => {
    if (!categories.includes(activeCategory)) {
      setActiveCategory(categories[0] ?? RATIO_CATEGORY_ORDER[0]);
    }
  }, [activeCategory, categories]);

  function applyServerConfig(config: RatiosConfigMeta) {
    const specs = config.ratios.map((spec) => normalizeSpec(spec));
    setDraft(specs);
    setExported(specs);
    setMeta({
      source: config.source,
      version: config.version,
      updated_at: config.updated_at,
    });
    setDashboardCount(config.dashboard_ratio_count || DEFAULT_DASHBOARD_RATIO_COUNT);
    setKeyIds(cloneKeyIds(config.dashboard_key_ids));
    setCustomCategories(
      orderedCategories(config.categories).filter(
        (category) =>
          !(RATIO_CATEGORY_ORDER as readonly string[]).includes(category),
      ),
    );
  }

  async function loadConfig() {
    setLoading(true);
    setError(null);
    try {
      const config = await getRatiosConfigMeta();
      applyServerConfig(config);
      const items = await getRatiosHistory().catch(() => [] as RatioHistoryEntry[]);
      setHistory(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kon configuratie niet laden.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadConfig();
  }, []);

  function handleTokenChange(value: string) {
    setAdminToken(value);
    persistAdminToken(value);
  }

  function updateSpec(index: number, patch: Partial<RatioSpec>) {
    setDraft((current) => {
      const previous = current[index];
      const nextSpec = normalizeSpec({ ...previous, ...patch });
      if (patch.name !== undefined && patch.name !== previous.name) {
        const taken = current
          .filter((_, i) => i !== index)
          .map((spec) => spec.id);
        nextSpec.id = ratioIdFromName(patch.name, taken);
      }
      if (nextSpec.id !== previous.id) {
        setKeyIds((ids) => rewriteKeyIds(ids, previous.id, nextSpec.id));
      }
      return current.map((spec, i) => (i === index ? nextSpec : spec));
    });
  }

  function moveSpec(index: number, direction: -1 | 1) {
    const indices = categoryRows.map((row) => row.index);
    const position = indices.indexOf(index);
    const target = indices[position + direction];
    if (target === undefined) return;
    setDraft((current) => {
      const next = [...current];
      const from = next[index];
      next[index] = next[target];
      next[target] = from;
      return next;
    });
    setExpanded((current) => {
      if (current === index) return target;
      if (current === target) return index;
      return current;
    });
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

  async function handleSave(
    specs: RatioSpec[] = draft,
    extras?: {
      dashboard_ratio_count?: number;
      categories?: string[];
      dashboard_key_ids?: Record<string, string[]>;
    },
  ) {
    if (!adminToken.trim()) {
      setError("Vul het admin-wachtwoord in om op te slaan.");
      return;
    }
    if (!meta) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await saveRatiosConfig(specs, adminToken.trim(), meta.version, {
        dashboard_ratio_count: extras?.dashboard_ratio_count ?? dashboardCount,
        categories: extras?.categories ?? categories,
        dashboard_key_ids: extras?.dashboard_key_ids ?? keyIds,
      });
      applyServerConfig(saved);
      setHistory(await getRatiosHistory().catch(() => []));
      setNotice("Configuratie opgeslagen.");
      onLiveConfigApplied?.();
    } catch (err) {
      setError(mapWriteError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!adminToken.trim()) {
      setError("Vul het admin-wachtwoord in om te resetten.");
      return;
    }
    if (
      !window.confirm(
        "De actieve configuratie wordt vervangen door de standaard ratios.yaml. Doorgaan?",
      )
    ) {
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await resetRatiosConfig(adminToken.trim());
      applyServerConfig(saved);
      setHistory(await getRatiosHistory().catch(() => []));
      setNotice("Standaardconfiguratie hersteld.");
      onLiveConfigApplied?.();
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
        `Snapshot versie ${version} terugzetten als nieuwe actieve configuratie?`,
      )
    ) {
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await restoreRatiosHistory(version, adminToken.trim());
      applyServerConfig(saved);
      setHistory(await getRatiosHistory().catch(() => []));
      setNotice(`Versie ${version} hersteld als nieuwe configuratie.`);
      onLiveConfigApplied?.();
    } catch (err) {
      setError(mapWriteError(err));
    } finally {
      setSaving(false);
    }
  }

  function addCategory() {
    const key = categoryKey(newCategoryName);
    if (!key) {
      setError("Geef de nieuwe categorie een naam.");
      return;
    }
    setError(null);
    if (!categories.includes(key)) {
      setCustomCategories((current) =>
        orderedCategories([...current, key]).filter(
          (category) =>
            !(RATIO_CATEGORY_ORDER as readonly string[]).includes(category),
        ),
      );
    }
    setActiveCategory(key);
    setAddingCategory(false);
    setNewCategoryName("");
    setExpanded(null);
  }

  async function applyImport(yamlText: string) {
    setError(null);
    setNotice(null);
    try {
      const parsed = await parseRatiosYaml(yamlText);
      const nextCategories = orderedCategories([
        ...RATIO_CATEGORY_ORDER,
        ...parsed.categories,
        ...parsed.ratios.map((spec) => spec.category),
      ]);
      const nextCount =
        parsed.dashboard_ratio_count || DEFAULT_DASHBOARD_RATIO_COUNT;
      const nextKeyIds = cloneKeyIds(
        Object.keys(parsed.dashboard_key_ids).length > 0
          ? parsed.dashboard_key_ids
          : keyIds,
      );
      await handleSave(
        parsed.ratios.map((spec) => normalizeSpec(spec)),
        {
          dashboard_ratio_count: nextCount,
          categories: nextCategories,
          dashboard_key_ids: nextKeyIds,
        },
      );
      setShowImport(false);
      setImportText("");
    } catch (err) {
      setError(mapWriteError(err));
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="font-semibold text-slate-800">Ratio-configuratie</h3>
        <p className="mt-1 text-sm text-slate-600">
          Wijzigingen worden op de server bewaard en gelden voor iedereen.
          Geen Docker-rebuild nodig.
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
            <label className="mt-3 block text-xs font-medium text-slate-600">
              Aantal ratio’s per categorie op het Dashboard
              <input
                type="number"
                min={1}
                value={dashboardCount}
                onChange={(event) => {
                  const n = Number(event.target.value);
                  setDashboardCount(Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1);
                }}
                className="mt-1 w-full max-w-[8rem] rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
              />
            </label>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => handleSave()}
          disabled={saving || loading || draft.length === 0}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {saving ? "Opslaan…" : "Opslaan"}
        </button>
        <button
          type="button"
          onClick={() => void handleReset()}
          disabled={saving || loading}
          className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50"
        >
          Reset naar defaults
        </button>
        <button
          type="button"
          onClick={() =>
            setDraft((current) => [
              ...current,
              blankRatioSpec(
                activeCategory,
                current.map((spec) => spec.id),
              ),
            ])
          }
          disabled={saving}
          className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50"
        >
          Toevoegen
        </button>
        <button
          type="button"
          onClick={() =>
            downloadRatiosYaml(exported, "ratios.yaml", {
              dashboard_ratio_count: dashboardCount,
              categories,
              dashboard_key_ids: keyIds,
            })
          }
          disabled={exported.length === 0}
          className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50"
        >
          Exporteer YAML
        </button>
        <button
          type="button"
          onClick={() => setShowImport((value) => !value)}
          className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
        >
          Importeer YAML
        </button>
      </div>

      {showImport && (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-600">
            Plak een <code className="font-mono text-xs">ratios.yaml</code>. De
            import wordt eerst gevalideerd en daarna opgeslagen.
          </p>
          <textarea
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            rows={8}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs text-slate-800"
            placeholder={"ratios:\n  - id: example\n    name: Example\n    ..."}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving || !importText.trim()}
              onClick={() => void applyImport(importText)}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Importeer en opslaan
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
            >
              Kies bestand
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".yaml,.yml,text/yaml,text/plain"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void file.text().then((text) => applyImport(text));
                event.target.value = "";
              }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {notice}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-600">Configuratie laden…</p>
      ) : (
        <div className="space-y-4">
          <SubTabs
            items={categories.map((category) => ({
              id: category,
              label: categoryLabel(category),
            }))}
            value={activeCategory}
            onChange={(id) => {
              setActiveCategory(id);
              setExpanded(null);
            }}
            trailing={
              <div className="ml-auto flex items-center gap-2 px-1 pb-2">
                {addingCategory ? (
                  <>
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(event) => setNewCategoryName(event.target.value)}
                      placeholder="Naam categorie"
                      className="w-40 rounded-lg border border-slate-200 px-2 py-1 text-sm"
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addCategory();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={addCategory}
                      className="rounded-lg px-2 py-1 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-50"
                    >
                      Opslaan
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAddingCategory(false);
                        setNewCategoryName("");
                      }}
                      className="text-xs text-slate-500 hover:text-slate-800"
                    >
                      Annuleren
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAddingCategory(true)}
                    className="rounded-lg px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                  >
                    Categorie toevoegen
                  </button>
                )}
              </div>
            }
          />
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="max-h-[70vh] overflow-auto">
              {categoryRows.length === 0 ? (
                <p className="px-4 py-6 text-sm text-slate-600">
                  Nog geen ratio’s in {categoryLabel(activeCategory)}. Gebruik
                  Toevoegen om er één te maken.
                </p>
              ) : (
                <table className="min-w-full text-left text-sm">
                  <thead className="sticky top-0 bg-white text-slate-500">
                    <tr className="border-b border-slate-200">
                      <th className="w-14 px-4 py-2 font-medium">Aan</th>
                      <th className="px-4 py-2 font-medium">Naam</th>
                      <th className="px-4 py-2 font-medium">Formule</th>
                      <th className="w-28 px-4 py-2 font-medium">Volgorde</th>
                      <th className="w-40 px-4 py-2 font-medium">Acties</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryRows.map(({ spec, index }, rowIndex) => (
                      <Fragment key={`${spec.id}-${index}`}>
                        <tr className="border-t border-slate-100">
                          <td className="px-4 py-2 align-middle">
                            <input
                              type="checkbox"
                              checked={spec.enabled !== false}
                              onChange={(event) =>
                                updateSpec(index, { enabled: event.target.checked })
                              }
                              className="size-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                              aria-label={`${spec.name} inschakelen`}
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="text"
                              value={spec.name}
                              onChange={(event) =>
                                updateSpec(index, { name: event.target.value })
                              }
                              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-900"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <span className="truncate font-mono text-xs text-slate-800">
                              {formulaPreview(spec)}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => moveSpec(index, -1)}
                                disabled={rowIndex === 0}
                                className="rounded-lg px-2 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40"
                              >
                                Omhoog
                              </button>
                              <button
                                type="button"
                                onClick={() => moveSpec(index, 1)}
                                disabled={rowIndex === categoryRows.length - 1}
                                className="rounded-lg px-2 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40"
                              >
                                Omlaag
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex flex-wrap items-center gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  setExpanded((current) =>
                                    current === index ? null : index,
                                  )
                                }
                                className="rounded-lg px-2 py-1 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-50"
                              >
                                {expanded === index ? "Sluiten" : "Bewerken"}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setDraft((current) =>
                                    current.filter((_, i) => i !== index),
                                  )
                                }
                                className="rounded-lg px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-red-200 hover:bg-red-50"
                              >
                                Verwijderen
                              </button>
                            </div>
                          </td>
                        </tr>
                        {expanded === index && (
                          <tr className="border-t border-slate-100 bg-slate-50">
                            <td colSpan={5} className="px-4 py-3">
                              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                <Field
                                  label="id (automatisch)"
                                  value={spec.id}
                                  onChange={() => undefined}
                                  mono
                                  readOnly
                                />
                                <Field
                                  label="categorie"
                                  value={spec.category}
                                  onChange={(value) =>
                                    updateSpec(index, { category: value })
                                  }
                                />
                                <Field
                                  label="numerator"
                                  value={spec.numerator}
                                  onChange={(value) =>
                                    updateSpec(index, { numerator: value })
                                  }
                                  mono
                                />
                                <Field
                                  label="denominator"
                                  value={spec.denominator ?? ""}
                                  onChange={(value) =>
                                    updateSpec(index, {
                                      denominator: value.trim() ? value : null,
                                    })
                                  }
                                  mono
                                  placeholder="(optioneel)"
                                />
                                <Field
                                  label="multiply"
                                  value={String(spec.multiply ?? 1)}
                                  onChange={(value) => {
                                    const n = Number(value);
                                    updateSpec(index, {
                                      multiply: Number.isFinite(n) ? n : 1,
                                    });
                                  }}
                                  mono
                                />
                                <Field
                                  label="unit"
                                  value={spec.unit ?? ""}
                                  onChange={(value) =>
                                    updateSpec(index, { unit: value })
                                  }
                                />
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h4 className="font-semibold text-slate-800">Geschiedenis</h4>
          <p className="mt-1 text-sm text-slate-600">
            Een herstel maakt een nieuwe versie; de huidige configuratie wordt
            eerst bewaard.
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

function Field({
  label,
  value,
  onChange,
  mono,
  placeholder,
  readOnly,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  mono?: boolean;
  placeholder?: string;
  readOnly?: boolean;
}) {
  return (
    <label className="block text-xs font-medium text-slate-600">
      {label}
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        readOnly={readOnly}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 ${
          mono ? "font-mono" : ""
        } ${readOnly ? "bg-slate-100 text-slate-600" : ""}`}
      />
    </label>
  );
}
