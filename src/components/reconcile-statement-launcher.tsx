"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { ArrowUpFromLine } from "lucide-react";
import { Modal } from "@/components/modal";
import { useLocale } from "@/components/locale-provider";
import type { PropertyDefinition } from "@/lib/types";

// Lazy-load the heavy upload panel; only needed when the modal opens.
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

export function ReconcileStatementLauncher({
  properties,
  buttonLabel = "Import payout statement",
  buttonClassName,
}: {
  properties: PropertyDefinition[];
  buttonLabel?: string;
  buttonClassName?: string;
}) {
  const { locale } = useLocale();
  const isSpanish = locale === "es";
  const [isOpen, setIsOpen] = useState(false);
  const resolvedButtonLabel = buttonLabel === "Import payout statement"
    ? isSpanish
      ? "Importar payout"
      : buttonLabel
    : buttonLabel === "Payout statement"
      ? isSpanish
        ? "Estado de payout"
        : buttonLabel
      : buttonLabel;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={
          buttonClassName ??
          "workspace-button-primary inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition"
        }
      >
        <ArrowUpFromLine className="h-4 w-4" />
        {resolvedButtonLabel}
      </button>

      <Modal
        open={isOpen}
        bare
        alignTop
        onClose={() => setIsOpen(false)}
      >
        <UploadPanel
          properties={properties}
          title={isSpanish ? "Añade un estado de payout" : "Add a payout statement"}
          subtitle={
            isSpanish
              ? "Sube un statement de payout de Airbnb o Booking.com. GoHostlyx lo mantendrá separado de las reservas y lo usará en Payouts."
              : "Upload an Airbnb or Booking.com payout statement. GoHostlyx will keep it separate from bookings and use it in Payouts."
          }
          appearance="compact"
          onCancel={() => setIsOpen(false)}
          onImportComplete={() => setIsOpen(false)}
        />
      </Modal>
    </>
  );
}
