"use client";

import { Languages } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import type { AppLocale } from "@/lib/i18n";

export function LanguageToggle({
  variant = "dark",
}: {
  variant?: "dark" | "light";
}) {
  const { locale, setLocale, t } = useLocale();

  function buttonClassName(targetLocale: AppLocale) {
    const active = locale === targetLocale;

    if (variant === "light") {
      return active
        ? "rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white"
        : "rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 transition hover:text-slate-900";
    }

    return active
      ? "rounded-xl bg-[var(--workspace-accent-soft)] px-3 py-2 text-xs font-semibold text-[var(--workspace-text)]"
      : "rounded-xl px-3 py-2 text-xs font-semibold text-[var(--workspace-muted)] transition hover:text-[var(--workspace-text)]";
  }

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-2xl border px-2 py-2 ${
        variant === "light"
          ? "border-slate-200 bg-white/90"
          : "border-white/10 bg-white/[0.04]"
      }`}
      aria-label={t("common.language")}
      title={t("common.language")}
    >
      <Languages
        className={`h-4 w-4 ${variant === "light" ? "text-slate-500" : "text-[var(--workspace-accent)]"}`}
      />
      <button type="button" onClick={() => setLocale("en")} className={buttonClassName("en")}>
        {t("common.english")}
      </button>
      <button type="button" onClick={() => setLocale("es")} className={buttonClassName("es")}>
        {t("common.spanish")}
      </button>
    </div>
  );
}
