import { beforeEach, describe, expect, it } from "vitest";
import type { ApiQuote, MeResponse } from "../src/api/client";
import {
  defaultChecklist,
  getQuoteCustomer,
  useQuoteStore,
} from "../src/state/quoteStore";
import type { Customer } from "@snapquote/shared";

const now = "2026-07-29T12:00:00.000Z";
const orgId = "00000000-0000-4000-8000-000000000001";

function customer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: "cust-shared",
    orgId,
    name: "Alice Anderson",
    email: null,
    phone: null,
    address: "18 Victor Ave",
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
    address: "18 Victor Ave",
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

describe("quote customer identity stability", () => {
  beforeEach(() => {
    useQuoteStore.setState({
      priceBookItems: [],
      customers: [],
      quotes: [],
      events: [],
    });
  });

  it("does not rename an existing quote when a new quote reuses the same customer id with a different name", () => {
    const quoteA = apiQuote({
      id: "quote-a",
      customer: customer({ id: "cust-shared", name: "Alice Anderson" }),
    });

    useQuoteStore.getState().upsertRemoteQuote(quoteA);
    expect(getQuoteCustomer(useQuoteStore.getState().quotes[0]!, useQuoteStore.getState().customers)?.name).toBe(
      "Alice Anderson",
    );

    // Creating quote B resolves to the same backend customer row (e.g. matched by phone/email),
    // but the row's name was later reported as "Bob" -- this must not retroactively rename quote A.
    const quoteB = apiQuote({
      id: "quote-b",
      customer: customer({ id: "cust-shared", name: "Bob Baker" }),
    });

    useQuoteStore.getState().upsertRemoteQuote(quoteB);

    const state = useQuoteStore.getState();
    const storedQuoteA = state.quotes.find((q) => q.id === "quote-a")!;
    const storedQuoteB = state.quotes.find((q) => q.id === "quote-b")!;

    expect(getQuoteCustomer(storedQuoteA, state.customers)?.name).toBe("Alice Anderson");
    expect(getQuoteCustomer(storedQuoteB, state.customers)?.name).toBe("Bob Baker");
  });

  it("updates an existing quote from the server's quote customer snapshot", () => {
    const quoteA = apiQuote({ id: "quote-a", customer: customer({ name: "Alice Anderson" }) });
    useQuoteStore.getState().upsertRemoteQuote(quoteA);

    // Once the backend owns quote-level customer snapshots, the quote payload is authoritative.
    const quoteARefetched = apiQuote({ id: "quote-a", customer: customer({ name: "Alice Updated" }) });
    useQuoteStore.getState().upsertRemoteQuote(quoteARefetched);

    const state = useQuoteStore.getState();
    const storedQuoteA = state.quotes.find((q) => q.id === "quote-a")!;
    expect(getQuoteCustomer(storedQuoteA, state.customers)?.name).toBe("Alice Updated");
  });

  it("preserves each quote's captured customer name across a full remote hydration (app restart / login)", () => {
    const quoteA = apiQuote({ id: "quote-a", customer: customer({ id: "cust-1", name: "Alice Anderson" }) });
    const quoteB = apiQuote({ id: "quote-b", customer: customer({ id: "cust-2", name: "Bob Baker" }) });

    useQuoteStore.getState().hydrateRemoteState({
      me: me(),
      priceBookItems: [],
      customers: [customer({ id: "cust-1", name: "Alice Anderson" }), customer({ id: "cust-2", name: "Bob Baker" })],
      quotes: [quoteA, quoteB],
    });

    // Simulate a later hydration where the backend customer rows have drifted (should not happen
    // after the server-side fix, but the client must stay correct even if it did).
    useQuoteStore.getState().hydrateRemoteState({
      me: me(),
      priceBookItems: [],
      customers: [customer({ id: "cust-1", name: "Someone Else" }), customer({ id: "cust-2", name: "Bob Baker" })],
      quotes: [
        apiQuote({ id: "quote-a", customer: customer({ id: "cust-1", name: "Alice Anderson" }) }),
        apiQuote({ id: "quote-b", customer: customer({ id: "cust-2", name: "Bob Baker" }) }),
      ],
    });

    const state = useQuoteStore.getState();
    const storedQuoteA = state.quotes.find((q) => q.id === "quote-a")!;
    const storedQuoteB = state.quotes.find((q) => q.id === "quote-b")!;

    expect(getQuoteCustomer(storedQuoteA, state.customers)?.name).toBe("Alice Anderson");
    expect(getQuoteCustomer(storedQuoteB, state.customers)?.name).toBe("Bob Baker");
  });

  it("captures the customer snapshot on a local (offline) draft and keeps it independent of later customer edits", () => {
    useQuoteStore.getState().updateWizard({
      customerName: "Local Customer",
      address: "42 Draft St",
      jobTitle: "Kitchen refresh",
    });

    const draft = useQuoteStore.getState().generateDraftFromWizard();
    expect(getQuoteCustomer(draft, useQuoteStore.getState().customers)?.name).toBe("Local Customer");

    // A second local draft for a different customer must not affect the first draft's identity.
    useQuoteStore.getState().updateWizard({
      customerName: "Second Local Customer",
      address: "7 Other Ave",
      jobTitle: "Bathroom repair",
    });
    useQuoteStore.getState().generateDraftFromWizard();

    const state = useQuoteStore.getState();
    const firstDraft = state.quotes.find((q) => q.id === draft.id)!;
    expect(getQuoteCustomer(firstDraft, state.customers)?.name).toBe("Local Customer");
  });
});
