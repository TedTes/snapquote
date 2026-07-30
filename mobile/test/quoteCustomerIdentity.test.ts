import { beforeEach, describe, expect, it } from "vitest";
import type { ApiQuote, MeResponse } from "../src/api/client";
import {
  defaultChecklist,
  getQuoteCustomer,
  useQuoteStore,
} from "../src/state/quoteStore";
import type { Customer } from "@snapquote/shared";

const now = "2026-07-30T12:00:00.000Z";
const orgId = "00000000-0000-4000-8000-000000000001";

function customer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: "cust-shared",
    orgId,
    name: "Alice Anderson",
    email: null,
    phone: null,
    address: "18 Victor Ave, Toronto",
    city: "Toronto",
    createdAt: now,
    ...overrides,
  };
}

function apiQuote(overrides: Partial<ApiQuote> = {}): ApiQuote {
  return {
    id: "quote-remote-a",
    orgId,
    customerId: "cust-shared",
    customer: customer(),
    address: "18 Victor Ave, Toronto",
    workType: "interior_repaint",
    jobTitle: "Interior repaint",
    status: "sent",
    publicToken: "token-a",
    publicUrl: "https://snapquote.app/q/token-a",
    validUntil: "2026-08-12",
    lineItems: [],
    discount: { type: "none", value: 0 },
    taxRate: 0.13,
    totals: { subtotalCents: 100000, discountCents: 0, taxCents: 13000, totalCents: 113000 },
    notes: "",
    terms: "",
    scopeSummary: "",
    scopeNotes: [],
    conflicts: [],
    checklist: defaultChecklist,
    transcript: "",
    audioStoragePath: null,
    audioContentType: null,
    audioDurationSeconds: null,
    sentAt: now,
    firstViewedAt: null,
    respondedAt: null,
    supersededByQuoteId: null,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    sendBlockers: { redCount: 0, yellowCount: 0, reasons: [] },
    isStale: false,
    ...overrides,
  };
}

function me(): MeResponse {
  return {
    user: { id: "user-1", orgId, email: "owner@example.com", name: "Owner", role: "owner" },
    org: {
      id: orgId,
      name: "Bright Coat Painting",
      trade: "painting",
      logoUrl: null,
      contactPhone: null,
      website: null,
      defaultTaxRate: 0.13,
      defaultTerms: "Due on completion.",
      quoteValidDays: 14,
      setupCompletedAt: now,
      plan: "solo",
    },
    entitlements: { canSendQuotes: true, trialEndsAt: null },
  };
}

