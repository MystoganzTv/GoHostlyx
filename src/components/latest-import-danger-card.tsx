"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertTriangle, History, Trash2 } from "lucide-react";
import { Modal } from "@/components/modal";
import { formatDateLabel, formatNumber } from "@/lib/format";
import type { ImportSummary } from "@/lib/types";
import { getImportedSourceLabel } from "@/lib/workbook";
import { useTranslate } from "@/components/use-translate";

export function LatestImportDangerCard({
  latestImport,
}: {
  latestImport: ImportSummary | null;
}) {
  const t = useTranslate();
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
            setError(payload.error ?? t("The import could not be deleted.", "No se pudo eliminar la importación."));
            return;
          }

          setMessage((payload.message ?? t("Import deleted.", "Importación eliminada.")) + " " + t("You can restore it from Settings → Recently deleted for 7 days.", "Puedes recuperarlo desde Ajustes → Eliminado recientemente durante 7 días."));
          setIsConfirmOpen(false);
          router.refresh();
        } catch {
          setError(t("The import could not be deleted.", "No se pudo eliminar la importación."));
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
      <div className="rounded-xl border border-amber-400/18 bg-[linear-gradient(180deg,rgba(244,198,105,0.10),rgba(15,24,38,0.88))] p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/18 bg-amber-300/[0.08] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-100">
              <History className="h-4 w-4" />
              {t("Undo latest import", "Deshacer la última importación")}
            </div>
            <h3 className="mt-4 text-xl font-semibold text-[var(--workspace-text)]">
              {t("Need to remove the last file you imported?", "¿Necesitas quitar el último archivo que importaste?")}
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--workspace-muted)]">
              {t("Delete the most recent batch here if the CSV or Excel file was wrong. GoHostlyx will remove only the data that came from that import.", "Borra aquí la última importación si el CSV o Excel estaba mal. GoHostlyx quitará solo los datos que vinieron de ese archivo.")}
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
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-400/25 bg-transparent px-4 py-3 text-sm font-semibold text-rose-300 transition hover:border-rose-400/45 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" />
            {isPending ? "Deleting..." : t("Delete latest import", "Eliminar última importación")}
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <div className="workspace-soft-card rounded-lg px-4 py-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">{t("File", "Archivo")}</p>
            <p className="mt-2 truncate text-sm font-medium text-[var(--workspace-text)]">{latestImport.fileName}</p>
            <p className="mt-1 text-xs text-[var(--workspace-muted)]">{getImportedSourceLabel(latestImport.importedSource)}</p>
          </div>
          <div className="workspace-soft-card rounded-lg px-4 py-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">{t("Property", "Propiedad")}</p>
            <p className="mt-2 text-sm font-medium text-[var(--workspace-text)]">{latestImport.propertyName}</p>
          </div>
          <div className="workspace-soft-card rounded-lg px-4 py-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">{t("Imported", "Importado")}</p>
            <p className="mt-2 text-sm font-medium text-[var(--workspace-text)]">{formatDateLabel(latestImport.importedAt.slice(0, 10))}</p>
          </div>
          <div className="workspace-soft-card rounded-lg px-4 py-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">{t("Data created", "Datos creados")}</p>
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
        title={t("Delete latest import", "Eliminar última importación")}
        onClose={() => setIsConfirmOpen(false)}
      >
        <div className="space-y-5">
          <div className="rounded-lg border border-rose-400/25 bg-rose-500/10 p-4 text-sm leading-6 text-rose-100">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <p>
                {t("This will remove", "Se eliminará")} <span className="font-semibold text-rose-900">{latestImport.fileName}</span> and delete{" "}
                {isFinancialStatement
                  ? "the payout statement saved from that import batch."
                  : "the bookings and expenses created by that import batch."}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="workspace-soft-card rounded-lg px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{t("Property", "Propiedad")}</p>
              <p className="mt-1 text-sm font-medium text-[var(--workspace-text)]">{latestImport.propertyName}</p>
            </div>
            <div className="workspace-soft-card rounded-lg px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{t("Bookings to remove", "Reservas que se eliminan")}</p>
              <p className="mt-1 text-sm font-medium text-[var(--workspace-text)]">{formatNumber(latestImport.bookingsCount)}</p>
            </div>
            <div className="workspace-soft-card rounded-lg px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                {isFinancialStatement ? t("Statement rows", "Filas del extracto") : t("Expenses to remove", "Gastos que se eliminan")}
              </p>
              <p className="mt-1 text-sm font-medium text-[var(--workspace-text)]">{formatNumber(latestImport.expensesCount)}</p>
            </div>
          </div>

          <p className="text-sm text-[var(--workspace-muted)]">
            {t("Manual entries and older imports will stay untouched.", "Las entradas manuales y las importaciones anteriores no se tocan.")}
          </p>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setIsConfirmOpen(false)}
              className="workspace-button-secondary rounded-lg px-3.5 py-2 text-sm font-semibold transition"
            >
              {t("Cancel", "Cancelar")}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={handleDelete}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-400/25 bg-transparent px-4 py-3 text-sm font-semibold text-rose-300 transition hover:border-rose-400/45 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" />
              {isPending ? t("Deleting import...", "Eliminando importación...") : t("Delete latest import", "Eliminar última importación")}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
