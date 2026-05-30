"use client";

import type { ReactNode } from "react";
import { signIn, signOut } from "next-auth/react";
import { useLocale } from "@/components/locale-provider";

type SignInButtonProps = {
  disabled?: boolean;
  className?: string;
  icon?: ReactNode;
  label?: string;
};

export function SignInButton({
  disabled = false,
  className,
  icon,
  label,
}: SignInButtonProps) {
  const { locale } = useLocale();
  const isSpanish = locale === "es";

  return (
    <button
      type="button"
      onClick={() => {
        if (disabled) {
          return;
        }

        void signIn("google", { callbackUrl: "/onboarding" });
      }}
      disabled={disabled}
      className={
        className ??
        "brand-button rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
      }
    >
      {icon}
      {disabled
        ? isSpanish
          ? "Google login no configurado"
          : "Google login not configured"
        : label ?? (isSpanish ? "Continuar con Google" : "Continue with Google")}
    </button>
  );
}

export function SignOutButton({
  className,
  label = "Sign out",
  icon,
  ariaLabel,
}: {
  className?: string;
  label?: string;
  icon?: ReactNode;
  ariaLabel?: string;
} = {}) {
  const { locale } = useLocale();
  const resolvedLabel =
    label === "Sign out"
      ? locale === "es"
        ? "Cerrar sesión"
        : "Sign out"
      : label;

  return (
    <button
      type="button"
      onClick={() => void signOut({ callbackUrl: "/" })}
      aria-label={ariaLabel ?? resolvedLabel}
      className={className ?? "brand-button-secondary rounded-2xl px-4 py-3 text-sm font-semibold transition"}
    >
      {icon}
      {resolvedLabel ? <span>{resolvedLabel}</span> : null}
    </button>
  );
}
