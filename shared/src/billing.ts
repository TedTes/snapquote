export const quoteVanPlanIds = ["trial", "solo", "crew", "expired"] as const;

export type QuoteVanPlanId = (typeof quoteVanPlanIds)[number];

export type QuoteVanPlan = {
  id: QuoteVanPlanId;
  name: string;
  badge: string;
  summary: string;
  detail: string;
  monthlyPriceCents: number | null;
  standardMonthlyPriceCents: number | null;
  currency: "USD";
  available: boolean;
  sendQuotes: boolean;
};

export const quoteVanPricing = {
  currency: "USD",
  trialDays: 14,
  freeSentQuoteLimit: 3,
  plans: {
    trial: {
      id: "trial",
      name: "Free trial",
      badge: "Trial",
      summary: "Try QuoteVan before paying.",
      detail: "14 days free, includes 3 sent quotes",
      monthlyPriceCents: 0,
      standardMonthlyPriceCents: 0,
      currency: "USD",
      available: true,
      sendQuotes: true
    },
    solo: {
      id: "solo",
      name: "Solo",
      badge: "Solo",
      summary: "Unlimited quote sending for one business.",
      detail: "$19/mo early access, later $29/mo",
      monthlyPriceCents: 1900,
      standardMonthlyPriceCents: 2900,
      currency: "USD",
      available: true,
      sendQuotes: true
    },
    crew: {
      id: "crew",
      name: "Crew",
      badge: "Crew",
      summary: "Team workflows, SMS, automations, and reporting.",
      detail: "Coming later, expected from $49/mo",
      monthlyPriceCents: null,
      standardMonthlyPriceCents: 4900,
      currency: "USD",
      available: false,
      sendQuotes: true
    },
    expired: {
      id: "expired",
      name: "Trial ended",
      badge: "Expired",
      summary: "Upgrade to keep sending quote links.",
      detail: "Drafts and previews stay available",
      monthlyPriceCents: null,
      standardMonthlyPriceCents: null,
      currency: "USD",
      available: false,
      sendQuotes: false
    }
  } satisfies Record<QuoteVanPlanId, QuoteVanPlan>
} as const;

export function quoteVanPlan(planId: QuoteVanPlanId | string | null | undefined): QuoteVanPlan {
  if (planId === "solo" || planId === "crew" || planId === "expired") {
    return quoteVanPricing.plans[planId];
  }

  return quoteVanPricing.plans.trial;
}

export function formatMonthlyPlanPrice(cents: number | null): string {
  if (cents === null) {
    return "Coming soon";
  }

  if (cents === 0) {
    return "Free";
  }

  return `$${Math.round(cents / 100)}/mo`;
}
