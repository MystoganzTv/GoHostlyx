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
  variant = "default",
}: {
  compact?: boolean;
  className?: string;
  variant?: "default" | "marketing";
}) {
  const { locale, setLocale } = useLocale();
  const isSpanish = locale === "es";
  const marketing = variant === "marketing";

  function renderOption(nextLocale: AppLocale, label: string) {
    const isActive = locale === nextLocale;

    return (
      <button
        key={nextLocale}
        type="button"
        onClick={() => setLocale(nextLocale)}
        className={
          compact && !marketing
            ? `rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] transition ${
                isActive ? "bg-[var(--workspace-sidebar-active)] text-white" : "text-slate-400 hover:text-white"
              }`
            : `rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${buttonClassName(isActive)}`
        }
        aria-pressed={isActive}
      >
        {label}
      </button>
    );
  }

  return (
    <div
      className={`language-toggle inline-flex items-center ${
        compact && !marketing
          ? "gap-0.5 rounded-md border border-[var(--workspace-sidebar-border)] p-0.5"
          : "gap-1 rounded-full border border-white/10 bg-[rgba(10,18,31,0.82)] p-1 shadow-[0_12px_28px_rgba(2,6,23,0.18)]"
      } ${className}`}
    >
      {!compact ? (
        <span className="inline-flex items-center gap-2 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          <Languages className="h-3.5 w-3.5" />
          {isSpanish ? "Idioma" : "Language"}
        </span>
      ) : marketing ? (
        <span className="language-toggle-icon inline-flex items-center px-2" aria-hidden="true">
          <Languages className="h-3.5 w-3.5" />
        </span>
      ) : null}
      {renderOption("en", "EN")}
      {renderOption("es", "ES")}
    </div>
  );
}
