"use client";

import { Download } from "lucide-react";
import { useTranslate } from "@/components/use-translate";

/** Downloads the whole workspace (bookings, expenses, properties, imports) as Excel. */
export function ExportDataLink({ className = "" }: { className?: string }) {
  const t = useTranslate();

  return (
    <a
      href="/api/export"
      download
      className={`workspace-button-secondary inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition ${className}`}
    >
      <Download className="h-4 w-4" />
      {t("Export data", "Exportar datos")}
    </a>
  );
}
