import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { getRatiosConfig, parseRatiosYaml } from "../api/client";
import type { RatioSpec } from "../types";
import {
  blankRatioSpec,
  downloadRatiosYaml,
  normalizeSpec,
} from "../utils/ratiosYaml";

export const SANDBOX_DRAFT_KEY = "ratioSandboxDraft";
export const SANDBOX_ENABLED_KEY = "ratioSandboxEnabled";

export function loadSandboxEnabled(): boolean {
  return sessionStorage.getItem(SANDBOX_ENABLED_KEY) === "1";
}

export function loadSandboxDraft(): RatioSpec[] | null {
  const raw = sessionStorage.getItem(SANDBOX_DRAFT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as RatioSpec[];
    return Array.isArray(parsed) ? parsed.map((s) => normalizeSpec(s)) : null;
  } catch {
    return null;
  }
}

interface RatioSandboxProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  draft: RatioSpec[];
  onDraftChange: Dispatch<SetStateAction<RatioSpec[]>>;
}

export function RatioSandbox({
  enabled,
  onEnabledChange,
  draft,
  onDraftChange,
}: RatioSandboxProps) {
  const [defaults, setDefaults] = useState<RatioSpec[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importText, setImportText] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const specs = await getRatiosConfig();
        if (cancelled) return;
        const normalized = specs.map((s) => normalizeSpec(s));
        setDefaults(normalized);
        onDraftChange((current) =>
          current.length === 0 ? normalized : current,
        );
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Kon defaults niet laden");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onDraftChange]);

  function updateSpec(index: number, patch: Partial<RatioSpec>) {
    onDraftChange(
      draft.map((spec, i) => (i === index ? normalizeSpec({ ...spec, ...patch }) : spec)),
    );
  }

  function removeSpec(index: number) {
    onDraftChange(draft.filter((_, i) => i !== index));
  }

  function resetToDefaults() {
    if (defaults) onDraftChange(defaults.map((s) => normalizeSpec(s)));
  }

  async function applyImport(yamlText: string) {
    setImporting(true);
    setError(null);
    try {
      const specs = await parseRatiosYaml(yamlText);
      onDraftChange(specs.map((s) => normalizeSpec(s)));
      setShowImport(false);
      setImportText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import mislukt");
    } finally {
      setImporting(false);
    }
  }

  async function handleFileImport(file: File) {
    const text = await file.text();
    await applyImport(text);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        wijzigingen gelden alleen
        voor jouw volgende analyse, niet voor de server-default (
        <code className="font-mono text-xs">ratios.yaml</code>). Exporteer YAML om
        wijzigingen te delen of te committen.
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-800">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => onEnabledChange(event.target.checked)}
            className="size-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />
          Gebruik sandbox bij analyse
        </label>

        <div className="ml-auto flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onDraftChange([...draft, blankRatioSpec()])}
            className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            Toevoegen
          </button>
          <button
            type="button"
            onClick={resetToDefaults}
            disabled={!defaults}
            className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50"
          >
            Reset naar defaults
          </button>
          <button
            type="button"
            onClick={() => downloadRatiosYaml(draft)}
            disabled={draft.length === 0}
            className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50"
          >
            Exporteer YAML
          </button>
          <button
            type="button"
            onClick={() => setShowImport((v) => !v)}
            className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            Importeer YAML
          </button>
        </div>
      </div>

      {showImport && (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-600">
            Plak een <code className="font-mono text-xs">ratios.yaml</code> of kies een
            bestand.
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
              disabled={importing || !importText.trim()}
              onClick={() => applyImport(importText)}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {importing ? "Importeren…" : "Importeer plaksel"}
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
                if (file) void handleFileImport(file);
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

      {loading && draft.length === 0 ? (
        <p className="text-sm text-slate-600">Defaults laden…</p>
      ) : (
        <div className="space-y-3">
          {draft.map((spec, index) => (
            <div
              key={`${spec.id}-${index}`}
              className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              <Field
                label="id"
                value={spec.id}
                onChange={(value) => updateSpec(index, { id: value })}
                mono
              />
              <Field
                label="name"
                value={spec.name}
                onChange={(value) => updateSpec(index, { name: value })}
              />
              <Field
                label="category"
                value={spec.category}
                onChange={(value) => updateSpec(index, { category: value })}
              />
              <Field
                label="numerator"
                value={spec.numerator}
                onChange={(value) => updateSpec(index, { numerator: value })}
                mono
              />
              <Field
                label="denominator"
                value={spec.denominator ?? ""}
                onChange={(value) =>
                  updateSpec(index, { denominator: value.trim() ? value : null })
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
                onChange={(value) => updateSpec(index, { unit: value })}
              />
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => removeSpec(index)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200 hover:bg-red-50"
                >
                  Verwijderen
                </button>
              </div>
            </div>
          ))}
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
