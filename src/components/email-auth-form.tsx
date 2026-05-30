"use client";

import { type FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Lock, Mail, ShieldCheck, UserRound } from "lucide-react";
import { useLocale } from "@/components/locale-provider";

type Mode = "sign-in" | "sign-up";
type Stage = "form" | "verify";

function inputClassName() {
  return "w-full bg-transparent text-base text-slate-700 outline-none placeholder:text-slate-400";
}

export function EmailAuthForm() {
  const { locale } = useLocale();
  const isSpanish = locale === "es";
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [stage, setStage] = useState<Stage>("form");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    startTransition(() => {
      void (async () => {
        try {
          if (mode === "sign-up" && stage === "form") {
            const registerFormData = new FormData();
            registerFormData.set("fullName", fullName);
            registerFormData.set("email", email);
            registerFormData.set("password", password);

            const registerResponse = await fetch("/api/auth/register", {
              method: "POST",
              body: registerFormData,
            });
            const registerPayload = (await registerResponse.json()) as {
              error?: string;
              message?: string;
            };

            if (!registerResponse.ok) {
              setError(registerPayload.error ?? (isSpanish ? "No se pudo crear la cuenta." : "The account could not be created."));
              return;
            }

            setStage("verify");
            setMessage(
              registerPayload.message ??
                (isSpanish
                  ? "Te enviamos un código de verificación a tu email."
                  : "We sent a verification code to your email."),
            );
            return;
          }

          if (mode === "sign-up" && stage === "verify") {
            const verifyFormData = new FormData();
            verifyFormData.set("email", email);
            verifyFormData.set("code", verificationCode);

            const verifyResponse = await fetch("/api/auth/verify", {
              method: "POST",
              body: verifyFormData,
            });
            const verifyPayload = (await verifyResponse.json()) as {
              error?: string;
              message?: string;
            };

            if (!verifyResponse.ok) {
              setError(verifyPayload.error ?? (isSpanish ? "El código de verificación no es válido." : "The verification code is not valid."));
              return;
            }

            setMessage(
              verifyPayload.message ??
                (isSpanish ? "Email verificado. Iniciando sesión ahora." : "Email verified. Signing you in now."),
            );
          }

          const result = await signIn("credentials", {
            email,
            password,
            redirect: false,
            callbackUrl: "/onboarding",
          });

          if (!result || result.error) {
            setError(isSpanish ? "El email o la contraseña no son correctos." : "Email or password is incorrect.");
            setMessage(null);
            return;
          }

          router.push(result.url ?? "/onboarding");
          router.refresh();
        } catch {
          setError(
            mode === "sign-up"
              ? isSpanish
                ? "No se pudo crear la cuenta."
                : "The account could not be created."
              : isSpanish
                ? "No se pudo completar el acceso con email."
                : "Email sign-in could not be completed.",
          );
        }
      })();
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 rounded-[18px] bg-slate-950/5 p-1">
        <button
          type="button"
          onClick={() => {
            setMode("sign-in");
            setStage("form");
            setError(null);
            setMessage(null);
          }}
          className={`rounded-[14px] px-4 py-3 text-sm font-semibold transition ${
            mode === "sign-in"
              ? "bg-slate-950 text-white shadow-[0_10px_24px_rgba(15,23,42,0.12)]"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          {isSpanish ? "Entrar" : "Sign in"}
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("sign-up");
            setStage("form");
            setError(null);
            setMessage(null);
          }}
          className={`rounded-[14px] px-4 py-3 text-sm font-semibold transition ${
            mode === "sign-up"
              ? "bg-slate-950 text-white shadow-[0_10px_24px_rgba(15,23,42,0.12)]"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          {isSpanish ? "Crear cuenta" : "Create account"}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {mode === "sign-up" && stage === "form" ? (
          <div>
            <label className="block text-center text-sm font-semibold text-slate-700">
              {isSpanish ? "Nombre completo" : "Full name"}
            </label>
            <div className="login-input-shell mt-3 flex items-center gap-3 rounded-[18px] px-4 py-4">
              <UserRound className="h-5 w-5 text-slate-400" />
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                autoComplete="name"
                placeholder={isSpanish ? "Tu nombre" : "Your name"}
                className={inputClassName()}
                required
              />
            </div>
          </div>
        ) : null}

        <div>
          <label className="block text-center text-sm font-semibold text-slate-700">
            {isSpanish ? "Email" : "Email"}
          </label>
          <div className="login-input-shell mt-3 flex items-center gap-3 rounded-[18px] px-4 py-4">
            <Mail className="h-5 w-5 text-slate-400" />
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
              className={inputClassName()}
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-center text-sm font-semibold text-slate-700">
            {isSpanish ? "Contraseña" : "Password"}
          </label>
          <div className="login-input-shell mt-3 flex items-center gap-3 rounded-[18px] px-4 py-4">
            <Lock className="h-5 w-5 text-slate-400" />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
              placeholder={
                mode === "sign-up"
                  ? isSpanish
                    ? "Mínimo 8 caracteres"
                    : "At least 8 characters"
                  : isSpanish
                    ? "Escribe tu contraseña"
                    : "Enter your password"
              }
              className={inputClassName()}
              required
            />
          </div>
        </div>

        {mode === "sign-up" && stage === "verify" ? (
          <div>
            <label className="block text-center text-sm font-semibold text-slate-700">
              {isSpanish ? "Código de verificación" : "Verification code"}
            </label>
            <div className="login-input-shell mt-3 flex items-center gap-3 rounded-[18px] px-4 py-4">
              <ShieldCheck className="h-5 w-5 text-slate-400" />
              <input
                value={verificationCode}
                onChange={(event) => setVerificationCode(event.target.value.replace(/[^\d]/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder={isSpanish ? "Código de 6 dígitos" : "6-digit code"}
                className={inputClassName()}
                required
              />
            </div>
            <p className="mt-3 text-center text-sm leading-6 text-slate-500">
              {isSpanish ? "Enviamos un código de 6 dígitos a " : "We sent a 6-digit code to "}
              <span className="font-semibold text-slate-700">{email}</span>.
            </p>
            <button
              type="button"
              onClick={() => {
                setStage("form");
                setVerificationCode("");
                setError(null);
                setMessage(
                  isSpanish
                    ? "Solicita un nuevo código creando la cuenta otra vez."
                    : "Request a new code by creating the account again.",
                );
              }}
              className="mt-3 w-full text-center text-sm font-semibold text-slate-500 transition hover:text-slate-900"
            >
              {isSpanish ? "Usar otro email o reenviar código" : "Use a different email or resend code"}
            </button>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isPending}
          className="login-submit-button flex w-full items-center justify-center gap-3 rounded-[18px] px-5 py-4 text-lg font-semibold text-slate-50 transition disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ShieldCheck className="h-5 w-5" />
          {isPending
            ? mode === "sign-up"
              ? stage === "verify"
                ? isSpanish
                  ? "Verificando..."
                  : "Verifying..."
                : isSpanish
                  ? "Creando cuenta..."
                  : "Creating account..."
              : isSpanish
                ? "Entrando..."
                : "Signing in..."
            : mode === "sign-up"
              ? stage === "verify"
                ? isSpanish
                  ? "Verificar email"
                  : "Verify email"
                : isSpanish
                  ? "Crear cuenta"
                  : "Create account"
              : isSpanish
                ? "Entrar"
                : "Sign in"}
        </button>
      </form>

      <div className="min-h-6 text-center">
        {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
        {error ? <p className="text-sm text-rose-500">{error}</p> : null}
      </div>
    </div>
  );
}
