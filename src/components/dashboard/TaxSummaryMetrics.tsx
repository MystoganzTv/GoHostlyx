"use client";

import { ReceiptText, WalletCards } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import type { CurrencyCode } from "@/lib/types";

export function TaxSummaryMetrics({
  estimatedTaxes,
  profitAfterTax,
  currencyCode,
}: {
  estimatedTaxes: number;
  profitAfterTax: number;
  currencyCode: CurrencyCode;
}) {
  const afterTaxPositive = profitAfterTax >= 0;

  return (
    <div className="grid gap-4 lg:grid-cols-[0.82fr_1.18fr]">
      <div className="workspace-soft-card rounded-[24px] p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
              Set Aside
            </p>
            <p className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-[var(--workspace-text)]">
              {formatCurrency(estimatedTaxes, false, currencyCode)}
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--workspace-muted)]">
              Based on the tax rate in this view.
            </p>
          </div>
          <div className="workspace-icon-chip rounded-2xl p-3">
            <ReceiptText className="h-5 w-5" />
          </div>
        </div>
      </div>

      <div
        className={`workspace-card rounded-[28px] p-6 sm:p-7 ring-1 ${
          afterTaxPositive
            ? "bg-[linear-gradient(180deg,rgba(29,78,60,0.22)_0%,rgba(11,22,38,0.98)_100%)] ring-emerald-300/14"
            : "bg-[linear-gradient(180deg,rgba(120,28,50,0.16)_0%,rgba(11,22,38,0.98)_100%)] ring-rose-300/12"
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
              You Keep
            </p>
            <p
              className={`mt-4 text-5xl font-semibold tracking-[-0.05em] sm:text-6xl ${
                afterTaxPositive ? "text-white" : "text-rose-200"
              }`}
            >
              {formatCurrency(profitAfterTax, false, currencyCode)}
            </p>
            <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300">
              This is roughly what you keep after setting aside estimated taxes.
            </p>
          </div>
          <div
            className={`rounded-2xl p-3 ${
              afterTaxPositive
                ? "bg-emerald-400/14 text-emerald-200"
                : "bg-rose-400/14 text-rose-200"
            }`}
          >
            <WalletCards className="h-5 w-5" />
          </div>
        </div>
      </div>
    </div>
  );
}
