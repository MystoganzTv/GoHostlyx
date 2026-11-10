import Image from "next/image";
import Link from "next/link";
import localFont from "next/font/local";
import { ArrowDown, ArrowRight, ArrowUpRight, ChartNoAxesCombined, FileSpreadsheet, ReceiptText } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingHeader } from "@/components/marketing-header";
import { getAuthSession } from "@/lib/auth";
import { formatCurrency, formatPercent } from "@/lib/format";
import { getRequestLocale } from "@/lib/server-locale";
import { trialLengthDays } from "@/lib/subscription";
import styles from "./landing.module.css";

const manrope = localFont({
  src: "../assets/fonts/Manrope-Variable.ttf",
  weight: "200 800",
  display: "swap",
});

const example = { revenue: 12480, expenses: 7120, estimatedTaxes: 1080 };
const netProfit = example.revenue - example.expenses - example.estimatedTaxes;
const netMargin = netProfit / example.revenue;

const copy = {
  en: {
    category: "Finances for short-term rentals",
    title: "See what your",
    titleAccent: "rentals earn.",
    description: "Bring bookings, payouts and expenses together to see what each property earns and how much you keep.",
    trial: "Start free trial",
    openApp: "Open dashboard",
    trialNote: `${trialLengthDays}-day trial · No card required`,
    preview: "See how it works",
    demo: "Sample data",
    month: "June overview",
    profit: "Profit after estimated taxes",
    margin: "Net margin",
    revenue: "Revenue",
    expenses: "Operating expenses",
    taxes: "Estimated taxes",
    sources: "Bring your records together",
    features: "The toolkit",
    featuresTitle: "Make sense of every stay.",
    importTitle: "Import your records",
    importText: "Upload Airbnb and Booking.com exports or your own spreadsheet. Add direct bookings and expenses as you go.",
    reconcileTitle: "Reconcile your payouts",
    reconcileText: "Compare expected payouts with statement totals and spot differences that need a closer look.",
    trackTitle: "Track what you keep",
    trackText: "See profit by property, compare booking channels and estimate how much to set aside for taxes.",
    walkthrough: "How it works",
    walkthroughTitle: "From booking revenue to money kept.",
    walkthroughText: "Start with the revenue from your stays, subtract operating costs and estimate your taxes. The result gives you a clearer picture of what your rentals earn.",
    walkthroughLabel: "Example monthly breakdown",
    pricing: "View pricing",
    closeTitle: "Get a clearer view of your rentals.",
    closeText: "Start with a spreadsheet and see what your numbers tell you.",
  },
  es: {
    category: "Finanzas para alquiler vacacional",
    title: "Descubre cuánto",
    titleAccent: "te deja cada alquiler.",
    description: "Reúne reservas, cobros y gastos para saber cuánto rinde cada propiedad y cuánto te queda.",
    trial: "Probar gratis",
    openApp: "Abrir el panel",
    trialNote: `Prueba de ${trialLengthDays} días · Sin tarjeta`,
    preview: "Ver cómo funciona",
    demo: "Datos de ejemplo",
    month: "Resumen de junio",
    profit: "Beneficio tras impuestos estimados",
    margin: "Margen neto",
    revenue: "Ingresos",
    expenses: "Gastos operativos",
    taxes: "Impuestos estimados",
    sources: "Reúne tus datos en un solo lugar",
    features: "Herramientas",
    featuresTitle: "Entiende los números de cada estancia.",
    importTitle: "Importa tus datos",
    importText: "Sube archivos de Airbnb, Booking.com o tu propia hoja de cálculo. Añade reservas directas y gastos cuando los tengas.",
    reconcileTitle: "Concilia tus cobros",
    reconcileText: "Compara los cobros esperados con el extracto y detecta diferencias que merecen revisión.",
    trackTitle: "Controla tu beneficio",
    trackText: "Consulta el beneficio por propiedad, compara canales y estima cuánto apartar para impuestos.",
    walkthrough: "Cómo funciona",
    walkthroughTitle: "De lo que facturas a lo que te queda.",
    walkthroughText: "Parte de los ingresos de tus estancias, resta los costes operativos y estima los impuestos. Así puedes ver cuánto te deja tu alquiler.",
    walkthroughLabel: "Desglose mensual de ejemplo",
    pricing: "Ver precios",
    closeTitle: "Ten más claridad sobre tus alquileres.",
    closeText: "Empieza con una hoja de cálculo y descubre qué dicen tus números.",
  },
};

