interface MarEmblemProps {
  className?: string;
}

/** Small MAR badge used next to official NBB wording. */
export function MarEmblem({ className = "" }: MarEmblemProps) {
  return (
    <span
      className={`shrink-0 rounded bg-slate-100 px-1 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500 ${className}`.trim()}
    >
      MAR
    </span>
  );
}
