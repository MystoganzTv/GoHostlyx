import type { Metadata } from "next";
import { LegalPageShell } from "@/components/legal-page-shell";
import { getRequestLocale } from "@/lib/server-locale";

export const metadata: Metadata = {
  title: "Terms of Service | Hostlyx",
  description: "Terms of Service for Hostlyx.",
};

export default async function TermsPage() {
  const locale = await getRequestLocale();
  const isSpanish = locale === "es";

  return (
    <LegalPageShell
      locale={locale}
      eyebrow={isSpanish ? "Legal" : "Legal"}
      title={isSpanish ? "Términos del servicio" : "Terms of Service"}
      description={
        isSpanish
          ? "Estos términos rigen el uso de Hostlyx y las herramientas financieras que ofrecemos a operadores de alquiler vacacional."
          : "These terms govern the use of Hostlyx and the financial reporting tools we provide to short-term rental operators."
      }
    >
      <section>
        <h2 className="text-xl font-semibold text-slate-100">
          {isSpanish ? "Uso de Hostlyx" : "Use of Hostlyx"}
        </h2>
        <p className="mt-3">
          {isSpanish
            ? "Hostlyx se ofrece para ayudar a los hosts a organizar reservas, gastos, estimaciones fiscales y reporting. Aceptas usar el producto de forma legal y proporcionar información de cuenta precisa."
            : "Hostlyx is provided to help hosts organize bookings, expenses, tax estimates, and reporting. You agree to use the product lawfully and to provide accurate account information."}
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-slate-100">
          {isSpanish ? "Facturación y acceso" : "Billing and access"}
        </h2>
        <p className="mt-3">
          {isSpanish
            ? "El acceso de pago se factura mediante Stripe. El acceso de prueba, los límites del plan y la disponibilidad de funciones pueden cambiar según el estado de tu suscripción. Cancelar un plan de pago detiene cobros futuros, pero no borra tus datos."
            : "Paid access is billed through Stripe. Trial access, plan limits, and feature availability may change depending on your subscription status. Cancelling a paid plan stops future billing but does not delete your underlying data."}
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-slate-100">
          {isSpanish ? "Tus datos" : "Your data"}
        </h2>
        <p className="mt-3">
          {isSpanish
            ? "Conservas la propiedad de las reservas, archivos de gastos y datos del negocio que subas a Hostlyx. Eres responsable de revisar los reportes antes de compartirlos con contables, socios o inversores."
            : "You retain ownership of the bookings, expense files, and business data you upload to Hostlyx. You are responsible for reviewing reports before sharing them with accountants, partners, or investors."}
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-slate-100">
          {isSpanish ? "Cambios del servicio" : "Service changes"}
        </h2>
        <p className="mt-3">
          {isSpanish
            ? "Podemos mejorar, modificar o retirar partes del servicio con el tiempo. Si un cambio afecta materialmente al acceso de pago, intentaremos comunicarlo con claridad dentro del producto o por email."
            : "We may improve, modify, or discontinue parts of the service over time. If a change materially affects paid access, we will aim to communicate it clearly inside the product or by email."}
        </p>
      </section>
    </LegalPageShell>
  );
}
