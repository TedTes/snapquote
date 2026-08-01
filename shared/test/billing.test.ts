import { describe, expect, it } from "vitest";
import { formatMonthlyPlanPrice, quoteVanPlan, quoteVanPricing } from "../src/billing";

describe("QuoteVan pricing catalog", () => {
  it("keeps the first paid plan at early-access pricing", () => {
    expect(quoteVanPricing.trialDays).toBe(14);
    expect(quoteVanPricing.freeSentQuoteLimit).toBe(3);
    expect(quoteVanPricing.plans.solo.monthlyPriceCents).toBe(1900);
    expect(quoteVanPricing.plans.solo.standardMonthlyPriceCents).toBe(2900);
    expect(formatMonthlyPlanPrice(quoteVanPricing.plans.solo.monthlyPriceCents)).toBe("$19/mo");
  });

  it("falls back to trial for unknown or missing plan ids", () => {
    expect(quoteVanPlan(undefined).id).toBe("trial");
    expect(quoteVanPlan("unknown").id).toBe("trial");
  });
});
