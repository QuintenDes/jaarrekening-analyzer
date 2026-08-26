import type { AmountFormat } from "../types";

/** Format bedragen als nl-BE (punt als duizendtallen-scheiding). */
export function formatAmount(
  value: number | null | undefined,
  format: AmountFormat = "full",
): string {
  if (value === null || value === undefined) return "—";
  if (format === "compact") {
    return new Intl.NumberFormat("nl-BE", {
      notation: "compact",
      compactDisplay: "short",
      maximumFractionDigits: 1,
    }).format(value);
  }
  return new Intl.NumberFormat("nl-BE", { maximumFractionDigits: 0 }).format(
    value,
  );
}

/**
 * Format een ratio-waarde volgens de unit uit ratios.yaml:
 * - "%" → twee decimalen + %
 * - "x" → twee decimalen (current ratio e.d.)
 * - "EUR" → afgerond bedrag + " EUR"
 * - anders → twee decimalen
 */
export function formatRatio(value: number | null, unit: string): string {
  if (value === null) return "N/A";
  if (unit === "%") return `${value.toFixed(2)}%`;
  if (unit === "x") return value.toFixed(2);
  if (unit === "EUR") return `${formatAmount(Math.round(value))} EUR`;
  return value.toFixed(2);
}
