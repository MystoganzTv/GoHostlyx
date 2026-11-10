"use client";

import { useRouter } from "next/navigation";
import { DatabaseZap, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Modal } from "@/components/modal";
import type { ImportSummary } from "@/lib/types";
import { formatDateLabel, formatNumber } from "@/lib/format";
import { getImportedSourceLabel } from "@/lib/workbook";
import { useTranslate } from "@/components/use-translate";

export function ImportsManager({
  importSummaries,
}: {
  importSummaries: ImportSummary[];
}) {
  const t = useTranslate();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importToDelete, setImportToDelete] = useState<ImportSummary | null>(null);

  function confirmDeleteImport() {
    if (!importToDelete?.id) {
      return;
    }

    setMessage(null);
    setError(null);

    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch(`/api/import/${importToDelete.id}`, {
            method: "DELETE",
          });
          const payload = (await response.json()) as { error?: string; message?: string };

          if (!response.ok) {
            setError(payload.error ?? t("The import could not be deleted.", "No se pudo eliminar la importación."));
            return;
          }

          setMessage((payload.message ?? t("Import deleted.", "Importación eliminada.")) + " " + t("You can restore it from Settings → Recently deleted for 7 days.", "Puedes recuperarlo desde Ajustes → Eliminado recientemente durante 7 días."));
          setImportToDelete(null);
          router.refresh();
        } catch {
          setError(t("The import could not be deleted.", "No se pudo eliminar la importación."));
        }
      })();
    });
  }

  if (importSummaries.length === 0) {
    return (
      <div className="workspace-soft-card rounded-lg p-5 text-sm text-[var(--workspace-muted)]">
        {t("No imports yet. When you upload Excel files, GoHostlyx will keep the history here for backup context and traceability.", "Todavía no hay importaciones. Cuando subas archivos, GoHostlyx guardará aquí el historial.")}
      </div>
    );
  }

  return (
    <>
      <div className="min-h-6">
        {message ? <p className="text-sm text-pos">{message}</p> : null}
        {error ? <p className="text-sm text-neg">{error}</p> : null}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-[11px] uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
            <tr>
              <th className="pb-3 pr-4 font-medium">{t("File", "Archivo")}</th>
              <th className="pb-3 pr-4 font-medium">{t("Property", "Propiedad")}</th>
              <th className="pb-3 pr-4 font-medium">{t("Imported", "Importado")}</th>
              <th className="pb-3 pr-4 font-medium">{t("Layer", "Capa")}</th>
              <th className="pb-3 pr-4 font-medium">{t("Impact", "Impacto")}</th>
              <th className="pb-3 font-medium">{t("Action", "Acción")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--workspace-border)] text-[var(--workspace-text)]">
            {importSummaries.map((entry) => (
              <tr key={entry.id}>
                <td className="py-4 pr-4">
                  <div className="flex items-start gap-3">
                    <div className="workspace-icon-chip rounded-lg p-2.5">
                      <DatabaseZap className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{entry.fileName}</p>
                      <p className="mt-1 text-xs text-[var(--workspace-muted)]">
                        {getImportedSourceLabel(entry.importedSource)}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="py-4 pr-4">{entry.propertyName}</td>
                <td className="py-4 pr-4">{formatDateLabel(entry.importedAt.slice(0, 10))}</td>
                <td className="py-4 pr-4">
                  {entry.importedSource === "financial_statement"
                    ? t("Payout statement", "Extracto de payout")
                    : t("Operational rows", "Filas operativas")}
                </td>
                <td className="py-4 pr-4">
                  {entry.importedSource === "financial_statement"
                    ? "1 payout statement"
                    : `${formatNumber(entry.bookingsCount)} bookings · ${formatNumber(entry.expensesCount)} expenses`}
                </td>
                <td className="py-4">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      setMessage(null);
                      setError(null);
                      setImportToDelete(entry);
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-rose-400/25 bg-transparent px-4 py-3 text-sm font-semibold text-rose-300 transition hover:border-rose-400/45 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Trash2 className="h-4 w-4" />
                    {t("Delete", "Eliminar")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={Boolean(importToDelete)}
        title={t("Delete imported workbook", "Eliminar archivo importado")}
        onClose={() => setImportToDelete(null)}
      >
        {importToDelete ? (
          <div className="space-y-5">
            <div className="workspace-soft-card rounded-lg p-4 text-sm leading-6 text-[var(--workspace-muted)]">
              {t("Deleting", "Eliminando")} <span className="font-medium text-[var(--workspace-text)]">{importToDelete.fileName}</span> will remove the import from history and permanently delete{" "}
              {importToDelete.importedSource === "financial_statement"
                ? "the payout statement saved by that batch."
                : "the data that batch created inside GoHostlyx."}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="workspace-soft-card rounded-lg px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{t("Property", "Propiedad")}</p>
                <p className="mt-1 text-sm font-medium text-[var(--workspace-text)]">
                  {importToDelete.propertyName}
                </p>
              </div>
              <div className="workspace-soft-card rounded-lg px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  {importToDelete.importedSource === "financial_statement" ? t("Saved record", "Registro guardado") : t("Bookings to remove", "Reservas que se eliminan")}
                </p>
                <p className="mt-1 text-sm font-medium text-[var(--workspace-text)]">
                  {importToDelete.importedSource === "financial_statement"
                    ? "1 payout statement"
                    : formatNumber(importToDelete.bookingsCount)}
                </p>
              </div>
              <div className="workspace-soft-card rounded-lg px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  {importToDelete.importedSource === "financial_statement" ? t("Expenses to remove", "Gastos que se eliminan") : t("Expenses to remove", "Gastos que se eliminan")}
                </p>
                <p className="mt-1 text-sm font-medium text-[var(--workspace-text)]">
                  {formatNumber(importToDelete.expensesCount)}
                </p>
              </div>
            </div>

            <p className="text-sm text-[var(--workspace-muted)]">
              {t("Manual entries and data from other imports will stay untouched.", "Las entradas manuales y los datos de otras importaciones no se tocan.")}
            </p>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setImportToDelete(null)}
                className="workspace-button-secondary rounded-lg px-3.5 py-2 text-sm font-semibold transition"
              >
                {t("Cancel", "Cancelar")}
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={confirmDeleteImport}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-400/25 bg-transparent px-4 py-3 text-sm font-semibold text-rose-300 transition hover:border-rose-400/45 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" />
                {isPending ? t("Deleting import...", "Eliminando importación...") : t("Delete import", "Eliminar importación")}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
