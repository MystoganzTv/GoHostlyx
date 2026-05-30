import type { ReactNode } from "react";
import { formatMetricValue } from "@/lib/format";
import type { AppLocale } from "@/lib/i18n";
import type { CurrencyCode } from "@/lib/types";

export function MetricCard({
  label,
  value,
  format,
  currencyCode,
  locale = "en",
  helper,
  icon,
}: {
  label: string;
  value: number;
  format: "currency" | "percent" | "number";
  currencyCode: CurrencyCode;
  locale?: AppLocale;
  helper?: string;
  icon?: ReactNode;
}) {
  return (
    <article className="workspace-card rounded-[26px] p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--workspace-muted)]">{label}</p>
          <p className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-[var(--workspace-text)] sm:text-3xl">
            {formatMetricValue(value, format, currencyCode, locale)}
          </p>
        </div>
        {icon ? (
          <div className="workspace-icon-chip rounded-[18px] p-3">
            {icon}
          </div>
        ) : null}
      </div>
      {helper ? <p className="mt-3 text-sm leading-6 text-[var(--workspace-muted)]">{helper}</p> : null}
    </article>
  );
}
