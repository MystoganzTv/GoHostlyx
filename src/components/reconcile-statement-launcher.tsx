"use client";

import { useState } from "react";
import { ArrowUpFromLine } from "lucide-react";
import { Modal } from "@/components/modal";
import { useLocale } from "@/components/locale-provider";
import { UploadPanel } from "@/components/upload-panel";
import type { PropertyDefinition } from "@/lib/types";

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
              ? "Sube un statement de payout de Airbnb o Booking.com. Hostlyx lo mantendrá separado de las reservas y lo usará en Payouts."
              : "Upload an Airbnb or Booking.com payout statement. Hostlyx will keep it separate from bookings and use it in Payouts."
          }
          appearance="compact"
          onCancel={() => setIsOpen(false)}
          onImportComplete={() => setIsOpen(false)}
        />
      </Modal>
    </>
  );
}
