"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import { SectionCard } from "@/components/section-card";
import { formatDateLabel } from "@/lib/format";
import type { DeletedItem } from "@/lib/trash";

const kindLabels: Record<DeletedItem["kind"], { en: string; es: string }> = {
  property: { en: "Property", es: "Propiedad" },
  import: { en: "Import", es: "Importación" },
  booking: { en: "Booking", es: "Reserva" },
  expense: { en: "Expense", es: "Gasto" },
};

export function RecentlyDeletedPanel({ items }: { items: DeletedItem[] }) {
  const router = useRouter();
  const { locale } = useLocale();
  const isSpanish = locale === "es";
  const [isPending, startTransition] = useTransition();
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function restore(item: DeletedItem) {
    setMessage(null);
    setError(null);
    setRestoringId(item.id);

    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch(`/api/deleted/${item.id}/restore`, { method: "POST" });
          const payload = (await response.json()) as { error?: string; message?: string };

          if (!response.ok) {
            setError(payload.error ?? (isSpanish ? "No se pudo recuperar el elemento." : "The item could not be restored."));
            return;
          }

          setMessage(payload.message ?? null);
          router.refresh();
        } catch {
          setError(isSpanish ? "No se pudo recuperar el elemento." : "The item could not be restored.");
        } finally {
          setRestoringId(null);
        }
      })();
    });
  }

  return (
    <SectionCard
      title={isSpanish ? "Eliminado recientemente" : "Recently deleted"}
      subtitle={
        isSpanish
          ? "Lo que borres se guarda aquí 7 días y puedes recuperarlo tal como estaba."
          : "Anything you delete stays here for 7 days and can be restored as it was."
      }
    >
      {message ? <p className="mb-3 text-sm text-pos">{message}</p> : null}
      {error ? <p className="mb-3 text-sm text-neg">{error}</p> : null}

      {items.length === 0 ? (
        <p className="text-sm text-[var(--workspace-muted)]">
          {isSpanish ? "No has borrado nada en los últimos 7 días." : "Nothing deleted in the last 7 days."}
        </p>
      ) : (
        <ul className="-my-3 divide-y divide-[var(--workspace-border)]">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--workspace-text)]">{item.label}</p>
                <p className="mt-0.5 text-xs text-[var(--workspace-muted)]">
                  {kindLabels[item.kind][locale]} · {isSpanish ? "borrado el" : "deleted"}{" "}
                  {formatDateLabel(item.deletedAt.slice(0, 10), locale)} ·{" "}
                  {isSpanish
                    ? `${item.rowCount} ${item.rowCount === 1 ? "registro" : "registros"}`
                    : `${item.rowCount} ${item.rowCount === 1 ? "record" : "records"}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => restore(item)}
                disabled={isPending}
                className="workspace-button-secondary inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition disabled:opacity-60"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {restoringId === item.id
                  ? isSpanish
                    ? "Recuperando..."
                    : "Restoring..."
                  : isSpanish
                    ? "Recuperar"
                    : "Restore"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
