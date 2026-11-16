"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FileOutput } from "lucide-react";
import { useTranslate } from "@/components/use-translate";

export function ExportReportLink({
  className,
  target = "_blank",
  label,
}: {
  className: string;
  target?: "_self" | "_blank";
  label?: string;
}) {
  const t = useTranslate();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const href = query ? `/dashboard/reports/share?${query}` : "/dashboard/reports/share";

  return (
    <Link
      href={href}
      target={target}
      prefetch={false}
      className={`inline-flex items-center justify-center gap-2.5 whitespace-nowrap leading-none ${className}`}
      rel={target === "_blank" ? "noreferrer" : undefined}
    >
      <FileOutput className="h-[18px] w-[18px] shrink-0 opacity-95" />
      <span>{label ?? t("Export report", "Exportar informe")}</span>
    </Link>
  );
}
