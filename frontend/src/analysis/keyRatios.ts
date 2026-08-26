import type { RatioResult } from "../types";

export const RATIO_CATEGORY_ORDER = [
  "liquiditeit",
  "solvabiliteit",
  "rentabiliteit",
] as const;

export type RatioCategoryId = (typeof RATIO_CATEGORY_ORDER)[number];

export type RatioView = "dashboard" | string;

export const RATIO_VIEWS: { id: RatioView; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "liquiditeit", label: "Liquiditeit" },
  { id: "solvabiliteit", label: "Solvabiliteit" },
  { id: "rentabiliteit", label: "Rentabiliteit" },
];

/** Verified against backend/config/ratios.yaml — existing IDs only. */
export const KEY_RATIO_IDS: Record<string, readonly string[]> = {
  liquiditeit: ["current_ratio", "quick_ratio", "net_working_capital"],
  solvabiliteit: ["solvability", "financial_independence", "debt_ratio"],
  rentabiliteit: ["rev", "rtv", "gross_margin"],
};

export const DEFAULT_DASHBOARD_RATIO_COUNT = 3;

export function ratiosInCategory(
  ratios: RatioResult[],
  category: string,
): RatioResult[] {
  return ratios.filter((ratio) => ratio.category === category);
}

export function categoryKey(value: string): string {
  return value.trim().toLowerCase() || "overig";
}

export function categoryLabel(value: string): string {
  const key = categoryKey(value);
  return key ? key.charAt(0).toUpperCase() + key.slice(1) : key;
}

/** Known YAML categories first, then any extra categories in first-seen order. */
export function orderedCategories(values: Iterable<string>): string[] {
  const seen = new Set<string>();
  const extras: string[] = [];
  for (const value of values) {
    const key = categoryKey(value);
    if (seen.has(key)) continue;
    seen.add(key);
    if (!(RATIO_CATEGORY_ORDER as readonly string[]).includes(key)) {
      extras.push(key);
    }
  }
  return [
    ...RATIO_CATEGORY_ORDER.filter((category) => seen.has(category)),
    ...extras,
  ];
}

export function rewriteKeyIds(
  keyIds: Record<string, string[]>,
  fromId: string,
  toId: string,
): Record<string, string[]> {
  if (fromId === toId) return keyIds;
  const next: Record<string, string[]> = {};
  for (const [category, ids] of Object.entries(keyIds)) {
    next[category] = ids.map((id) => (id === fromId ? toId : id));
  }
  return next;
}

export function cloneKeyIds(
  keyIds: Record<string, readonly string[]> | undefined,
): Record<string, string[]> {
  const source = keyIds && Object.keys(keyIds).length > 0 ? keyIds : KEY_RATIO_IDS;
  const next: Record<string, string[]> = {};
  for (const [category, ids] of Object.entries(source)) {
    next[category] = [...ids];
  }
  return next;
}

/**
 * Dashboard selection: designated key metrics for a category, then fill
 * from remaining items in existing category order up to `limit`.
 */
export function keyRatiosForCategory(
  ratios: RatioResult[],
  category: string,
  limit = DEFAULT_DASHBOARD_RATIO_COUNT,
  preferredIds?: readonly string[],
): RatioResult[] {
  const inCategory = ratiosInCategory(ratios, category);
  const preferred = preferredIds ?? KEY_RATIO_IDS[category] ?? [];
  const selected: RatioResult[] = [];
  const used = new Set<string>();

  for (const id of preferred) {
    const match = inCategory.find((ratio) => ratio.id === id);
    if (!match) continue;
    selected.push(match);
    used.add(match.id);
    if (selected.length >= limit) return selected;
  }

  for (const ratio of inCategory) {
    if (used.has(ratio.id)) continue;
    selected.push(ratio);
    used.add(ratio.id);
    if (selected.length >= limit) break;
  }

  return selected;
}
