import { Fragment, useEffect, useRef, useState } from "react";
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
import {
  blankRatioSpec,
  downloadRatiosYaml,
  normalizeSpec,
} from "../utils/ratiosYaml";

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  function applyServerConfig(config: RatiosConfigMeta) {
    const specs = config.ratios.map((spec) => normalizeSpec(spec));
    setDraft(specs);
    setExported(specs);
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
    setDraft((current) =>
      current.map((spec, i) =>
        i === index ? normalizeSpec({ ...spec, ...patch }) : spec,
      ),
    );
  }

  function moveSpec(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= draft.length) return;
    setDraft((current) => {
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
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

  async function handleSave(specs: RatioSpec[] = draft) {
    if (!adminToken.trim()) {
      setError("Vul het admin-wachtwoord in om op te slaan.");
      return;
    }
    if (!meta) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await saveRatiosConfig(specs, adminToken.trim(), meta.version);
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

  async function applyImport(yamlText: string) {
    setError(null);
    setNotice(null);
    try {
      const specs = await parseRatiosYaml(yamlText);
      await handleSave(specs.map((spec) => normalizeSpec(spec)));
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
          Wijzigingen worden op de server bewaard en gelden voor iedereen zolang
          Sandbox uit staat. Geen Docker-rebuild nodig.
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
          onClick={() => setDraft((current) => [...current, blankRatioSpec()])}
          disabled={saving}
          className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50"
        >
          Toevoegen
        </button>
        <button
          type="button"
          onClick={() => downloadRatiosYaml(exported)}
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
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="max-h-[70vh] overflow-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="sticky top-0 bg-white text-slate-500">
                <tr>
                  <th className="w-14 px-4 py-2 font-medium">Aan</th>
                  <th className="px-4 py-2 font-medium">Naam</th>
                  <th className="w-40 px-4 py-2 font-medium">Categorie</th>
                  <th className="px-4 py-2 font-medium">Formule</th>
                  <th className="w-28 px-4 py-2 font-medium">Volgorde</th>
                  <th className="w-28 px-4 py-2 font-medium">Acties</th>
                </tr>
              </thead>
              <tbody>
                {draft.map((spec, index) => (
                  <Fragment key={`${spec.id}-${index}`}>
                    <tr key={`${spec.id}-${index}`} className="border-t border-slate-100">
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
                        <input
                          type="text"
                          value={spec.category}
                          onChange={(event) =>
                            updateSpec(index, { category: event.target.value })
                          }
                          className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-900"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <button
                          type="button"
                          onClick={() =>
                            setExpanded((current) =>
                              current === index ? null : index,
                            )
                          }
                          className="text-left font-mono text-xs text-slate-600 hover:text-emerald-700"
                        >
                          {formulaPreview(spec)}
                        </button>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => moveSpec(index, -1)}
                            disabled={index === 0}
                            className="rounded-lg px-2 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40"
                          >
                            Omhoog
                          </button>
                          <button
                            type="button"
                            onClick={() => moveSpec(index, 1)}
                            disabled={index === draft.length - 1}
                            className="rounded-lg px-2 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40"
                          >
                            Omlaag
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <button
                          type="button"
                          onClick={() =>
                            setDraft((current) =>
                              current.filter((_, i) => i !== index),
                            )
                          }
                          className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-700 ring-1 ring-red-200 hover:bg-red-50"
                        >
                          Verwijderen
                        </button>
                      </td>
                    </tr>
                    {expanded === index && (
                      <tr className="border-t border-slate-100 bg-slate-50">
                        <td colSpan={6} className="px-4 py-3">
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <Field
                              label="id"
                              value={spec.id}
                              onChange={(value) => updateSpec(index, { id: value })}
                              mono
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  mono?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block text-xs font-medium text-slate-600">
      {label}
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 ${
          mono ? "font-mono" : ""
        }`}
      />
    </label>
  );
}
