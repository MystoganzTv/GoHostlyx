"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUpFromLine } from "lucide-react";
import { Modal } from "@/components/modal";
import { UploadPanel } from "@/components/upload-panel";
import { useLocale } from "@/components/locale-provider";
import type { PropertyDefinition } from "@/lib/types";

type OperationalImportContext = "bookings" | "expenses";
const rangeFilterStorageKey = "hostlyx:filters:range";

function getContextCopy(context: OperationalImportContext, isSpanish: boolean) {
  if (context === "bookings") {
    return {
      buttonLabel: isSpanish ? "Importar reservas" : "Import bookings",
      title: isSpanish ? "Importa tus reservas" : "Import your bookings",
      subtitle: isSpanish
        ? "Sube exports de reservas de Airbnb, Booking.com o Excel. Si el archivo también trae gastos, Hostlyx los enrutará al lugar correcto."
        : "Upload Airbnb, Booking.com, or Excel booking exports. If the file also carries expenses, Hostlyx will route them to the right place.",
    };
  }

  return {
    buttonLabel: isSpanish ? "Importar gastos" : "Import expenses",
    title: isSpanish ? "Importa tus gastos" : "Import your expenses",
    subtitle: isSpanish
      ? "Sube tu archivo de gastos o un workbook mixto. Hostlyx separará los gastos y mantendrá las reservas en su capa operativa."
      : "Upload your expense file or a mixed workbook. Hostlyx will separate the expenses and keep bookings in their operating layer.",
  };
}

export function OperationalImportLauncher({
  properties,
  context,
  buttonClassName,
}: {
  properties: PropertyDefinition[];
  context: OperationalImportContext;
  buttonClassName?: string;
}) {
  const { locale } = useLocale();
  const isSpanish = locale === "es";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const copy = getContextCopy(context, isSpanish);

  function resetRangeToAllTime() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("year");
    params.delete("month");
    params.set("range", "all-time");
    params.delete("start");
    params.delete("end");
    params.delete("review");

    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        rangeFilterStorageKey,
        JSON.stringify({
          range: "all-time",
          start: "",
          end: "",
          channel: params.get("channel") ?? "all",
          country: params.get("country") ?? "all",
        }),
      );
    }

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

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
        {copy.buttonLabel}
      </button>

      <Modal
        open={isOpen}
        bare
        alignTop
        onClose={() => setIsOpen(false)}
      >
        <UploadPanel
          properties={properties}
          title={copy.title}
          subtitle={copy.subtitle}
          appearance="compact"
          onCancel={() => setIsOpen(false)}
          onImportComplete={(payload) => {
            resetRangeToAllTime();

            if (context === "bookings" && payload.reviewBookingsImported > 0) {
              const params = new URLSearchParams(searchParams.toString());
              params.delete("year");
              params.delete("month");
              params.set("range", "all-time");
              params.delete("start");
              params.delete("end");
              params.set("review", "needs-review");
              const query = params.toString();
              router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
            }

            setIsOpen(false);
          }}
        />
      </Modal>
    </>
  );
}
