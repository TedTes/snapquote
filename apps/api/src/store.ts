import { randomUUID } from "node:crypto";
import {
  assertQuoteCanSend,
  buildPainterStarterPriceBook,
  canAcceptPublicQuote,
  computeQuoteTotals,
  createPainterDraftLines,
  deriveQuoteStatus,
  getQuoteSendBlockers,
  isQuoteStale,
  type Customer,
  type DraftConflict,
  type PainterChecklist,
  type PainterCorePriceInput,
  type PriceBookItem,
  type QuoteDiscount,
  type QuoteEvent,
  type QuoteLineItem,
  type QuoteStatus
} from "@snapquote/shared";

const demoOrgId = "00000000-0000-4000-8000-000000000001";
const demoUserId = "00000000-0000-4000-8000-000000000002";

type StoredQuoteLineItem = QuoteLineItem & {
  id: string;
};

type PriceBookItemPatch = {
  name?: string | undefined;
  description?: string | undefined;
  pricing?: PriceBookItem["pricing"] | undefined;
  confirmedAt?: string | null | undefined;
};

export type SentEmail = {
  id: string;
  quoteId: string;
  to: string;
  subject: string;
  publicUrl: string;
  purpose: "quote_send" | "quote_follow_up";
  sentAt: string;
};

export type QuoteTotalsSnapshot = {
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
};

