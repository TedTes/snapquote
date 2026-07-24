import { describe, expect, it } from "vitest";
import { computeQuoteTotals, type QuoteLineItem } from "../src/index.js";

const baseLine: QuoteLineItem = {
  position: 0,
  description: "Paint walls",
  quantity: 2,
  unit: "hour",
  unitPriceCents: 12500,
  kind: "labour",
  source: "manual",
  priceBookItemId: null,
  priceBookItemKey: null,
  matchConfidence: null,
  matchState: "green"
};

describe("computeQuoteTotals", () => {
  it("computes subtotal, discount, tax, and total from priced lines", () => {
    expect(
      computeQuoteTotals({
        lineItems: [baseLine],
        discount: {
          type: "percent",
          value: 10
        },
        taxRate: 0.13
      })
    ).toEqual({
      subtotalCents: 25000,
      discountCents: 2500,
      taxCents: 2925,
      totalCents: 25425
    });
  });

  it("blocks totals while any line still needs price review", () => {
    expect(() =>
      computeQuoteTotals({
        lineItems: [
          {
            ...baseLine,
            unitPriceCents: null,
            matchState: "red"
          }
        ],
        discount: {
          type: "none",
          value: 0
        },
        taxRate: 0.13
      })
    ).toThrow("Cannot compute quote totals");
  });
});
