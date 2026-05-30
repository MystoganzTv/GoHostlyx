"use client";

import { Languages } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import type { AppLocale } from "@/lib/i18n";

function buttonClassName(active: boolean) {
  return active
    ? "bg-[var(--workspace-accent)] text-slate-950 shadow-[0_12px_28px_rgba(88,196,182,0.28)]"
    : "text-slate-300 hover:bg-white/[0.06] hover:text-white";
}

export function LanguageToggle({
  compact = false,
  className = "",
}: {
  compact?: boolean;
  className?: string;
}) {
  const { locale, setLocale } = useLocale();
  const isSpanish = locale === "es";

  function renderOption(nextLocale: AppLocale, label: string) {
    const isActive = locale === nextLocale;

    return (
      <button
        key={nextLocale}
        type="button"
        onClick={() => setLocale(nextLocale)}
        className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${buttonClassName(isActive)}`}
        aria-pressed={isActive}
      >
        {label}
      </button>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full border border-white/10 bg-[rgba(10,18,31,0.82)] p-1 shadow-[0_12px_28px_rgba(2,6,23,0.18)] ${compact ? "" : ""} ${className}`}
    >
      {!compact ? (
        <span className="inline-flex items-center gap-2 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          <Languages className="h-3.5 w-3.5" />
          {isSpanish ? "Idioma" : "Language"}
        </span>
      ) : (
        <span className="inline-flex items-center px-2 text-slate-400">
          <Languages className="h-3.5 w-3.5" />
        </span>
      )}
      {renderOption("en", "EN")}
      {renderOption("es", "ES")}
    </div>
  );
}
