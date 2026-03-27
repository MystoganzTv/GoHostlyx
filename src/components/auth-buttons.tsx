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
  const { t } = useLocale();

  return (
    <button
      type="button"
      onClick={() => {
        if (disabled) {
          return;
        }

        void signIn("google", { callbackUrl: "/dashboard" });
      }}
      disabled={disabled}
      className={
        className ??
        "brand-button rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
      }
    >
      {icon}
      {disabled ? t("auth.googleLoginUnavailable") : label ?? t("auth.continueWithGoogle")}
    </button>
  );
}

export function SignOutButton({
  className,
  label,
  icon,
  ariaLabel,
}: {
  className?: string;
  label?: string;
  icon?: ReactNode;
  ariaLabel?: string;
} = {}) {
  const { t } = useLocale();
  const resolvedLabel = label ?? t("nav.signOut");

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
