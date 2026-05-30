import type { Metadata } from "next";
import { LegalPageShell } from "@/components/legal-page-shell";
import { getRequestLocale } from "@/lib/server-locale";

export const metadata: Metadata = {
  title: "Privacy Policy | Hostlyx",
  description: "Privacy Policy for Hostlyx.",
};

export default async function PrivacyPage() {
  const locale = await getRequestLocale();
  const isSpanish = locale === "es";

  return (
    <LegalPageShell
      locale={locale}
      eyebrow={isSpanish ? "Legal" : "Legal"}
      title={isSpanish ? "Política de privacidad" : "Privacy Policy"}
      description={
        isSpanish
          ? "Esta página explica qué información recopila Hostlyx, cómo se usa y cómo se tratan los datos de facturación y reporting."
          : "This page explains what information Hostlyx collects, how it is used, and how billing and reporting data are handled."
      }
    >
      <section>
        <h2 className="text-xl font-semibold text-slate-100">
          {isSpanish ? "Información que recopilamos" : "Information we collect"}
        </h2>
        <p className="mt-3">
          {isSpanish
            ? "Hostlyx almacena datos de la cuenta, reservas y gastos subidos, ajustes del workspace y registros de suscripción necesarios para operar el producto. Los datos de pago los procesa Stripe y no los guarda directamente Hostlyx."
            : "Hostlyx stores account details, uploaded booking and expense data, workspace settings, and subscription records needed to run the product. Payment details are processed by Stripe and are not stored directly by Hostlyx."}
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-slate-100">
          {isSpanish ? "Cómo se usan los datos" : "How data is used"}
        </h2>
        <p className="mt-3">
          {isSpanish
            ? "Usamos tus datos para generar dashboards, reportes, estimaciones fiscales y controles de acceso según tu suscripción. También podemos usar metadatos de cuenta para mantener la seguridad, resolver incidencias y mejorar el producto."
            : "We use your data to generate dashboards, reports, tax estimates, and subscription access controls. We may also use account-level metadata to maintain security, troubleshoot issues, and improve the product."}
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-slate-100">
          {isSpanish ? "Compartición y proveedores" : "Sharing and processors"}
        </h2>
        <p className="mt-3">
          {isSpanish
            ? "Hostlyx se apoya en proveedores de infraestructura externos como Netlify, servicios de base de datos, proveedores de autenticación y Stripe para la facturación. Solo compartimos información con esos servicios cuando hace falta para operar la plataforma."
            : "Hostlyx relies on third-party infrastructure providers such as Netlify, database services, authentication providers, and Stripe for billing. We only share information with those services when needed to operate the platform."}
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-slate-100">
          {isSpanish ? "Retención y borrado" : "Retention and deletion"}
        </h2>
        <p className="mt-3">
          {isSpanish
            ? "Tus datos siguen asociados a tu workspace salvo que solicites su eliminación o retiremos una cuenta por abuso, motivos legales u operativos. El vencimiento de una suscripción no borra automáticamente los datos del negocio que hayas subido."
            : "Your data remains associated with your workspace unless you request deletion or we remove an account for abuse, legal, or operational reasons. Subscription expiration does not automatically delete uploaded business data."}
        </p>
      </section>
    </LegalPageShell>
  );
}
