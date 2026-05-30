import type { Metadata } from "next";
import { LegalPageShell } from "@/components/legal-page-shell";
import { getRequestLocale } from "@/lib/server-locale";

export const metadata: Metadata = {
  title: "Refund Policy | Hostlyx",
  description: "Refund Policy for Hostlyx.",
};

export default async function RefundPage() {
  const locale = await getRequestLocale();
  const isSpanish = locale === "es";

  return (
    <LegalPageShell
      locale={locale}
      eyebrow={isSpanish ? "Facturación" : "Billing"}
      title={isSpanish ? "Política de reembolsos" : "Refund Policy"}
      description={
        isSpanish
          ? "Esta política explica cómo gestiona Hostlyx los reembolsos de suscripción, disputas de cobro y mejoras canceladas."
          : "This policy explains how Hostlyx handles subscription refunds, billing disputes, and cancelled upgrades."
      }
    >
      <section>
        <h2 className="text-xl font-semibold text-slate-100">
          {isSpanish ? "Cobros de suscripción" : "Subscription charges"}
        </h2>
        <p className="mt-3">
          {isSpanish
            ? "Los planes de pago se cobran a través de Stripe usando el precio mostrado dentro de Hostlyx. Cuando termina una prueba y mejoras de plan, la facturación empieza según la suscripción creada en checkout."
            : "Paid plans are billed through Stripe using the pricing shown inside Hostlyx. When a trial ends and you upgrade, billing starts according to the subscription created at checkout."}
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-slate-100">
          {isSpanish ? "Solicitudes de reembolso" : "Refund requests"}
        </h2>
        <p className="mt-3">
          {isSpanish
            ? "Si crees que se hizo un cobro por error, contáctanos cuanto antes con el email usado para la facturación y la fecha de la transacción. Las decisiones de reembolso se revisan caso por caso."
            : "If you believe a charge was made in error, contact us promptly with the email used for billing and the date of the transaction. Refund decisions are reviewed case by case."}
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-slate-100">
          {isSpanish ? "Momento de cancelación" : "Cancellation timing"}
        </h2>
        <p className="mt-3">
          {isSpanish
            ? "Cancelar una suscripción detiene las renovaciones futuras, pero no revierte retroactivamente cargos por periodos ya facturados, salvo que se apruebe expresamente un reembolso."
            : "Cancelling a subscription stops future renewals but does not retroactively reverse fees for time already billed, unless a refund is explicitly approved."}
        </p>
      </section>
    </LegalPageShell>
  );
}
