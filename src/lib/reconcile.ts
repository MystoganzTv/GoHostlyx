import { formatCurrency } from "@/lib/format";
import type { CurrencyCode, DashboardView } from "@/lib/types";

type ReconcileData = NonNullable<DashboardView["reconcile"]>;

function formatSignedCurrency(value: number, currencyCode: CurrencyCode) {
  const absolute = formatCurrency(Math.abs(value), false, currencyCode);
  if (value > 0) {
    return `+${absolute}`;
  }

  if (value < 0) {
    return `-${absolute}`;
  }

  return absolute;
}

export function getReconcileSidebarBadge(
  reconcile: ReconcileData | null,
  currencyCode: CurrencyCode,
) {
  if (!reconcile) {
    return null;
  }

  if (Math.abs(reconcile.difference) >= 1) {
    return {
      label: formatSignedCurrency(reconcile.difference, currencyCode),
      tone: reconcile.difference < 0 ? ("caution" as const) : ("neutral" as const),
    };
  }

  if (reconcile.alertMessage) {
    return {
      label: "Alert",
      tone: "caution" as const,
    };
  }

  return null;
}
