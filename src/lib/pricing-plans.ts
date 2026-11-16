// Single source of truth for plan copy, shared by the landing page and /pricing.
// Keep every feature line true to what the app actually does: Starter unlocks
// the workspace, Pro and Portfolio add insights and reports (see
// canAccessInsights / canAccessReports in lib/subscription.ts).

export type PricingPlan = {
  id: "starter" | "pro" | "portfolio";
  name: string;
  tagline: string;
  price: number;
  description: string;
  features: string[];
  highlighted: boolean;
  badge?: string;
};

export function getPricingPlans(isSpanish: boolean): PricingPlan[] {
  if (isSpanish) {
    return [
      {
        id: "starter",
        name: "Starter",
        tagline: "Ideal para 1 propiedad",
        price: 19,
        description: "Tu beneficio real, tus gastos y tu estimación de impuestos en un solo panel.",
        features: [
          "Panel de beneficio real",
          "Importa Airbnb, Booking.com y Excel",
          "Sincronización de calendario (iCal)",
          "Estimación de impuestos",
        ],
        highlighted: false,
      },
      {
        id: "pro",
        name: "Pro",
        tagline: "Ideal para 2 a 5 propiedades",
        price: 49,
        description: "Todo lo de Starter, más los informes y el análisis para comparar propiedades.",
        features: [
          "Todo lo de Starter",
          "Rendimiento por propiedad y canal",
          "Informes para compartir y PDF",
          "Conciliación de pagos",
        ],
        highlighted: true,
        badge: "Recomendado",
      },
      {
        id: "portfolio",
        name: "Portfolio",
        tagline: "Ideal para 6 o más propiedades",
        price: 99,
        description: "Para carteras grandes que quieren todas sus propiedades y mercados en un sitio.",
        features: [
          "Todo lo de Pro",
          "Pensado para 6+ propiedades",
          "Varios mercados (EE. UU., España, Reino Unido)",
          "Soporte prioritario por email",
        ],
        highlighted: false,
      },
    ];
  }

  return [
    {
      id: "starter",
      name: "Starter",
      tagline: "Best for 1 property",
      price: 19,
      description: "Your real profit, expenses and tax estimate in one dashboard.",
      features: [
        "Real-profit dashboard",
        "Airbnb, Booking.com and Excel imports",
        "Calendar sync (iCal)",
        "Tax estimate",
      ],
      highlighted: false,
    },
    {
      id: "pro",
      name: "Pro",
      tagline: "Best for 2 to 5 properties",
      price: 49,
      description: "Everything in Starter, plus the reports and insights to compare properties.",
      features: [
        "Everything in Starter",
        "Performance by property and channel",
        "Shareable reports and PDF export",
        "Payout reconciliation",
      ],
      highlighted: true,
      badge: "Recommended",
    },
    {
      id: "portfolio",
      name: "Portfolio",
      tagline: "Best for 6+ properties",
      price: 99,
      description: "For larger portfolios that want every property and market in one place.",
      features: [
        "Everything in Pro",
        "Built for 6+ properties",
        "Multiple markets (US, Spain, UK)",
        "Priority email support",
      ],
      highlighted: false,
    },
  ];
}