export default async function LandingPage() {
  const [locale, session] = await Promise.all([getRequestLocale(), getAuthSession()]);
  const signedIn = Boolean(session?.user?.email);
  const primaryHref = signedIn ? "/dashboard" : "/login?mode=sign-up";
  const t = copy[locale];
  const primaryLabel = signedIn ? t.openApp : t.trial;
  const money = (amount: number) => formatCurrency(amount, false, "EUR", locale);
  const features = [
    { Icon: FileSpreadsheet, title: t.importTitle, description: t.importText },
    { Icon: ReceiptText, title: t.reconcileTitle, description: t.reconcileText },
    { Icon: ChartNoAxesCombined, title: t.trackTitle, description: t.trackText },
  ];

  return (
    <div className={`${styles.site} ${manrope.className}`}>
      <MarketingHeader activePage="home" signedIn={signedIn} primaryHref={primaryHref} locale={locale} />

      <main>
        <section id="hero" className={`${styles.wrap} ${styles.hero}`}>
          <div className={styles.heroCopy}>
            <p className={styles.kicker}><span />{t.category}</p>
            <h1>{t.title} <em>{t.titleAccent}</em></h1>
            <p className={styles.intro}>{t.description}</p>
            <div className={styles.actions}>
              <Link href={primaryHref} className={styles.primary}>
                {primaryLabel}<ArrowUpRight size={18} aria-hidden="true" />
              </Link>
              <Link href="#preview" className={styles.secondary}>
                {t.preview}<ArrowDown size={17} aria-hidden="true" />
              </Link>
            </div>
            {!signedIn ? <p className={styles.trialNote}>{t.trialNote}</p> : null}
          </div>

          <figure className={styles.cover}>
            <Image
              src="/rental-hero.webp"
              alt=""
              fill
              preload
              sizes="(max-width: 820px) calc(100vw - 40px), (max-width: 1320px) 49vw, 630px"
              className={styles.coverImage}
            />
            <figcaption className={styles.snapshot}>
              <div className={styles.snapshotHeader}>
                <BrandMark width={34} height={34} />
                <span>{t.month}</span>
                <span className={styles.sample}>{t.demo}</span>
              </div>
              <div className={styles.snapshotBody}>
                <p>{t.profit}</p>
                <strong>{money(netProfit)}</strong>
                <span className={styles.margin}>
                  {formatPercent(netMargin, locale)} <span>{t.margin}</span>
                </span>
              </div>
            </figcaption>
          </figure>
        </section>

        <div className={`${styles.wrap} ${styles.sources}`}>
          <p>{t.sources}</p>
          <ul aria-label={t.sources}>
            <li>Airbnb</li>
            <li>Booking.com</li>
            <li><FileSpreadsheet size={18} aria-hidden="true" /> Excel / CSV</li>
          </ul>
        </div>

        <section id="features" className={`${styles.wrap} ${styles.features}`}>
          <p className={styles.kicker}><span />{t.features}</p>
          <h2>{t.featuresTitle}</h2>
          <div className={styles.featureGrid}>
            {features.map(({ Icon, title, description }, index) => (
              <article key={title} className={styles.feature}>
                <div className={styles.featureTop} aria-hidden="true">
                  <span><Icon size={23} /></span>
                  <span>0{index + 1}</span>
                </div>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="preview" className={styles.walkthrough}>
          <div className={`${styles.wrap} ${styles.walkthroughGrid}`}>
            <div>
              <p className={styles.kicker}><span />{t.walkthrough}</p>
              <h2>{t.walkthroughTitle}</h2>
              <p className={styles.walkthroughText}>{t.walkthroughText}</p>
            </div>

            <div className={styles.breakdown}>
              <p>{t.walkthroughLabel}</p>
              <dl>
                <div><dt>{t.revenue}</dt><dd>{money(example.revenue)}</dd></div>
                <div><dt>{t.expenses}</dt><dd>−{money(example.expenses)}</dd></div>
                <div><dt>{t.taxes}</dt><dd>−{money(example.estimatedTaxes)}</dd></div>
                <div className={styles.breakdownTotal}><dt>{t.profit}</dt><dd>{money(netProfit)}</dd></div>
              </dl>
            </div>
          </div>
        </section>

        <section id="pricing" className={`${styles.wrap} ${styles.closing}`}>
          <div className={styles.closingPanel}>
            <div>
              <h2>{t.closeTitle}</h2>
              <p>{t.closeText}</p>
            </div>
            <div className={styles.actions}>
              <Link href={primaryHref} className={styles.primary}>
                {primaryLabel}<ArrowUpRight size={18} aria-hidden="true" />
              </Link>
              <Link href="/pricing" className={styles.secondary}>
                {t.pricing}<ArrowRight size={17} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <MarketingFooter locale={locale} />
    </div>
  );
}
