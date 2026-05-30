"use client";

import { useState } from "react";
import { ArrowUpFromLine } from "lucide-react";
import type { PropertyDefinition } from "@/lib/types";
import { Modal } from "@/components/modal";
import { useLocale } from "@/components/locale-provider";
import { ReconcileStatementLauncher } from "@/components/reconcile-statement-launcher";
import { SectionCard } from "@/components/section-card";
import { UploadPanel } from "@/components/upload-panel";

export function ImportCenterLauncher({
  properties,
}: {
  properties: PropertyDefinition[];
}) {
  const { locale } = useLocale();
  const isSpanish = locale === "es";
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  return (
    <>
      <SectionCard
        title={isSpanish ? "Trae tus datos" : "Bring your data"}
        subtitle={
          isSpanish
            ? "Si ya estás aquí, puedes importar desde este modal. Pero para CSVs de reservas o archivos de gastos, la entrada principal ahora vive en sus páginas respectivas."
            : "If you are already here, you can still import from this modal. But for booking CSVs or expense files, the main entry point now lives on their respective pages."
        }
        action={
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setIsUploadOpen(true)}
              className="workspace-button-primary inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition"
            >
              <ArrowUpFromLine className="h-4 w-4" />
              {isSpanish ? "Importar desde aquí" : "Import from here"}
            </button>
            <ReconcileStatementLauncher
              properties={properties}
              buttonLabel={isSpanish ? "Estado de payout" : "Payout statement"}
              buttonClassName="workspace-button-secondary inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition"
            />
          </div>
        }
      >
        <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
          <div className="workspace-soft-card rounded-[24px] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
              {isSpanish ? "Flujo enfocado" : "Focused flow"}
            </p>
            <p className="mt-3 text-base font-medium text-[var(--workspace-text)]">
              {isSpanish ? "Este lugar ya es más back-office que punto de entrada principal." : "This area is now more back-office than primary entry point."}
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--workspace-muted)]">
              {isSpanish
                ? "Usa Reservas para CSVs operativos, Gastos para costes y este centro para revisar historial, borrar imports por error o lanzar un import genérico si ya estabas trabajando aquí."
                : "Use Bookings for operational CSVs, Expenses for cost files, and this center to review history, delete mistaken imports, or launch a generic import if you are already working here."}
            </p>
          </div>

          <div className="workspace-soft-card rounded-[24px] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
              {isSpanish ? "Compatible" : "Supported"}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                isSpanish ? "Reservas Airbnb" : "Airbnb bookings",
                isSpanish ? "Reservas Booking.com" : "Booking.com bookings",
                "Hostlyx Excel",
                isSpanish ? "Statements de payout" : "Payout statements",
              ].map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-[var(--workspace-border)] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-[var(--workspace-muted)]"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>

      <Modal
        open={isUploadOpen}
        bare
        alignTop
        onClose={() => setIsUploadOpen(false)}
      >
        <UploadPanel
          properties={properties}
          title={isSpanish ? "Importa reservas o gastos" : "Import bookings or expenses"}
          subtitle={
            isSpanish
              ? "Sube tus archivos de Airbnb, Booking.com o Excel para traer reservas y gastos a Hostlyx."
              : "Upload your Airbnb, Booking.com, or Excel files to bring bookings and expenses into Hostlyx."
          }
          onCancel={() => setIsUploadOpen(false)}
        />
      </Modal>
    </>
  );
}