export type QuoteRecord = {
  id: string;
  orgId: string;
  customerId: string;
  address: string;
  status: QuoteStatus;
  publicToken: string;
  validUntil: string;
  lineItems: StoredQuoteLineItem[];
  discount: QuoteDiscount;
  taxRate: number;
  totals: QuoteTotalsSnapshot | null;
  notes: string;
  terms: string;
  scopeSummary: string;
  scopeNotes: string[];
  conflicts: DraftConflict[];
  sentAt: string | null;
  firstViewedAt: string | null;
  respondedAt: string | null;
  supersededByQuoteId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OrgRecord = {
  id: string;
  name: string;
  trade: "painting";
  logoUrl: string | null;
  defaultTaxRate: number;
  defaultTerms: string;
  quoteValidDays: number;
  plan: "trial" | "solo" | "crew" | "expired";
};

export type AppState = {
  org: OrgRecord;
  user: {
    id: string;
    orgId: string;
    email: string;
    name: string;
    role: "owner";
  };
  priceBookItems: PriceBookItem[];
  customers: Customer[];
  quotes: QuoteRecord[];
  events: QuoteEvent[];
  sentEmails: SentEmail[];
};

export function createInitialState(now = new Date()): AppState {
  const timestamp = now.toISOString();

  return {
    org: {
      id: demoOrgId,
      name: "SnapQuote Painting Co.",
      trade: "painting",
      logoUrl: null,
      defaultTaxRate: 0.13,
      defaultTerms: "Payment due on completion. Scope changes require approval.",
      quoteValidDays: 14,
      plan: "trial"
    },
    user: {
      id: demoUserId,
      orgId: demoOrgId,
      email: "demo@snapquote.local",
      name: "Demo Contractor",
      role: "owner"
    },
    priceBookItems: buildPainterStarterPriceBook({
      orgId: demoOrgId,
      now: timestamp,
      makeId: () => randomUUID()
    }),
    customers: [],
    quotes: [],
    events: [],
    sentEmails: []
  };
}

export type InMemoryStore = ReturnType<typeof createInMemoryStore>;

export function createInMemoryStore(initialState = createInitialState()) {
  const state = initialState;

  return {
    getState: () => state,

    getMe() {
      return {
        user: state.user,
        org: state.org,
        entitlements: {
          canSendQuotes: true,
          trialEndsAt: null
        }
      };
    },

    onboardPainter(input: {
      businessName: string;
      defaultTaxRate: number;
      defaultTerms: string;
      quoteValidDays: number;
      corePrices: PainterCorePriceInput;
    }) {
      const now = new Date().toISOString();
      state.org.name = input.businessName;
      state.org.defaultTaxRate = input.defaultTaxRate;
      state.org.defaultTerms = input.defaultTerms;
      state.org.quoteValidDays = input.quoteValidDays;
      state.priceBookItems = buildPainterStarterPriceBook({
        orgId: state.org.id,
        now,
        makeId: () => randomUUID(),
        corePrices: input.corePrices
      });

      return {
        org: state.org,
        priceBookItems: state.priceBookItems
      };
    },

    listPriceBook() {
      return state.priceBookItems;
    },

    updatePriceBookItem(
      id: string,
      patch: PriceBookItemPatch
    ) {
      const item = findOrThrow(state.priceBookItems, id, "price_book_item");

      if (patch.name !== undefined) {
        item.name = patch.name;
      }

      if (patch.description !== undefined) {
        item.description = patch.description;
      }

      if (patch.pricing !== undefined) {
        item.pricing = patch.pricing;
      }

      if (patch.confirmedAt !== undefined) {
        item.confirmedAt = patch.confirmedAt;
      }

      item.updatedAt = new Date().toISOString();
      return item;
    },

    listCustomers() {
      return state.customers;
    },

    createCustomer(input: { name: string; email: string; phone?: string | null | undefined; address: string }) {
      const customer: Customer = {
        id: randomUUID(),
        orgId: state.org.id,
        name: input.name,
        email: input.email,
        phone: input.phone ?? null,
        address: input.address,
        createdAt: new Date().toISOString()
      };

      state.customers.unshift(customer);
      return customer;
    },

    createDraftQuote(input: {
      customerId?: string | undefined;
      customer?: {
        name: string;
        email: string;
        phone?: string | null | undefined;
        address: string;
      } | undefined;
      address: string;
      checklist: PainterChecklist;
      transcript: string;
      typedNotes?: string | undefined;
    }) {
      const customer =
        input.customerId !== undefined
          ? findOrThrow(state.customers, input.customerId, "customer")
          : this.createCustomer(
              input.customer ?? {
                name: "Unnamed customer",
                email: "customer@example.com",
                phone: null,
                address: input.address
              }
            );
      const now = new Date();
      const draft = createPainterDraftLines({
        checklist: input.checklist,
        transcript: input.transcript,
        priceBookItems: state.priceBookItems
      });
      const quote: QuoteRecord = {
        id: randomUUID(),
        orgId: state.org.id,
        customerId: customer.id,
        address: input.address,
        status: "draft",
        publicToken: randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", ""),
        validUntil: addDays(now, state.org.quoteValidDays),
        lineItems: draft.lineItems.map((line) => ({
          ...line,
          id: randomUUID()
        })),
        discount: {
          type: "none",
          value: 0
        },
        taxRate: state.org.defaultTaxRate,
        totals: null,
        notes: input.typedNotes ?? "",
        terms: state.org.defaultTerms,
        scopeSummary: buildScopeSummary(customer.name, input.checklist, draft.scopeNotes),
        scopeNotes: draft.scopeNotes,
        conflicts: draft.conflicts,
        sentAt: null,
        firstViewedAt: null,
        respondedAt: null,
        supersededByQuoteId: null,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      };

      quote.totals = computeTotalsIfReady(quote);
      state.quotes.unshift(quote);
      state.events.push(createEvent(quote.id, "created"));
      return quote;
    },

    listQuotes() {
      refreshStatuses(state);
      return state.quotes;
    },

    getQuote(id: string) {
      refreshStatuses(state);
      return findOrThrow(state.quotes, id, "quote");
    },

    patchQuote(
      id: string,
      patch: {
        lineItems?: QuoteLineItem[] | undefined;
        discount?: QuoteDiscount | undefined;
        taxRate?: number | undefined;
        notes?: string | undefined;
        terms?: string | undefined;
        validUntil?: string | undefined;
      }
    ) {
      const quote = findOrThrow(state.quotes, id, "quote");
      assertDraftMutable(quote);

      if (patch.lineItems !== undefined) {
        quote.lineItems = patch.lineItems.map((line) => ({
          ...line,
          id: line.id ?? randomUUID()
        }));
      }

      if (patch.discount !== undefined) {
        quote.discount = patch.discount;
      }

      if (patch.taxRate !== undefined) {
        quote.taxRate = patch.taxRate;
      }

      if (patch.notes !== undefined) {
        quote.notes = patch.notes;
      }

      if (patch.terms !== undefined) {
        quote.terms = patch.terms;
      }

      if (patch.validUntil !== undefined) {
        quote.validUntil = patch.validUntil;
      }

      quote.totals = computeTotalsIfReady(quote);
      quote.updatedAt = new Date().toISOString();
      return quote;
    },

    saveLineToPriceBook(quoteId: string, lineId: string) {
      const quote = findOrThrow(state.quotes, quoteId, "quote");
      const line = findOrThrow(quote.lineItems, lineId, "line_item");

      if (line.unitPriceCents === null) {
        throw new Error("Line must have a unit price before it can be saved to the price book");
      }

      const now = new Date().toISOString();
      const item: PriceBookItem = {
        id: randomUUID(),
        orgId: state.org.id,
        key: line.priceBookItemKey ?? slugKey(line.description),
        name: line.description,
        description: line.description,
        unit: line.unit ?? "flat",
        pricing: {
          type: "fixed",
          unitPriceCents: line.unitPriceCents
        },
        kind: line.kind,
        starter: false,
        confirmedAt: now,
        usageCount: 1,
        createdAt: now,
        updatedAt: now
      };

      state.priceBookItems.unshift(item);
      line.source = "price_book";
      line.priceBookItemId = item.id;
      line.priceBookItemKey = item.key;
      line.matchConfidence = 1;
      line.matchState = "green";
      quote.totals = computeTotalsIfReady(quote);
      quote.updatedAt = now;

      return {
        item,
        quote
      };
    },

    confirmYellowLine(quoteId: string, lineId: string) {
      const quote = findOrThrow(state.quotes, quoteId, "quote");
      const line = findOrThrow(quote.lineItems, lineId, "line_item");

      if (line.matchState !== "yellow" || line.priceBookItemId === null) {
        throw new Error("Only yellow price-book lines can be confirmed");
      }

      const item = findOrThrow(state.priceBookItems, line.priceBookItemId, "price_book_item");
      const now = new Date().toISOString();
      item.confirmedAt = now;
      item.updatedAt = now;
      line.matchState = "green";
      line.matchConfidence = 1;
      quote.totals = computeTotalsIfReady(quote);
      quote.updatedAt = now;

      return {
        item,
        quote
      };
    },

    sendQuote(id: string, publicQuoteBaseUrl = "http://localhost:3001/public/quotes") {
      const quote = findOrThrow(state.quotes, id, "quote");
      assertDraftMutable(quote);
      assertQuoteCanSend(quote.lineItems);
      const customer = findOrThrow(state.customers, quote.customerId, "customer");

      if (customer.email === null) {
        throw new Error("Customer email is required before sending");
      }

      quote.totals = computeQuoteTotals({
        lineItems: quote.lineItems,
        discount: quote.discount,
        taxRate: quote.taxRate
      });
      const now = new Date().toISOString();
      quote.sentAt = now;
      quote.updatedAt = now;
      state.events.push(createEvent(quote.id, "sent", { channel: "email" }));
      state.sentEmails.push({
        id: randomUUID(),
        quoteId: quote.id,
        to: customer.email,
        subject: `Quote from ${state.org.name}`,
        publicUrl: `${publicQuoteBaseUrl}/${quote.publicToken}`,
        purpose: "quote_send",
        sentAt: now
      });
      refreshStatuses(state);

      return quote;
    },

    followUpQuote(id: string, publicQuoteBaseUrl = "http://localhost:3001/public/quotes") {
      refreshStatuses(state);
      const quote = findOrThrow(state.quotes, id, "quote");

      if (quote.status !== "sent" && quote.status !== "viewed") {
        throw new Error("Only sent quotes awaiting a response can be followed up");
      }

      if (
        !isQuoteStale({
          sentAt: quote.sentAt,
          firstViewedAt: quote.firstViewedAt,
          respondedAt: quote.respondedAt,
          now: new Date()
        })
      ) {
        throw new Error("Quote is not stale yet");
      }

      const customer = findOrThrow(state.customers, quote.customerId, "customer");

      if (customer.email === null) {
        throw new Error("Customer email is required before sending a follow-up");
      }

      const now = new Date().toISOString();
      quote.updatedAt = now;
      state.events.push(createEvent(quote.id, "followed_up", { channel: "email" }));
      state.sentEmails.push({
        id: randomUUID(),
        quoteId: quote.id,
        to: customer.email,
        subject: `Reminder: quote from ${state.org.name}`,
        publicUrl: `${publicQuoteBaseUrl}/${quote.publicToken}`,
        purpose: "quote_follow_up",
        sentAt: now
      });
      refreshStatuses(state);

      return quote;
    },

    getSentEmails() {
      return state.sentEmails;
    },

    getPublicQuote(token: string) {
      refreshStatuses(state);
      return findByTokenOrThrow(state.quotes, token);
    },

    viewPublicQuote(token: string) {
      const quote = findByTokenOrThrow(state.quotes, token);

      if (quote.firstViewedAt === null) {
        const now = new Date().toISOString();
        quote.firstViewedAt = now;
        quote.updatedAt = now;
        state.events.push(createEvent(quote.id, "viewed"));
        refreshStatuses(state);
      }

      return quote;
    },

    respondToPublicQuote(token: string, action: "accept" | "decline") {
      const quote = findByTokenOrThrow(state.quotes, token);
      refreshStatuses(state);

      if (
        action === "accept" &&
        !canAcceptPublicQuote({
          status: quote.status,
          validUntil: quote.validUntil,
          now: new Date()
        })
      ) {
        throw new Error("Expired or superseded quotes cannot be accepted");
      }

      if (quote.respondedAt !== null) {
        throw new Error("Quote has already been responded to");
      }

      const now = new Date().toISOString();
      quote.respondedAt = now;
      quote.updatedAt = now;
      state.events.push(createEvent(quote.id, action === "accept" ? "accepted" : "declined"));
      refreshStatuses(state);

      return quote;
    }
  };
}

export function quoteResponse(state: AppState, quote: QuoteRecord) {
  return {
    ...quote,
    customer: state.customers.find((customer) => customer.id === quote.customerId) ?? null,
    sendBlockers: getQuoteSendBlockers(quote.lineItems),
    isStale: isQuoteStale({
      sentAt: quote.sentAt,
      firstViewedAt: quote.firstViewedAt,
      respondedAt: quote.respondedAt,
      now: new Date()
    })
  };
}

function computeTotalsIfReady(quote: QuoteRecord): QuoteTotalsSnapshot | null {
  if (getQuoteSendBlockers(quote.lineItems).reasons.length > 0) {
    return null;
  }

  return computeQuoteTotals({
    lineItems: quote.lineItems,
    discount: quote.discount,
    taxRate: quote.taxRate
  });
}

function refreshStatuses(state: AppState): void {
  for (const quote of state.quotes) {
    quote.status = deriveQuoteStatus({
      events: state.events.filter((event) => event.quoteId === quote.id),
      validUntil: quote.validUntil,
      now: new Date()
    });
  }
}

function createEvent(
  quoteId: string,
  type: QuoteEvent["type"],
  meta: Record<string, unknown> = {}
): QuoteEvent {
  return {
    id: randomUUID(),
    quoteId,
    type,
    meta,
    createdAt: new Date().toISOString()
  };
}

function findOrThrow<T extends { id: string }>(items: T[], id: string, type: string): T {
  const item = items.find((candidate) => candidate.id === id);

  if (!item) {
    throw new Error(`${type} not found`);
  }

  return item;
}

function findByTokenOrThrow(quotes: QuoteRecord[], token: string): QuoteRecord {
  const quote = quotes.find((candidate) => candidate.publicToken === token);

  if (!quote) {
    throw new Error("quote not found");
  }

  return quote;
}

function assertDraftMutable(quote: QuoteRecord): void {
  if (quote.status !== "draft") {
    throw new Error("Sent/responded quotes are immutable; revise to create a new draft");
  }
}

function addDays(date: Date, days: number): string {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

function buildScopeSummary(customerName: string, checklist: PainterChecklist, notes: string[]): string {
  const roomCount = checklist.rooms.small + checklist.rooms.medium + checklist.rooms.large;
  const surfaces = [
    checklist.surfaces.walls ? "walls" : null,
    checklist.surfaces.ceilings ? "ceilings" : null,
    checklist.surfaces.trim ? "trim" : null
  ].filter(Boolean);
  const scope = `Painting quote for ${customerName}: ${roomCount} ${roomCount === 1 ? "room" : "rooms"}, ${surfaces.join(", ")}, ${checklist.coatCount} ${checklist.coatCount === 1 ? "coat" : "coats"}.`;

  return [scope, ...notes].join(" ");
}

function slugKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}
