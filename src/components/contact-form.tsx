"use client";

import { FormEvent, useState } from "react";
import { Clock3, LoaderCircle, Mail, MessageSquareText, Send, ShieldCheck } from "lucide-react";
import { useLocale } from "@/components/locale-provider";

type ContactFormState = "idle" | "submitting" | "success" | "error";

function inputClassName() {
  return "input-surface w-full rounded-2xl px-4 py-3.5 text-sm";
}

export function ContactForm() {
  const { locale } = useLocale();
  const isSpanish = locale === "es";
  const [status, setStatus] = useState<ContactFormState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const topicOptions = isSpanish
    ? ["Facturación", "Pregunta del dashboard", "Problema de importación", "Compartir informe", "Partnership", "Otro"]
    : ["Billing", "Dashboard question", "Import issue", "Report sharing", "Partnership", "Other"];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setErrorMessage("");

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      name: String(formData.get("name") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim(),
      topic: String(formData.get("topic") ?? "").trim(),
      workspace: String(formData.get("workspace") ?? "").trim(),
      message: String(formData.get("message") ?? "").trim(),
      company: String(formData.get("company") ?? "").trim(),
    };

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json().catch(() => null)) as
        | { error?: string; ok?: boolean }
        | null;

      if (!response.ok) {
        throw new Error(
          result?.error ??
            (isSpanish
              ? "Hostlyx no pudo enviar tu mensaje ahora mismo."
              : "Hostlyx could not send your message right now."),
        );
      }

      form.reset();
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : isSpanish
            ? "Hostlyx no pudo enviar tu mensaje ahora mismo."
            : "Hostlyx could not send your message right now.",
      );
    }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
      <div className="workspace-card relative overflow-hidden rounded-[30px] p-6 sm:p-8">
        <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(88,196,182,0.16)_0%,rgba(88,196,182,0.02)_68%,transparent_74%)]" />

        <div className="relative max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--workspace-accent)]/20 bg-[var(--workspace-accent)]/10 px-3 py-1.5">
            <MessageSquareText className="h-3.5 w-3.5 text-[var(--workspace-accent)]" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-text)]">
              {isSpanish ? "Contactar con Hostlyx" : "Contact Hostlyx"}
            </p>
          </div>

          <h2 className="mt-5 text-[2rem] font-semibold tracking-[-0.05em] text-slate-100 sm:text-[2.35rem]">
            {isSpanish ? "Cuéntanos qué necesitas." : "Tell us what you need."}
          </h2>
          <p className="mt-4 max-w-xl text-[15px] leading-8 text-slate-300">
            {isSpanish
              ? "Escríbenos por facturación, importaciones, dudas del dashboard, partnerships o cualquier otra cosa relacionada con tu workspace de Hostlyx."
              : "Reach out for billing, imports, dashboard questions, partnerships, or anything else related to your Hostlyx workspace."}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-slate-300">
              <Clock3 className="h-3.5 w-3.5 text-[var(--workspace-accent)]" />
              {isSpanish ? "Respuesta habitual en 1 día laborable" : "Typical reply within 1 business day"}
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-slate-300">
              <ShieldCheck className="h-3.5 w-3.5 text-[var(--workspace-accent)]" />
              {isSpanish ? "Ideal para soporte y facturación" : "Best for support and billing"}
            </div>
          </div>
        </div>

        <form className="relative mt-8 grid gap-5" onSubmit={handleSubmit}>
          <input
            type="text"
            name="company"
            tabIndex={-1}
            autoComplete="off"
            className="hidden"
            aria-hidden="true"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                {isSpanish ? "Nombre" : "Name"}
              </span>
              <input className={inputClassName()} name="name" placeholder={isSpanish ? "Tu nombre" : "Your name"} required />
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                Email
              </span>
              <input
                className={inputClassName()}
                name="email"
                type="email"
                placeholder="you@example.com"
                required
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                {isSpanish ? "Tema" : "Topic"}
              </span>
              <select className={inputClassName()} name="topic" defaultValue={topicOptions[0]} required>
                {topicOptions.map((option) => (
                  <option key={option} value={option} className="bg-slate-950 text-slate-100">
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                {isSpanish ? "Workspace o email de la cuenta" : "Workspace or account email"}
              </span>
              <input
                className={inputClassName()}
                name="workspace"
                placeholder={isSpanish ? "Contexto opcional" : "Optional context"}
              />
            </label>
          </div>

          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
              {isSpanish ? "Mensaje" : "Message"}
            </span>
            <textarea
              className={`${inputClassName()} min-h-[180px] resize-y py-4`}
              name="message"
              placeholder={isSpanish ? "Cuéntanos qué está pasando." : "Tell us what is going on."}
              required
            />
          </label>

          <div className="grid gap-4 border-t border-white/8 pt-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="rounded-[22px] border border-white/6 bg-white/[0.025] px-4 py-3 text-sm leading-6 text-slate-400">
              {status === "success" ? (
                <p className="font-medium text-emerald-200">
                  {isSpanish ? "Mensaje enviado. Responderemos lo antes posible." : "Message sent. We will reply as soon as possible."}
                </p>
              ) : status === "error" ? (
                <p className="font-medium text-amber-100">{errorMessage}</p>
              ) : (
                <p>{isSpanish ? "Las solicitudes de soporte se gestionan por email para que la conversación sea fácil de seguir." : "Support requests are handled by email so the conversation stays easy to track."}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={status === "submitting"}
              className="workspace-button-primary inline-flex min-h-[54px] items-center justify-center gap-2 self-start whitespace-nowrap rounded-2xl px-6 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 lg:self-center"
            >
              {status === "submitting" ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  {isSpanish ? "Enviando" : "Sending"}
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  {isSpanish ? "Enviar mensaje" : "Send message"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      <div className="space-y-4">
        <article className="workspace-soft-card rounded-[28px] p-6">
          <div className="flex items-start gap-4">
            <div className="brand-icon rounded-[18px] p-3">
              <Mail className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent-text)]">
                {isSpanish ? "Email directo" : "Direct email"}
              </p>
              <p className="mt-3 text-xl font-semibold tracking-[-0.03em] text-slate-100">
                hello@hostlyx.com
              </p>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                {isSpanish ? "¿Prefieres ir directo al inbox? También puedes escribirnos directamente." : "Prefer inbox-to-inbox? You can still contact us directly."}
              </p>
            </div>
          </div>
        </article>

        <article className="workspace-soft-card rounded-[28px] p-6">
          <div className="flex items-start gap-4">
            <div className="brand-icon rounded-[18px] p-3">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent-text)]">
                {isSpanish ? "Qué ayuda más" : "What helps most"}
              </p>
              <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-300">
                <li>{isSpanish ? "Incluye el email de la cuenta vinculada a tu workspace." : "Include the account email tied to your workspace."}</li>
                <li>{isSpanish ? "Aclara si es facturación, importaciones, reporting o feedback de producto." : "Mention whether it is billing, imports, reporting, or product feedback."}</li>
                <li>{isSpanish ? "Añade capturas o nombres de archivo cuando ayuden a explicar el problema." : "Add screenshots or file names when they help explain the issue."}</li>
              </ul>
            </div>
          </div>
        </article>

        <article className="workspace-soft-card rounded-[28px] p-6">
          <div className="flex items-start gap-4">
            <div className="brand-icon rounded-[18px] p-3">
              <Clock3 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent-text)]">
                {isSpanish ? "Flujo de soporte" : "Support flow"}
              </p>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                {isSpanish
                  ? "Los mensajes llegan por email para que facturación, incidencias de importación y seguimientos queden en un solo sitio."
                  : "Messages arrive by email so billing threads, import issues, and follow-ups stay in one place."}
              </p>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
