import type { QuoteDiscount, QuoteLineItem } from "./schemas.js";

export type QuoteTotalsInput = {
  lineItems: QuoteLineItem[];
  discount: QuoteDiscount;
  taxRate: number;
};

export type QuoteTotals = {
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
};

export function computeQuoteTotals(input: QuoteTotalsInput): QuoteTotals {
  const subtotalCents = input.lineItems.reduce((sum, item) => {
    if (item.needsPrice || item.unitPriceCents === null) {
      throw new Error("Cannot compute quote totals while line items still need prices");
    }

    return sum + Math.round(item.qty * item.unitPriceCents);
  }, 0);

  const discountCents = computeDiscountCents(subtotalCents, input.discount);
  const taxableCents = Math.max(subtotalCents - discountCents, 0);
  const taxCents = Math.round(taxableCents * input.taxRate);

  return {
    subtotalCents,
    discountCents,
    taxCents,
    totalCents: taxableCents + taxCents
  };
}

function computeDiscountCents(subtotalCents: number, discount: QuoteDiscount): number {
  if (discount.type === "none") {
    return 0;
  }

  if (discount.type === "percent") {
    return Math.min(Math.round(subtotalCents * (discount.value / 100)), subtotalCents);
  }

  return Math.min(discount.value, subtotalCents);
}
