/** Deterministic slug for a ratio name. `Current Ratio` → `currentratio`. */
export function slugRatioId(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  return slug || "ratio";
}

/**
 * Unique ID from a name. `taken` is other ratios' IDs (not the current one).
 * Collisions append 2, 3, … — never overwrite another ratio.
 */
export function ratioIdFromName(name: string, taken: Iterable<string>): string {
  const base = slugRatioId(name);
  const used = new Set(taken);
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}${n}`)) n += 1;
  return `${base}${n}`;
}
