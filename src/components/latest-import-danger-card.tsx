"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertTriangle, History, Trash2 } from "lucide-react";
import { Modal } from "@/components/modal";
import { formatDateLabel, formatNumber } from "@/lib/format";
import type { ImportSummary } from "@/lib/types";
import { getImportedSourceLabel } from "@/lib/workbook";

export function LatestImportDangerCard({
  latestImport,
}: {
  latestImport: ImportSummary | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  function handleDelete() {
    if (!latestImport?.id) {
      return;
    }

    setError(null);
    setMessage(null);

    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch(`/api/import/${latestImport.id}`, {
            method: "DELETE",
          });
          const payload = (await response.json()) as { error?: string; message?: string };

          if (!response.ok) {
            setError(payload.error ?? "The import could not be deleted.");
            return;
          }

          setMessage(payload.message ?? "Import deleted.");
          setIsConfirmOpen(false);
          router.refresh();
        } catch {
          setError("The import could not be deleted.");
        }
      })();
    });
  }

  if (!latestImport) {
    return null;
  }

  const isFinancialStatement = latestImport.importedSource === "financial_statement";

  return (
    <>
      <div className="rounded-[28px] border border-amber-400/18 bg-[linear-gradient(180deg,rgba(244,198,105,0.10),rgba(15,24,38,0.88))] p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/18 bg-amber-300/[0.08] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-100">
              <History className="h-4 w-4" />
              Undo latest import
            </div>
            <h3 className="mt-4 text-xl font-semibold text-[var(--workspace-text)]">
              Need to remove the last file you imported?
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--workspace-muted)]">
              Delete the most recent batch here if the CSV or Excel file was wrong. Hostlyx will remove only the data that came from that import.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setError(null);
              setMessage(null);
              setIsConfirmOpen(true);
            }}
            disabled={isPending}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" />
            {isPending ? "Deleting..." : "Delete latest import"}
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <div className="workspace-soft-card rounded-[22px] px-4 py-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">File</p>
            <p className="mt-2 truncate text-sm font-medium text-[var(--workspace-text)]">{latestImport.fileName}</p>
            <p className="mt-1 text-xs text-[var(--workspace-muted)]">{getImportedSourceLabel(latestImport.importedSource)}</p>
          </div>
          <div className="workspace-soft-card rounded-[22px] px-4 py-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">Property</p>
            <p className="mt-2 text-sm font-medium text-[var(--workspace-text)]">{latestImport.propertyName}</p>
          </div>
          <div className="workspace-soft-card rounded-[22px] px-4 py-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">Imported</p>
            <p className="mt-2 text-sm font-medium text-[var(--workspace-text)]">{formatDateLabel(latestImport.importedAt.slice(0, 10))}</p>
          </div>
          <div className="workspace-soft-card rounded-[22px] px-4 py-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">Data created</p>
            <p className="mt-2 text-sm font-medium text-[var(--workspace-text)]">
              {isFinancialStatement
                ? "1 payout statement"
                : `${formatNumber(latestImport.bookingsCount)} bookings · ${formatNumber(latestImport.expensesCount)} expenses`}
            </p>
          </div>
        </div>

        {message ? <p className="mt-4 text-sm text-emerald-300">{message}</p> : null}
        {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
      </div>

      <Modal
        open={isConfirmOpen}
        title="Delete latest import"
        onClose={() => setIsConfirmOpen(false)}
      >
        <div className="space-y-5">
          <div className="rounded-[22px] border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-700">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <p>
                This will remove <span className="font-semibold text-rose-900">{latestImport.fileName}</span> and delete{" "}
                {isFinancialStatement
                  ? "the payout statement saved from that import batch."
                  : "the bookings and expenses created by that import batch."}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="workspace-soft-card rounded-2xl px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Property</p>
              <p className="mt-1 text-sm font-medium text-[var(--workspace-text)]">{latestImport.propertyName}</p>
            </div>
            <div className="workspace-soft-card rounded-2xl px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Bookings to remove</p>
              <p className="mt-1 text-sm font-medium text-[var(--workspace-text)]">{formatNumber(latestImport.bookingsCount)}</p>
            </div>
            <div className="workspace-soft-card rounded-2xl px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                {isFinancialStatement ? "Statement rows" : "Expenses to remove"}
              </p>
              <p className="mt-1 text-sm font-medium text-[var(--workspace-text)]">{formatNumber(latestImport.expensesCount)}</p>
            </div>
          </div>

          <p className="text-sm text-[var(--workspace-muted)]">
            Manual entries and older imports will stay untouched.
          </p>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setIsConfirmOpen(false)}
              className="workspace-button-secondary rounded-2xl px-4 py-3 text-sm font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={handleDelete}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" />
              {isPending ? "Deleting import..." : "Delete latest import"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
