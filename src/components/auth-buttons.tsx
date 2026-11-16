"use client";

import { useState, type ReactNode } from "react";
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
  const [isOpeningGoogle, setIsOpeningGoogle] = useState(false);
  const [failedToOpenGoogle, setFailedToOpenGoogle] = useState(false);

  async function handleGoogleSignIn() {
    setIsOpeningGoogle(true);
    setFailedToOpenGoogle(false);

    try {
      await signIn("google", { callbackUrl: "/onboarding" }, { prompt: "select_account" });
    } catch {
      setFailedToOpenGoogle(true);
      setIsOpeningGoogle(false);
    }
  }

  const buttonLabel = isOpeningGoogle
    ? (isSpanish ? "Abriendo Google…" : "Opening Google…")
    : label ?? (isSpanish ? "Continuar con Google" : "Continue with Google");

  return (
    <>
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={disabled || isOpeningGoogle}
        aria-busy={isOpeningGoogle}
        className={
          className ??
          "brand-button rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
        }
      >
        {icon}
        {buttonLabel}
      </button>
      {failedToOpenGoogle ? (
        <p role="alert" className="text-sm text-red-900">
          {isSpanish
            ? "No se pudo abrir Google. Revisa tu conexión e inténtalo otra vez."
            : "Google could not be opened. Check your connection and try again."}
        </p>
      ) : null}
    </>
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
