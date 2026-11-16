import type { ReactNode } from "react";

export type StatStripItem = {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
};

const columnClasses: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
  5: "sm:grid-cols-3 lg:grid-cols-5",
};

export function StatStrip({ items, className = "" }: { items: StatStripItem[]; className?: string }) {
  const columns = columnClasses[items.length] ?? "sm:grid-cols-2 lg:grid-cols-4";

  return (
    <div className={`workspace-card stat-strip grid grid-cols-1 overflow-hidden ${columns} ${className}`}>
      {items.map((item) => (
        <div key={item.label} className="stat-strip-item px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <p className="label-xs">{item.label}</p>
            {item.icon ? <span className="text-[var(--workspace-accent)]">{item.icon}</span> : null}
          </div>
          <p className="tnum mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--workspace-text)]">
            {item.value}
          </p>
          {item.hint ? (
            <p className="mt-1.5 text-xs leading-5 text-[var(--workspace-muted)]">{item.hint}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