describe("quote customer identity is a live lookup by customerId, not a snapshot", () => {
  beforeEach(() => {
    useQuoteStore.setState({
      priceBookItems: [],
      customers: [],
      quotes: [],
      events: [],
    });
  });

  it("updates the displayed name on every quote linked to a customer when that customer is edited", () => {
    useQuoteStore.getState().upsertRemoteQuote(
      apiQuote({ id: "quote-a", customerId: "cust-1", customer: customer({ id: "cust-1", name: "Alice Anderson" }) }),
    );
    useQuoteStore.getState().upsertRemoteQuote(
      apiQuote({ id: "quote-b", customerId: "cust-1", customer: customer({ id: "cust-1", name: "Alice Anderson" }) }),
    );

    // Editing the shared customer (e.g. fixing a typo) must be reflected on both quotes.
    useQuoteStore.getState().upsertCustomer(customer({ id: "cust-1", name: "Alice A. Anderson" }));

    const state = useQuoteStore.getState();
    const quoteA = state.quotes.find((q) => q.id === "quote-a")!;
    const quoteB = state.quotes.find((q) => q.id === "quote-b")!;

    expect(getQuoteCustomer(quoteA, state.customers)?.name).toBe("Alice A. Anderson");
    expect(getQuoteCustomer(quoteB, state.customers)?.name).toBe("Alice A. Anderson");
  });

  it("keeps two different customers' quotes distinct -- renaming one never affects the other", () => {
    useQuoteStore.getState().upsertRemoteQuote(
      apiQuote({ id: "quote-a", customerId: "cust-1", customer: customer({ id: "cust-1", name: "Alice Anderson" }) }),
    );
    useQuoteStore.getState().upsertRemoteQuote(
      apiQuote({ id: "quote-b", customerId: "cust-2", customer: customer({ id: "cust-2", name: "Bob Baker" }) }),
    );

    useQuoteStore.getState().upsertCustomer(customer({ id: "cust-1", name: "Alice Renamed" }));

    const state = useQuoteStore.getState();
    const quoteA = state.quotes.find((q) => q.id === "quote-a")!;
    const quoteB = state.quotes.find((q) => q.id === "quote-b")!;

    expect(getQuoteCustomer(quoteA, state.customers)?.name).toBe("Alice Renamed");
    expect(getQuoteCustomer(quoteB, state.customers)?.name).toBe("Bob Baker");
  });

  it("does not require or read a customerSnapshot field -- QuoteRecord carries only customerId", () => {
    useQuoteStore.getState().upsertRemoteQuote(apiQuote({ id: "quote-a", customer: customer({ name: "Alice Anderson" }) }));

    const quote = useQuoteStore.getState().quotes[0]!;
    expect("customerSnapshot" in quote).toBe(false);
    expect(quote.customerId).toBe("cust-shared");
  });

  it("resolves a full remote hydration purely from customerId, even across multiple runs", () => {
    useQuoteStore.getState().hydrateRemoteState({
      me: me(),
      priceBookItems: [],
      customers: [customer({ id: "cust-1", name: "Alice Anderson" }), customer({ id: "cust-2", name: "Bob Baker" })],
      quotes: [
        apiQuote({ id: "quote-a", customerId: "cust-1", customer: customer({ id: "cust-1", name: "Alice Anderson" }) }),
        apiQuote({ id: "quote-b", customerId: "cust-2", customer: customer({ id: "cust-2", name: "Bob Baker" }) }),
      ],
    });

    // A later hydration reflects an edited customer name -- the live source of truth.
    useQuoteStore.getState().hydrateRemoteState({
      me: me(),
      priceBookItems: [],
      customers: [customer({ id: "cust-1", name: "Alice Updated" }), customer({ id: "cust-2", name: "Bob Baker" })],
      quotes: [
        apiQuote({ id: "quote-a", customerId: "cust-1", customer: customer({ id: "cust-1", name: "Alice Updated" }) }),
        apiQuote({ id: "quote-b", customerId: "cust-2", customer: customer({ id: "cust-2", name: "Bob Baker" }) }),
      ],
    });

    const state = useQuoteStore.getState();
    const quoteA = state.quotes.find((q) => q.id === "quote-a")!;
    const quoteB = state.quotes.find((q) => q.id === "quote-b")!;

    expect(getQuoteCustomer(quoteA, state.customers)?.name).toBe("Alice Updated");
    expect(getQuoteCustomer(quoteB, state.customers)?.name).toBe("Bob Baker");
  });

  it("creates a new local customer for a fresh offline draft, with a job address independent of the customer's own address", () => {
    useQuoteStore.getState().updateWizard({
      customerName: "Local Customer",
      address: "42 Draft St, Etobicoke",
      jobTitle: "Kitchen refresh",
    });

    const draft = useQuoteStore.getState().generateDraftFromWizard();
    const state = useQuoteStore.getState();

    expect(state.customers.some((c) => c.id === draft.customerId)).toBe(true);
    expect(getQuoteCustomer(draft, state.customers)?.name).toBe("Local Customer");
    expect(draft.address).toBe("42 Draft St, Etobicoke");
  });

  it("reuses a picked existing customer for a new offline draft instead of creating a duplicate", () => {
    useQuoteStore.setState({
      customers: [customer({ id: "cust-existing", name: "Existing Customer", address: "9 Main St, Toronto" })],
    });

    useQuoteStore.getState().updateWizard({
      customerId: "cust-existing",
      customerName: "Existing Customer",
      address: "17 Second Job Site Rd, Toronto",
      jobTitle: "Second job for the same customer",
    });

    const draft = useQuoteStore.getState().generateDraftFromWizard();
    const state = useQuoteStore.getState();

    expect(draft.customerId).toBe("cust-existing");
    expect(state.customers).toHaveLength(1);
    expect(draft.address).toBe("17 Second Job Site Rd, Toronto");
  });

  it("does not duplicate a customer record when a second quote reuses the same customerId via sync", () => {
    useQuoteStore.getState().upsertRemoteQuote(
      apiQuote({ id: "quote-a", customerId: "cust-1", customer: customer({ id: "cust-1", name: "Alice Anderson" }) }),
    );
    useQuoteStore.getState().upsertRemoteQuote(
      apiQuote({ id: "quote-b", customerId: "cust-1", customer: customer({ id: "cust-1", name: "Alice Anderson" }) }),
    );

    const state = useQuoteStore.getState();
    expect(state.customers.filter((c) => c.id === "cust-1")).toHaveLength(1);
    expect(state.quotes).toHaveLength(2);
  });

  it("edits a local customer record without changing quote ids", () => {
    useQuoteStore.getState().upsertRemoteQuote(
      apiQuote({ id: "quote-a", customerId: "cust-1", customer: customer({ id: "cust-1", name: "Alice Anderson" }) }),
    );

    useQuoteStore.getState().updateCustomer("cust-1", {
      name: "Alice Updated",
      address: "42 Queen St, Toronto",
    });

    const state = useQuoteStore.getState();
    const quote = state.quotes.find((candidate) => candidate.id === "quote-a")!;
    const edited = getQuoteCustomer(quote, state.customers);

    expect(quote.customerId).toBe("cust-1");
    expect(edited?.name).toBe("Alice Updated");
    expect(edited?.city).toBe("Toronto");
  });

  it("merges duplicate customers by moving quotes to the kept customer", () => {
    useQuoteStore.getState().upsertRemoteQuote(
      apiQuote({ id: "quote-a", customerId: "cust-source", customer: customer({ id: "cust-source", name: "Alice A." }) }),
    );
    useQuoteStore.getState().upsertRemoteQuote(
      apiQuote({ id: "quote-b", customerId: "cust-target", customer: customer({ id: "cust-target", name: "Alice Anderson" }) }),
    );

    useQuoteStore.getState().mergeCustomers("cust-source", "cust-target");

    const state = useQuoteStore.getState();

    expect(state.customers.some((candidate) => candidate.id === "cust-source")).toBe(false);
    expect(state.customers.some((candidate) => candidate.id === "cust-target")).toBe(true);
    expect(state.quotes.every((quote) => quote.customerId === "cust-target")).toBe(true);
  });

  it("only removes customers that are not linked to quotes", () => {
    useQuoteStore.getState().upsertRemoteQuote(
      apiQuote({ id: "quote-a", customerId: "cust-linked", customer: customer({ id: "cust-linked", name: "Linked Customer" }) }),
    );
    useQuoteStore.getState().upsertCustomer(customer({ id: "cust-unused", name: "Unused Customer" }));

    useQuoteStore.getState().removeCustomer("cust-linked");
    useQuoteStore.getState().removeCustomer("cust-unused");

    const state = useQuoteStore.getState();

    expect(state.customers.some((candidate) => candidate.id === "cust-linked")).toBe(true);
    expect(state.customers.some((candidate) => candidate.id === "cust-unused")).toBe(false);
  });
});
