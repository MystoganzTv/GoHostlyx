import { redirect } from "next/navigation";
import Link from "next/link";
import { SignInButton } from "@/components/auth-buttons";
import { BrandLogo } from "@/components/brand-logo";
import { EmailAuthForm } from "@/components/email-auth-form";
import { LanguageToggle } from "@/components/language-toggle";
import { getAuthSession, hasAuthSecretConfig, hasGoogleAuthConfig } from "@/lib/auth";
import { getRequestLocale } from "@/lib/server-locale";

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path
        d="M21.8 12.23c0-.75-.07-1.47-.19-2.16H12v4.08h5.5a4.7 4.7 0 0 1-2.04 3.08v2.56h3.3c1.93-1.78 3.04-4.4 3.04-7.56Z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.76 0 5.08-.91 6.78-2.47l-3.3-2.56c-.91.61-2.08.97-3.48.97-2.67 0-4.93-1.8-5.74-4.23H2.84v2.64A10.24 10.24 0 0 0 12 22Z"
        fill="#34A853"
      />
      <path
        d="M6.26 13.71A6.17 6.17 0 0 1 5.94 12c0-.59.11-1.15.31-1.71V7.65H2.84a10.2 10.2 0 0 0 0 8.7l3.42-2.64Z"
        fill="#FBBC05"
      />
      <path
        d="M12 6.06c1.5 0 2.84.52 3.9 1.54l2.92-2.92C17.07 3.05 14.75 2 12 2a10.24 10.24 0 0 0-9.16 5.65l3.42 2.64C7.07 7.86 9.33 6.06 12 6.06Z"
        fill="#EA4335"
      />
    </svg>
  );
}

export default async function LoginPage() {
  const locale = await getRequestLocale();
  const isSpanish = locale === "es";
  const session = await getAuthSession();
  const authReady = hasAuthSecretConfig;
  const googleReady = hasGoogleAuthConfig && authReady;

  if (session?.user?.email) {
    redirect("/onboarding");
  }

  return (
    <main className="login-shell relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:px-6">
      <div className="login-glow absolute left-1/2 top-24 h-72 w-72 -translate-x-1/2 rounded-full blur-3xl" />

      <div className="login-card relative z-[1] w-full max-w-[460px] rounded-[30px] px-6 py-8 sm:px-10 sm:py-10">
        <div className="flex justify-end">
          <LanguageToggle compact />
        </div>

        <div className="flex justify-center">
          <div className="login-brand-orb flex h-20 w-20 items-center justify-center rounded-full">
            <BrandLogo hideWordmark />
          </div>
        </div>

        <div className="mt-6 text-center">
          <h1 className="text-3xl font-semibold tracking-[-0.03em] text-slate-950">
            {isSpanish ? "Bienvenido a GoHostlyx" : "Welcome to GoHostlyx"}
          </h1>
          <p className="mt-2 text-base text-slate-500">{isSpanish ? "Inicia sesión para continuar" : "Sign in to continue"}</p>
        </div>

        <div className="mt-8 space-y-6">
          {googleReady ? (
            <>
              <SignInButton
                icon={<GoogleMark />}
                label={isSpanish ? "Continuar con Google" : "Continue with Google"}
                className="login-google-button flex w-full items-center justify-center gap-3 rounded-[16px] px-5 py-3.5 text-base font-semibold transition"
              />

              <div className="flex items-center gap-4">
                <span className="h-px flex-1 bg-slate-200" />
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {isSpanish ? "o con email" : "or with email"}
                </span>
                <span className="h-px flex-1 bg-slate-200" />
              </div>
            </>
          ) : null}

          {authReady ? <EmailAuthForm /> : null}

          {process.env.NODE_ENV !== "production" && (!authReady || !hasGoogleAuthConfig) ? (
            <div className="rounded-[16px] border border-amber-400/25 bg-amber-400/12 px-4 py-3 text-sm leading-6 text-amber-900">
              Local setup: {!authReady ? "add NEXTAUTH_SECRET to enable sign-in." : "add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable Google sign-in."}
            </div>
          ) : null}
        </div>

        <div className="mt-8 text-center text-sm font-medium text-slate-500">
          <Link href="/" className="transition hover:text-slate-900">
            {isSpanish ? "← Volver al inicio" : "← Back to home"}
          </Link>
        </div>
      </div>
    </main>
  );
}
