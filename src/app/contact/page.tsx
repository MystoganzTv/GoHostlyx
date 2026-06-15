import type { Metadata } from "next";
import { ContactForm } from "@/components/contact-form";
import { LegalPageShell } from "@/components/legal-page-shell";
import { getRequestLocale } from "@/lib/server-locale";

export const metadata: Metadata = {
  title: "Contact | GoHostlyx",
  description: "Contact GoHostlyx for support, billing, or product questions.",
};

export default async function ContactPage() {
  const locale = await getRequestLocale();
  const isSpanish = locale === "es";

  return (
    <LegalPageShell
      locale={locale}
      eyebrow={isSpanish ? "Soporte" : "Support"}
      title={isSpanish ? "Contacto" : "Contact"}
      description={
        isSpanish
          ? "Escríbenos para dudas de facturación, problemas con datos, feedback de producto o soporte operativo relacionado con tu workspace de GoHostlyx."
          : "Reach out for billing questions, data issues, product feedback, or operational support related to your GoHostlyx workspace."
      }
    >
      <ContactForm />
    </LegalPageShell>
  );
}
