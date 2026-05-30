import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";

export function SubscriptionUpgradeCard({
  title,
  description,
  actionLabel = "Upgrade now",
  href = "/pricing",
}: {
  title: string;
  description: string;
  actionLabel?: string;
  href?: string;
}) {
  return (
    <section className="workspace-card rounded-[32px] p-6 sm:p-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <div className="inline-flex rounded-full border border-amber-300/16 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-100">
            Upgrade required
          </div>
          <h2 className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-[var(--workspace-text)]">
            {title}
          </h2>
          <p className="mt-3 text-sm leading-7 text-[var(--workspace-muted)]">
            {description}
          </p>
        </div>

        <div className="workspace-icon-chip rounded-[20px] p-3">
          <Lock className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link
          href={href}
          className="workspace-button-primary inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition"
        >
          {actionLabel}
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          href="/dashboard/imports"
          className="workspace-button-secondary inline-flex items-center rounded-2xl px-4 py-3 text-sm font-semibold transition"
        >
          View import history
        </Link>
      </div>
    </section>
  );
}
