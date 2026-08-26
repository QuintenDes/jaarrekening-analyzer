import type { ReactNode } from "react";

interface SubTabItem<T extends string> {
  id: T;
  label: string;
}

interface SubTabsProps<T extends string> {
  items: SubTabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  trailing?: ReactNode;
}

/** Secondary navigation under a main tab — underline only as wide as the tabs. */
export function SubTabs<T extends string>({
  items,
  value,
  onChange,
  trailing,
}: SubTabsProps<T>) {
  return (
    <div className="flex flex-wrap items-end gap-x-3">
      <div className="inline-flex w-fit max-w-full flex-wrap items-end border-b border-slate-200">
        {items.map((item) => {
          const active = value === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm transition ${
                active
                  ? "border-emerald-600 font-medium text-emerald-800"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {trailing}
    </div>
  );
}
