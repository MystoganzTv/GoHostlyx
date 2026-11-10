import type { ReactNode } from "react";

export function SectionCard({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`workspace-card section-card overflow-hidden ${className}`}>
      <header className="section-card-head flex flex-col gap-3 border-b border-[var(--workspace-border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight text-[var(--workspace-text)]">{title}</h2>
          {subtitle ? (
            <p className="mt-0.5 max-w-3xl text-xs leading-5 text-[var(--workspace-muted)]">{subtitle}</p>
          ) : null}
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </header>
      <div className="section-card-body px-5 py-5">{children}</div>
    </section>
  );
}
