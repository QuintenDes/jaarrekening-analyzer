import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface RowInfoBadgeProps {
  info: string;
  editable: boolean;
  disabled?: boolean;
  onChange?: (value: string) => void;
  rowLabel: string;
}

export function RowInfoBadge({
  info,
  editable,
  disabled,
  onChange,
  rowLabel,
}: RowInfoBadgeProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const hasInfo = info.trim().length > 0;

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const panelWidth = 288;
    const left = Math.min(rect.left, window.innerWidth - panelWidth - 8);
    setPosition({ top: rect.bottom + 6, left: Math.max(8, left) });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (!editable && !hasInfo) {
    return null;
  }

  const panel =
    open &&
    createPortal(
      <div
        id={panelId}
        ref={panelRef}
        role="dialog"
        aria-label={`Informatie ${rowLabel || "rij"}`}
        className="fixed z-[200] w-72 rounded-lg border border-slate-200 bg-white p-2 shadow-xl"
        style={{ top: position.top, left: position.left }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {editable ? (
          <textarea
            value={info}
            disabled={disabled}
            autoFocus
            onChange={(event) => onChange?.(event.target.value)}
            rows={4}
            placeholder="Toelichting bij deze rij…"
            className="w-full resize-y rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          />
        ) : (
          <p className="whitespace-pre-wrap px-1 py-1 text-sm text-slate-700">
            {info}
          </p>
        )}
      </div>,
      document.body,
    );

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-label={
          hasInfo
            ? `Informatie voor ${rowLabel || "rij"}`
            : `Informatie toevoegen voor ${rowLabel || "rij"}`
        }
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        title={hasInfo ? "Informatie bekijken" : "Informatie toevoegen"}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-1 transition ${
          hasInfo
            ? "bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100"
            : "bg-white text-slate-400 ring-slate-200 hover:bg-slate-50 hover:text-slate-600"
        } disabled:opacity-40`}
      >
        i
      </button>
      {panel}
    </>
  );
}
