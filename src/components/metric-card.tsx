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
    <article className="workspace-card px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="label-xs">{label}</p>
        {icon ? <span className="workspace-icon-chip [&_svg]:h-4 [&_svg]:w-4">{icon}</span> : null}
      </div>
      <p className="tnum mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--workspace-text)]">
        {formatMetricValue(value, format, currencyCode, locale)}
      </p>
      {helper ? <p className="mt-1.5 text-xs leading-5 text-[var(--workspace-muted)]">{helper}</p> : null}
    </article>
  );
}
