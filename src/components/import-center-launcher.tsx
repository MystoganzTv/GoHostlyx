"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { ArrowUpFromLine } from "lucide-react";
import type { PropertyDefinition } from "@/lib/types";
import { Modal } from "@/components/modal";
import { useLocale } from "@/components/locale-provider";
import { ReconcileStatementLauncher } from "@/components/reconcile-statement-launcher";

// Lazy-load the heavy upload panel: it only renders inside the modal, so it
// should not ship in the initial bundle.
const UploadPanel = dynamic(
  () => import("@/components/upload-panel").then((m) => m.UploadPanel),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center p-10 text-[var(--workspace-muted)]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
      </div>
    ),
  },
);

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
      <button
        type="button"
        onClick={() => setIsUploadOpen(true)}
        className="workspace-button-primary inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition"
      >
        <ArrowUpFromLine className="h-4 w-4" />
        {isSpanish ? "Importar archivo" : "Import file"}
      </button>
      <ReconcileStatementLauncher
        properties={properties}
        buttonLabel={isSpanish ? "Extracto de payout" : "Payout statement"}
        buttonClassName="workspace-button-secondary inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition"
      />

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
              ? "Sube tus archivos de Airbnb, Booking.com o Excel para traer reservas y gastos a GoHostlyx."
              : "Upload your Airbnb, Booking.com, or Excel files to bring bookings and expenses into GoHostlyx."
          }
          onCancel={() => setIsUploadOpen(false)}
        />
      </Modal>
    </>
  );
}
