import { describe, expect, it } from "vitest";
import { matchesQuoteSearch, type QuoteRow } from "../src/state/useQuoteRows";
import { defaultChecklist, type QuoteRecord } from "../src/state/quoteStore";
import type { Customer } from "@snapquote/shared";

const now = "2026-07-30T12:00:00.000Z";
const orgId = "00000000-0000-4000-8000-000000000001";

function quote(overrides: Partial<QuoteRecord> = {}): QuoteRecord {
  return {
    id: "quote-1",
    customerId: "cust-1",
    address: "18 Victor Ave, Toronto",
    workType: "interior_repaint",
    jobTitle: "",
    lineItems: [],
    discount: { type: "none", value: 0 },
    taxRate: 0.13,
    notes: "",
    terms: "",
    validUntil: "2026-08-12",
    scopeSummary: "",
    scopeNotes: [],
    conflicts: [],
    checklist: defaultChecklist,
    transcript: "",
    audioStoragePath: null,
    audioContentType: null,
    audioDurationSeconds: null,
    publicToken: null,
    publicUrl: null,
    sentAt: null,
    firstViewedAt: null,
    respondedAt: null,
    supersededByQuoteId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function customer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: "cust-1",
    orgId,
    name: "Michael Torres",
    email: null,
    phone: null,
    address: "9 Main St, Etobicoke",
    city: "Etobicoke",
    createdAt: now,
    ...overrides,
  };
}

function row(overrides: { quote?: Partial<QuoteRecord>; customer?: Customer | null } = {}): QuoteRow {
  return {
    quote: quote(overrides.quote),
    customer: overrides.customer === undefined ? customer() : overrides.customer,
    status: "sent",
    blockers: { redLineCount: 0, yellowLineCount: 0, reasons: [] },
    stale: false,
    totals: null,
  };
}

describe("matchesQuoteSearch", () => {
  it("matches on the derived job label", () => {
    const target = row({ quote: { jobTitle: "Kitchen + hallway" } });
    expect(matchesQuoteSearch(target, "hallway")).toBe(true);
    expect(matchesQuoteSearch(target, "bathroom")).toBe(false);
  });

  it("matches on the linked customer's name", () => {
    const target = row({ customer: customer({ name: "Priya Patel" }) });
    expect(matchesQuoteSearch(target, "priya")).toBe(true);
  });

  it("matches on the linked customer's address and city", () => {
    const target = row({ customer: customer({ address: "9 Main St", city: "Etobicoke" }) });
    expect(matchesQuoteSearch(target, "etobicoke")).toBe(true);
    expect(matchesQuoteSearch(target, "main st")).toBe(true);
  });

  it("is case-insensitive and trims whitespace", () => {
    const target = row({ customer: customer({ name: "Priya Patel" }) });
    expect(matchesQuoteSearch(target, "  PRIYA  ")).toBe(true);
  });

  it("does not match a different quote's customer", () => {
    const target = row({ customer: customer({ name: "Priya Patel", address: "9 Main St, Etobicoke" }) });
    expect(matchesQuoteSearch(target, "bob baker")).toBe(false);
  });

  it("treats an unlinked customer as no match rather than throwing", () => {
    const target = row({ customer: null, quote: { jobTitle: "Interior repaint" } });
    expect(matchesQuoteSearch(target, "interior")).toBe(true);
    expect(matchesQuoteSearch(target, "toronto")).toBe(false);
  });

  it("returns every row when the search term is blank", () => {
    const target = row();
    expect(matchesQuoteSearch(target, "")).toBe(true);
    expect(matchesQuoteSearch(target, "   ")).toBe(true);
  });
});
