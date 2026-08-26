import { nbbGlossaryLabel, normalizeMarCode } from "../i18n/marLabels";

const CODE_RE = /^\d{1,4}(?:\/\d{1,4})?[A-Za-z]?$/;
const TOKEN_RE =
  /(\d{1,4}\/\d{1,4}[A-Za-z]?|\d{1,4}[A-Za-z]?|\(|\)|\+|−|-|\/|÷|\bof\b)/i;

function isCodeToken(value: string): boolean {
  return CODE_RE.test(normalizeMarCode(value));
}

function CodeBadge({ code, showLabel }: { code: string; showLabel: boolean }) {
  const normalized = normalizeMarCode(code);
  const label = showLabel ? nbbGlossaryLabel(normalized) : null;
  return (
    <span className="inline-flex max-w-full flex-wrap items-baseline gap-1">
      <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-medium text-slate-800">
        {normalized}
      </span>
      {label ? (
        <span className="text-[11px] font-normal text-slate-500">{label}</span>
      ) : null}
    </span>
  );
}

function Operator({ value }: { value: string }) {
  const text =
    value === "/" || value === "÷"
      ? "÷"
      : value.toLowerCase() === "of"
        ? "of"
        : value;
  const alternative = text === "of";
  return (
    <span
      className={
        alternative
          ? "px-1 text-[11px] font-medium uppercase tracking-wide text-slate-400"
          : "px-0.5 font-medium text-slate-400"
      }
    >
      {text}
    </span>
  );
}

function ExpressionTokens({
  text,
  showLabels,
}: {
  text: string;
  showLabels: boolean;
}) {
  const pieces = text.split(TOKEN_RE).filter((part) => part !== "");
  return (
    <span className="inline-flex flex-wrap items-center gap-y-1">
      {pieces.map((part, index) => {
        const trimmed = part.trim();
        if (!trimmed) return <span key={index}>{part}</span>;
        if (isCodeToken(trimmed)) {
          return (
            <CodeBadge key={index} code={trimmed} showLabel={showLabels} />
          );
        }
        if (
          trimmed === "+" ||
          trimmed === "-" ||
          trimmed === "−" ||
          trimmed === "/" ||
          trimmed === "÷" ||
          trimmed === "(" ||
          trimmed === ")" ||
          trimmed.toLowerCase() === "of"
        ) {
          return <Operator key={index} value={trimmed} />;
        }
        return (
          <span key={index} className="text-[11px] text-slate-600">
            {part}
          </span>
        );
      })}
    </span>
  );
}

interface FormulaTokensProps {
  formula?: string;
  numerator?: string;
  denominator?: string | null;
  showLabels?: boolean;
  stacked?: boolean;
}

/** Presentation-only formula tokens. Does not change stored formula values. */
export function FormulaTokens({
  formula,
  numerator,
  denominator,
  showLabels = false,
  stacked = true,
}: FormulaTokensProps) {
  let top = numerator?.trim() ?? "";
  let bottom = denominator?.trim() ?? "";
  if (!top && formula) {
    const parts = formula.split(" / ");
    top = parts[0] ?? formula;
    bottom = parts.length > 1 ? parts.slice(1).join(" / ") : "";
  }
  if (!top) {
    return <span className="text-xs text-slate-400">—</span>;
  }
  if (!bottom) {
    return <ExpressionTokens text={top} showLabels={showLabels} />;
  }
  if (stacked) {
    return (
      <div className="inline-flex min-w-0 flex-col items-center text-slate-700">
        <ExpressionTokens text={top} showLabels={showLabels} />
        <span
          className="my-1 w-full min-w-[2rem] border-t border-slate-400"
          aria-hidden="true"
        />
        <ExpressionTokens text={bottom} showLabels={showLabels} />
      </div>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1 gap-y-1">
      <ExpressionTokens text={top} showLabels={showLabels} />
      <Operator value="÷" />
      <ExpressionTokens text={bottom} showLabels={showLabels} />
    </span>
  );
}
