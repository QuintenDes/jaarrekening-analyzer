import type { StatementLine } from "../types";

/** Parsed MAR code span used for nesting (e.g. 21/28, 290, 14P). */
interface MarSpan {
  lo: number;
  hi: number;
  digitBase: string;
  endDigits: string;
  isRange: boolean;
  raw: string;
}

export interface LineDepth {
  depth: number;
  isGroup: boolean;
}

/** Expand abbreviated range ends: 490/1 → 491, 130/1 → 131, 21/28 → 28. */
function abbreviateEnd(start: string, end: string): string {
  if (end.length >= start.length) return end;
  return start.slice(0, start.length - end.length) + end;
}

function parseMarCode(code: string): MarSpan | null {
  const match = code.trim().match(/^(\d+)(?:\/(\d+))?([A-Za-z]?)$/);
  if (!match) return null;

  const start = match[1];
  const endRaw = match[2];
  if (endRaw !== undefined) {
    const endDigits = abbreviateEnd(start, endRaw);
    const lo = Number.parseInt(start, 10);
    const hi = Number.parseInt(endDigits, 10);
    return {
      lo: Math.min(lo, hi),
      hi: Math.max(lo, hi),
      digitBase: start,
      endDigits,
      isRange: true,
      raw: code,
    };
  }

  const n = Number.parseInt(start, 10);
  return {
    lo: n,
    hi: n,
    digitBase: start,
    endDigits: start,
    isRange: false,
    raw: code,
  };
}

/**
 * Map a digit string onto the magnitude of a range bound.
 * Longer codes use a prefix (290 → 29 vs bounds 29–58);
 * shorter class codes expand to their decade (3 → 30–39).
 */
function toBoundLevel(digits: string, boundLen: number, pad: "0" | "9"): number {
  if (digits.length >= boundLen) {
    return Number.parseInt(digits.slice(0, boundLen), 10);
  }
  return Number.parseInt(digits.padEnd(boundLen, pad), 10);
}

function fallsInRange(child: MarSpan, lo: number, hi: number): boolean {
  const boundLen = Math.max(String(lo).length, String(hi).length);
  const cLo = toBoundLevel(child.digitBase, boundLen, "0");
  const cHi = child.isRange
    ? toBoundLevel(child.endDigits, boundLen, "9")
    : child.digitBase.length < boundLen
      ? toBoundLevel(child.digitBase, boundLen, "9")
      : cLo;

  return cLo >= lo && cHi <= hi;
}

function isNestedUnder(child: MarSpan, parent: MarSpan): boolean {
  if (child.raw === parent.raw) return false;

  // Prefix nesting: 29 → 290, 10 → 110, 13 → 130
  if (
    child.digitBase.startsWith(parent.digitBase) &&
    child.digitBase.length > parent.digitBase.length
  ) {
    return true;
  }

  // Range / class containment (21/28 → 22/27 → 22; 29/58 → 3 → 30/36)
  if (parent.isRange || parent.digitBase.length === 1) {
    return fallsInRange(child, parent.lo, parent.hi);
  }

  return false;
}

function isAllCapsLabel(label: string): boolean {
  const letters = label.replace(/[^A-Za-zÀ-ÿ]/g, "");
  return letters.length >= 3 && letters === letters.toUpperCase();
}

/**
 * Assign visual hierarchy depth for a flat NBB statement list.
 * Nesting follows MAR ranges/prefixes in document order (same as the PDF).
 */
export function assignLineDepths(lines: StatementLine[]): LineDepth[] {
  const depths: number[] = Array.from({ length: lines.length }, () => 0);
  const hasChildren: boolean[] = Array.from({ length: lines.length }, () => false);
  const stack: { span: MarSpan; index: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const span = parseMarCode(lines[i].code);
    if (!span) {
      depths[i] = stack.length;
      continue;
    }

    while (stack.length > 0 && !isNestedUnder(span, stack[stack.length - 1].span)) {
      stack.pop();
    }

    depths[i] = stack.length;
    if (stack.length > 0) {
      hasChildren[stack[stack.length - 1].index] = true;
    }
    stack.push({ span, index: i });
  }

  return lines.map((line, i) => {
    const span = parseMarCode(line.code);
    const isGroup =
      hasChildren[i] ||
      (span?.isRange ?? false) ||
      isAllCapsLabel(line.label) ||
      /^TOTAAL\b/i.test(line.label);

    return { depth: depths[i], isGroup };
  });
}
