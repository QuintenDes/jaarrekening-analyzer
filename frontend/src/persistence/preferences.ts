import type { AmountFormat } from "../types";

export const AMOUNT_FORMAT_KEY = "jaarrekening-amount-format";

export function loadAmountFormat(): AmountFormat {
  const raw = localStorage.getItem(AMOUNT_FORMAT_KEY);
  return raw === "compact" ? "compact" : "full";
}

export function saveAmountFormat(format: AmountFormat) {
  localStorage.setItem(AMOUNT_FORMAT_KEY, format);
}
