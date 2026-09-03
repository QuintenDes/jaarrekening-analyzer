import type { ReactNode } from "react";
import { ChevronIcon } from "./icons";

interface ConfigPanelHeaderProps {
  title: string;
  summary: string;
  meta?: string;
  dirty?: boolean;
  helpOpen: boolean;
  onHelpToggle: () => void;
  helpContent?: ReactNode;
  toolbar?: ReactNode;
  adminToken?: string;
  onAdminTokenChange?: (value: string) => void;
  showInlineAdmin?: boolean;
}

export function ConfigPanelHeader({
  title,
  summary,
  meta,
  dirty,
  helpOpen,
  onHelpToggle,
  helpContent,
  toolbar,
  adminToken,
  onAdminTokenChange,
  showInlineAdmin = true,
}: ConfigPanelHeaderProps) {
  const showToolbarRow =
    toolbar ||
    (showInlineAdmin &&
      !helpOpen &&
      adminToken !== undefined &&
      onAdminTokenChange);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 p-3">
        <div className="min-w-0 space-y-1">
          <h3 className="font-semibold text-slate-800">{title}</h3>
          <p className="text-sm text-slate-500">
            {summary}
            {meta ? <span className="text-slate-400"> {meta}</span> : null}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {dirty && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              Niet opgeslagen
            </span>
          )}
          {helpContent && (
            <button
              type="button"
              onClick={onHelpToggle}
              aria-expanded={helpOpen}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            >
              <ChevronIcon open={helpOpen} className="h-3.5 w-3.5" />
              Uitleg
            </button>
          )}
        </div>
      </div>

      {helpOpen && helpContent && (
        <div className="border-t border-slate-100 px-3 pb-3 pt-2 text-sm text-slate-600">
          {helpContent}
        </div>
      )}

      {showToolbarRow && (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-3 py-2">
          {toolbar}
          {showInlineAdmin &&
            !helpOpen &&
            adminToken !== undefined &&
            onAdminTokenChange && (
              <label className="ml-auto flex min-w-[10rem] max-w-xs flex-1 items-center gap-2 text-xs text-slate-500 sm:flex-none">
                <span className="shrink-0">Admin</span>
                <input
                  type="password"
                  value={adminToken}
                  autoComplete="off"
                  onChange={(event) => onAdminTokenChange(event.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-900"
                />
              </label>
            )}
        </div>
      )}
    </div>
  );
}
