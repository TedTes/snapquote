import {
  buildPainterStarterPriceBook,
  computeQuoteTotals,
  createPainterDraftLines,
  deriveQuoteStatus,
  getQuoteSendBlockers,
  isQuoteStale,
  type Customer,
  type DraftConflict,
  type PainterChecklist,
  type PainterCorePriceInput,
  type PainterPriceBookKey,
  type PriceBookItem,
  type PriceBookPricing,
  type QuoteDiscount,
  type QuoteEvent,
  type QuoteLineItem,
  type QuoteStatus,
  type SendBlockers,
  type QuoteTotals,
} from "@snapquote/shared";
import { create } from "zustand";
import type { ApiQuote, MeResponse } from "../lib/api";

export type StoredLineItem = QuoteLineItem & { id: string };

export type QuoteRecord = {
  id: string;
  customerId: string;
  address: string;
  jobTitle: string;
  lineItems: StoredLineItem[];
  discount: QuoteDiscount;
  taxRate: number;
  notes: string;
  terms: string;
  validUntil: string;
  scopeSummary: string;
  scopeNotes: string[];
  conflicts: DraftConflict[];
  checklist: PainterChecklist;
  transcript: string;
  sentAt: string | null;
  firstViewedAt: string | null;
  respondedAt: string | null;
  supersededByQuoteId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WizardState = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  address: string;
  jobTitle: string;
  checklist: PainterChecklist;
  transcript: string;
};

export type LineItemFormInput = {
  description: string;
  quantity: number;
  unit: QuoteLineItem["unit"];
  unitPriceCents: number;
  kind: QuoteLineItem["kind"];
};

const orgId = "00000000-0000-4000-8000-000000000001";

const starterIds: Record<PainterPriceBookKey, string> = {
  paint_walls: "00000000-0000-4000-8000-100000000001",
  paint_ceiling: "00000000-0000-4000-8000-100000000002",
  paint_trim: "00000000-0000-4000-8000-100000000003",
  paint_door: "00000000-0000-4000-8000-100000000004",
  heavy_wall_prep: "00000000-0000-4000-8000-100000000005",
  patch_nail_holes: "00000000-0000-4000-8000-100000000006",
  primer_coat: "00000000-0000-4000-8000-100000000007",
  material_allowance: "00000000-0000-4000-8000-100000000008",
};

export const defaultCorePrices: PainterCorePriceInput = {
  paintWalls: { small: 25000, medium: 42000, large: 65000 },
  paintCeiling: { small: 12000, medium: 18000, large: 26000 },
  paintTrim: { small: 9000, medium: 16000, large: 24000 },
  paintDoorEachCents: 9500,
  heavyPrepHourlyCents: 8500,
};

export const defaultChecklist: PainterChecklist = {
  rooms: { small: 0, medium: 2, large: 0 },
  surfaces: { walls: true, ceilings: true, trim: true },
  doorCount: 2,
  prepLevel: "normal",
  coatCount: 2,
  customerSuppliesPaint: true,
};

function defaultWizard(): WizardState {
  return {
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    address: "",
    jobTitle: "",
    checklist: {
      rooms: { ...defaultChecklist.rooms },
      surfaces: { ...defaultChecklist.surfaces },
      doorCount: defaultChecklist.doorCount,
      prepLevel: defaultChecklist.prepLevel,
      coatCount: defaultChecklist.coatCount,
      customerSuppliesPaint: defaultChecklist.customerSuppliesPaint,
    },
    transcript: "",
  };
}

type MvpState = {
  onboarded: boolean;
  businessName: string;
  defaultTaxRate: number;
  defaultTerms: string;
  quoteValidDays: number;
  setupCompletedAt: string | null;

  priceBookItems: PriceBookItem[];
  customers: Customer[];
  quotes: QuoteRecord[];
  events: QuoteEvent[];

  wizard: WizardState;

  completeOnboarding: (input: {
    businessName: string;
    defaultTaxRate: number;
    defaultTerms?: string;
    quoteValidDays?: number;
    corePrices: PainterCorePriceInput;
    priceBookItems?: PriceBookItem[];
  }) => void;
  updateOrgSettings: (input: {
    businessName?: string;
    defaultTaxRate?: number;
    defaultTerms?: string;
    quoteValidDays?: number;
  }) => void;

  startNewQuoteWizard: () => void;
  updateWizard: (patch: Partial<WizardState>) => void;
  generateDraftFromWizard: () => QuoteRecord;

  updateLineItem: (
    quoteId: string,
    lineId: string,
    patch: LineItemFormInput,
  ) => void;
  addManualLine: (quoteId: string, input: LineItemFormInput) => string;
  removeLine: (quoteId: string, lineId: string) => void;
  updateQuoteDiscount: (quoteId: string, discount: QuoteDiscount) => void;
  confirmYellowLine: (quoteId: string, lineId: string) => void;
  saveLineToPriceBook: (quoteId: string, lineId: string) => void;

  sendQuote: (quoteId: string) => void;
  followUpQuote: (quoteId: string) => void;
  deleteDraftQuote: (quoteId: string) => void;
  reviseQuote: (quoteId: string) => string;
  duplicateQuote: (quoteId: string) => string;

  confirmPriceBookItem: (itemId: string, pricing: PriceBookPricing) => void;
  updatePriceBookItem: (
    itemId: string,
    patch: {
      name?: string;
      description?: string;
      pricing?: PriceBookPricing;
    },
  ) => void;
  archivePriceBookItem: (itemId: string) => void;
  addPriceBookItem: (input: {
    name: string;
    description: string;
    unit: PriceBookItem["unit"];
    kind: PriceBookItem["kind"];
    pricing: PriceBookPricing;
  }) => void;
  upsertPriceBookItem: (item: PriceBookItem) => void;
  upsertRemoteQuote: (quote: ApiQuote) => void;
  removeRemoteQuote: (quoteId: string) => void;
  hydrateRemoteState: (input: {
    me: MeResponse;
    priceBookItems: PriceBookItem[];
    customers: Customer[];
    quotes: ApiQuote[];
  }) => void;
};

const initialPriceBook = buildPainterStarterPriceBook({
  orgId,
  now: new Date().toISOString(),
  makeId: (key) => starterIds[key],
  corePrices: defaultCorePrices,
});

export const useMvpStore = create<MvpState>((set, get) => ({
  onboarded: false,
  businessName: "",
  defaultTaxRate: 0.13,
  defaultTerms:
    "50% deposit due to schedule the job, balance due on completion.",
  quoteValidDays: 14,
  setupCompletedAt: null,
  priceBookItems: initialPriceBook,
  customers: [],
  quotes: [],
  events: [],
  wizard: defaultWizard(),

  completeOnboarding: (input) => {
    const priceBookItems =
      input.priceBookItems ??
      buildPainterStarterPriceBook({
        orgId,
        now: new Date().toISOString(),
        makeId: (key) => starterIds[key],
        corePrices: input.corePrices,
      });

    set({
      onboarded: true,
      businessName: input.businessName,
      defaultTaxRate: input.defaultTaxRate,
      defaultTerms: input.defaultTerms ?? get().defaultTerms,
      quoteValidDays: input.quoteValidDays ?? get().quoteValidDays,
      setupCompletedAt: new Date().toISOString(),
      priceBookItems,
    });
  },

  updateOrgSettings: (input) => {
    set((state) => ({
      businessName: input.businessName ?? state.businessName,
      defaultTaxRate: input.defaultTaxRate ?? state.defaultTaxRate,
      defaultTerms: input.defaultTerms ?? state.defaultTerms,
      quoteValidDays: input.quoteValidDays ?? state.quoteValidDays,
    }));
  },

  startNewQuoteWizard: () =>
    set((state) => ({
      priceBookItems: ensureCoreStarterPrices(state.priceBookItems),
      wizard: defaultWizard(),
    })),

  updateWizard: (patch) =>
    set((state) => ({ wizard: { ...state.wizard, ...patch } })),

  generateDraftFromWizard: () => {
    const state = get();
    const wizard = state.wizard;
    const now = new Date();
    const nowIso = now.toISOString();

    const customer: Customer = {
      id: makeId("cust"),
      orgId,
      name: wizard.customerName.trim() || "Unnamed customer",
      email: wizard.customerEmail.trim(),
      phone:
        wizard.customerPhone.trim().length > 0
          ? wizard.customerPhone.trim()
          : null,
      address: wizard.address.trim(),
      createdAt: nowIso,
    };

    const draft = createPainterDraftLines({
      checklist: wizard.checklist,
      transcript: wizard.transcript,
      priceBookItems: state.priceBookItems,
    });

    const lineItems: StoredLineItem[] = draft.lineItems.map((line) => ({
      ...line,
      id: makeId("line"),
    }));

    const quote: QuoteRecord = {
      id: makeId("quote"),
      customerId: customer.id,
      address: customer.address,
      jobTitle: wizard.jobTitle.trim(),
      lineItems,
      discount: { type: "none", value: 0 },
      taxRate: state.defaultTaxRate,
      notes: "",
      terms: state.defaultTerms,
      validUntil: addDays(now, state.quoteValidDays),
      scopeSummary: buildScopeSummary(
        customer.name,
        wizard.checklist,
        draft.scopeNotes,
      ),
      scopeNotes: draft.scopeNotes,
      conflicts: draft.conflicts,
      checklist: wizard.checklist,
      transcript: wizard.transcript,
      sentAt: null,
      firstViewedAt: null,
      respondedAt: null,
      supersededByQuoteId: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    set((current) => ({
      customers: [customer, ...current.customers],
      quotes: [quote, ...current.quotes],
      events: [...current.events, createEvent(quote.id, "created")],
      wizard: defaultWizard(),
    }));

    return quote;
  },

  updateLineItem: (quoteId, lineId, patch) => {
    set((state) => ({
      quotes: state.quotes.map((quote) => {
        if (quote.id !== quoteId) {
          return quote;
        }

        return withUpdatedAt({
          ...quote,
          lineItems: quote.lineItems.map((line) =>
            line.id === lineId
              ? {
                  ...line,
                  description: patch.description,
                  quantity: patch.quantity,
                  unit: patch.unit,
                  unitPriceCents: patch.unitPriceCents,
                  kind: patch.kind,
                  source: "manual" as const,
                  priceBookItemId: null,
                  matchConfidence: null,
                  matchState: "green" as const,
                }
              : line,
          ),
        });
      }),
    }));
  },

  addManualLine: (quoteId, input) => {
    const id = makeId("line");

    set((state) => ({
      quotes: state.quotes.map((quote) => {
        if (quote.id !== quoteId) {
          return quote;
        }

        const line: StoredLineItem = {
          id,
          position: quote.lineItems.length,
          description: input.description,
          quantity: input.quantity,
          unit: input.unit,
          unitPriceCents: input.unitPriceCents,
          kind: input.kind,
          source: "manual",
          priceBookItemId: null,
          matchConfidence: null,
          matchState: "green",
        };

        return withUpdatedAt({
          ...quote,
          lineItems: [...quote.lineItems, line],
        });
      }),
    }));

    return id;
  },

  removeLine: (quoteId, lineId) => {
    set((state) => ({
      quotes: state.quotes.map((quote) =>
        quote.id === quoteId
          ? withUpdatedAt({
              ...quote,
              lineItems: quote.lineItems.filter((line) => line.id !== lineId),
            })
          : quote,
      ),
    }));
  },

  updateQuoteDiscount: (quoteId, discount) => {
    set((state) => ({
      quotes: state.quotes.map((quote) =>
        quote.id === quoteId ? withUpdatedAt({ ...quote, discount }) : quote,
      ),
    }));
  },

  confirmYellowLine: (quoteId, lineId) => {
    const now = new Date().toISOString();

    set((state) => {
      const quote = state.quotes.find((candidate) => candidate.id === quoteId);
      const line = quote?.lineItems.find(
        (candidate) => candidate.id === lineId,
      );

      if (
        !quote ||
        !line ||
        line.matchState !== "yellow" ||
        line.priceBookItemId === null
      ) {
        return state;
      }

      const priceBookItemId = line.priceBookItemId;

      return {
        priceBookItems: state.priceBookItems.map((item) =>
          item.id === priceBookItemId
            ? {
                ...item,
                confirmedAt: now,
                usageCount: item.usageCount + 1,
                updatedAt: now,
              }
            : item,
        ),
        quotes: state.quotes.map((candidate) =>
          candidate.id === quoteId
            ? withUpdatedAt({
                ...candidate,
                lineItems: candidate.lineItems.map((candidateLine) =>
                  candidateLine.id === lineId
                    ? {
                        ...candidateLine,
                        matchState: "green" as const,
                        matchConfidence: 1,
                      }
                    : candidateLine,
                ),
              })
            : candidate,
        ),
      };
    });
  },

  saveLineToPriceBook: (quoteId, lineId) => {
    const now = new Date().toISOString();

    set((state) => {
      const quote = state.quotes.find((candidate) => candidate.id === quoteId);
      const line = quote?.lineItems.find(
        (candidate) => candidate.id === lineId,
      );

      if (!quote || !line || line.unitPriceCents === null) {
        return state;
      }

      const item: PriceBookItem = {
        id: makeId("pbi"),
        orgId,
        key: line.priceBookItemKey ?? slugKey(line.description),
        name: line.description,
        description: line.description,
        unit: line.unit ?? "flat",
        pricing: { type: "fixed", unitPriceCents: line.unitPriceCents },
        kind: line.kind,
        starter: false,
        confirmedAt: now,
        usageCount: 1,
        createdAt: now,
        updatedAt: now,
      };

      return {
        priceBookItems: [item, ...state.priceBookItems],
        quotes: state.quotes.map((candidate) =>
          candidate.id === quoteId
            ? withUpdatedAt({
                ...candidate,
                lineItems: candidate.lineItems.map((candidateLine) =>
                  candidateLine.id === lineId
                    ? {
                        ...candidateLine,
                        source: "price_book" as const,
                        priceBookItemId: item.id,
                        priceBookItemKey: item.key,
                        matchConfidence: 1,
                        matchState: "green" as const,
                      }
                    : candidateLine,
                ),
              })
            : candidate,
        ),
      };
    });
  },

  sendQuote: (quoteId) => {
    const now = new Date().toISOString();

    set((state) => {
      const quote = state.quotes.find((candidate) => candidate.id === quoteId);

      if (!quote || getQuoteSendBlockers(quote.lineItems).reasons.length > 0) {
        return state;
      }

      return {
        quotes: state.quotes.map((candidate) =>
          candidate.id === quoteId
            ? { ...candidate, sentAt: now, updatedAt: now }
            : candidate,
        ),
        events: [
          ...state.events,
          createEvent(quoteId, "sent", { channel: "email" }),
        ],
      };
    });
  },

  followUpQuote: (quoteId) => {
    const now = new Date().toISOString();

    set((state) => {
      const quote = state.quotes.find((candidate) => candidate.id === quoteId);

      if (!quote) {
        return state;
      }

      const status = deriveQuoteStatus({
        events: getQuoteEvents(state.events, quoteId),
        validUntil: quote.validUntil,
        now: new Date(),
      });

      const stale = isQuoteStale({
        sentAt: quote.sentAt,
        firstViewedAt: quote.firstViewedAt,
        respondedAt: quote.respondedAt,
        now: new Date(),
      });

      if ((status !== "sent" && status !== "viewed") || !stale) {
        return state;
      }

      return {
        quotes: state.quotes.map((candidate) =>
          candidate.id === quoteId
            ? { ...candidate, updatedAt: now }
            : candidate,
        ),
        events: [
          ...state.events,
          createEvent(quoteId, "followed_up", { channel: "email" }),
        ],
      };
    });
  },

  deleteDraftQuote: (quoteId) => {
    set((state) => ({
      quotes: state.quotes.filter((quote) => quote.id !== quoteId),
      events: state.events.filter((event) => event.quoteId !== quoteId),
    }));
  },

  reviseQuote: (quoteId) => {
    const newId = makeId("quote");
    const now = new Date().toISOString();

    set((state) => {
      const clone = cloneQuoteAsDraft(state.quotes, quoteId, newId, now);

      if (!clone) {
        return state;
      }

      return {
        quotes: [
          clone,
          ...state.quotes.map((candidate) =>
            candidate.id === quoteId
              ? { ...candidate, supersededByQuoteId: newId, updatedAt: now }
              : candidate,
          ),
        ],
        events: [
          ...state.events,
          createEvent(newId, "created"),
          createEvent(quoteId, "superseded"),
        ],
      };
    });

    return newId;
  },

  duplicateQuote: (quoteId) => {
    const newId = makeId("quote");
    const now = new Date().toISOString();

    set((state) => {
      const clone = cloneQuoteAsDraft(state.quotes, quoteId, newId, now);

      if (!clone) {
        return state;
      }

      return {
        quotes: [clone, ...state.quotes],
        events: [...state.events, createEvent(newId, "created")],
      };
    });

    return newId;
  },

  confirmPriceBookItem: (itemId, pricing) => {
    const now = new Date().toISOString();

    set((state) => ({
      priceBookItems: state.priceBookItems.map((item) =>
        item.id === itemId
          ? { ...item, pricing, confirmedAt: now, updatedAt: now }
          : item,
      ),
    }));
  },

  updatePriceBookItem: (itemId, patch) => {
    const now = new Date().toISOString();

    set((state) => ({
      priceBookItems: state.priceBookItems.map((item) => {
        if (item.id !== itemId) {
          return item;
        }

        return {
          ...item,
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.description !== undefined
            ? { description: patch.description }
            : {}),
          ...(patch.pricing !== undefined ? { pricing: patch.pricing } : {}),
          updatedAt: now,
        };
      }),
    }));
  },

  archivePriceBookItem: (itemId) => {
    set((state) => ({
      priceBookItems: state.priceBookItems.filter((item) => item.id !== itemId),
    }));
  },

  addPriceBookItem: (input) => {
    const now = new Date().toISOString();
    const item: PriceBookItem = {
      id: makeId("pbi"),
      orgId,
      key: slugKey(input.name),
      name: input.name,
      description: input.description,
      unit: input.unit,
      pricing: input.pricing,
      kind: input.kind,
      starter: false,
      confirmedAt: now,
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    set((state) => ({ priceBookItems: [item, ...state.priceBookItems] }));
  },

  upsertPriceBookItem: (item) => {
    set((state) => {
      const exists = state.priceBookItems.some(
        (candidate) => candidate.id === item.id,
      );

      return {
        priceBookItems: exists
          ? state.priceBookItems.map((candidate) =>
              candidate.id === item.id ? item : candidate,
            )
          : [item, ...state.priceBookItems],
      };
    });
  },

  upsertRemoteQuote: (quote) => {
    set((state) => {
      const localQuote = remoteQuoteToLocal(quote);
      const quoteExists = state.quotes.some(
        (candidate) => candidate.id === quote.id,
      );
      const customerExists = state.customers.some(
        (customer) => customer.id === quote.customerId,
      );
      const remoteEvents = remoteQuoteEvents(quote);
      const localEvents = state.events.filter(
        (event) => event.quoteId !== quote.id,
      );

      return {
        customers:
          quote.customer !== null && !customerExists
            ? [quote.customer, ...state.customers]
            : state.customers.map((customer) =>
                customer.id === quote.customerId && quote.customer !== null
                  ? quote.customer
                  : customer,
              ),
        quotes: quoteExists
          ? state.quotes.map((candidate) =>
              candidate.id === quote.id ? localQuote : candidate,
            )
          : [localQuote, ...state.quotes],
        events: [...localEvents, ...remoteEvents],
      };
    });
  },

  removeRemoteQuote: (quoteId) => {
    set((state) => ({
      quotes: state.quotes.filter((quote) => quote.id !== quoteId),
      events: state.events.filter((event) => event.quoteId !== quoteId),
    }));
  },

  hydrateRemoteState: (input) => {
    set((state) => {
      const localCustomers = state.customers.filter((customer) =>
        customer.id.startsWith("cust-"),
      );
      const localQuotes = state.quotes.filter((quote) =>
        quote.id.startsWith("quote-"),
      );
      const localPriceBookItems = state.priceBookItems.filter((item) =>
        item.id.startsWith("pbi-") && !item.starter,
      );
      const localEvents = state.events.filter((event) =>
        localQuotes.some((quote) => quote.id === event.quoteId),
      );
      const remoteQuotes = input.quotes.map(remoteQuoteToLocal);
      const remoteEvents = input.quotes.flatMap(remoteQuoteEvents);

      return {
        onboarded: true,
        businessName: input.me.org.name ?? "",
        defaultTaxRate: Number.isFinite(input.me.org.defaultTaxRate)
          ? input.me.org.defaultTaxRate
          : 0.13,
        defaultTerms:
          input.me.org.defaultTerms ??
          "50% deposit due to schedule the job, balance due on completion.",
        quoteValidDays: input.me.org.quoteValidDays ?? 14,
        setupCompletedAt: input.me.org.setupCompletedAt,
        priceBookItems: mergePriceBookItems(
          input.priceBookItems,
          localPriceBookItems,
        ),
        customers: mergeById(input.customers, localCustomers),
        quotes: mergeById(remoteQuotes, localQuotes),
        events: [...remoteEvents, ...localEvents],
      };
    });
  },
}));

function remoteQuoteToLocal(quote: ApiQuote): QuoteRecord {
  return {
    id: quote.id,
    customerId: quote.customerId,
    address: quote.address,
    jobTitle: quote.jobTitle,
    lineItems: quote.lineItems,
    discount: quote.discount,
    taxRate: quote.taxRate,
    notes: quote.notes,
    terms: quote.terms,
    validUntil: quote.validUntil,
    scopeSummary: quote.scopeSummary,
    scopeNotes: quote.scopeNotes,
    conflicts: quote.conflicts,
    checklist: quote.checklist,
    transcript: quote.transcript,
    sentAt: quote.sentAt,
    firstViewedAt: quote.firstViewedAt,
    respondedAt: quote.respondedAt,
    supersededByQuoteId: quote.supersededByQuoteId,
    createdAt: quote.createdAt,
    updatedAt: quote.updatedAt,
  };
}

function remoteQuoteEvents(quote: ApiQuote): QuoteEvent[] {
  const events: QuoteEvent[] = [
    {
      id: `${quote.id}-remote-created`,
      quoteId: quote.id,
      type: "created",
      meta: {},
      createdAt: quote.createdAt,
    },
  ];

  if (quote.sentAt !== null) {
    events.push({
      id: `${quote.id}-remote-sent`,
      quoteId: quote.id,
      type: "sent",
      meta: { channel: "email" },
      createdAt: quote.sentAt,
    });
  }

  if (quote.firstViewedAt !== null) {
    events.push({
      id: `${quote.id}-remote-viewed`,
      quoteId: quote.id,
      type: "viewed",
      meta: {},
      createdAt: quote.firstViewedAt,
    });
  }

  if (
    quote.respondedAt !== null &&
    (quote.status === "accepted" || quote.status === "declined")
  ) {
    events.push({
      id: `${quote.id}-remote-${quote.status}`,
      quoteId: quote.id,
      type: quote.status,
      meta: {},
      createdAt: quote.respondedAt,
    });
  }

  if (quote.supersededByQuoteId !== null) {
    events.push({
      id: `${quote.id}-remote-superseded`,
      quoteId: quote.id,
      type: "superseded",
      meta: { supersededByQuoteId: quote.supersededByQuoteId },
      createdAt: quote.updatedAt,
    });
  }

  return events;
}

function mergeById<T extends { id: string }>(
  remoteItems: T[],
  localItems: T[],
): T[] {
  const remoteIds = new Set(remoteItems.map((item) => item.id));
  const uniqueLocalItems = localItems.filter((item) => !remoteIds.has(item.id));
  return [...remoteItems, ...uniqueLocalItems];
}

function mergePriceBookItems(
  remoteItems: PriceBookItem[],
  localItems: PriceBookItem[],
): PriceBookItem[] {
  const remoteIds = new Set(remoteItems.map((item) => item.id));
  const remoteKeys = new Set(
    remoteItems
      .map((item) => item.key)
      .filter((key): key is string => key !== null && key.length > 0),
  );
  const uniqueLocalItems = localItems.filter((item) => {
    if (remoteIds.has(item.id)) {
      return false;
    }

    return item.key === null || !remoteKeys.has(item.key);
  });

  return [...remoteItems, ...uniqueLocalItems];
}

function ensureCoreStarterPrices(items: PriceBookItem[]): PriceBookItem[] {
  const now = new Date().toISOString();

  return items.map((item) => {
    if (item.confirmedAt !== null) {
      return item;
    }

    const pricing = defaultPricingForCoreStarter(item.key);

    if (pricing === null) {
      return item;
    }

    return {
      ...item,
      pricing,
      confirmedAt: now,
      updatedAt: now,
    };
  });
}

function defaultPricingForCoreStarter(
  key: PriceBookItem["key"],
): PriceBookPricing | null {
  switch (key) {
    case "paint_walls":
      return { type: "room_size", prices: defaultCorePrices.paintWalls };
    case "paint_ceiling":
      return { type: "room_size", prices: defaultCorePrices.paintCeiling };
    case "paint_trim":
      return { type: "room_size", prices: defaultCorePrices.paintTrim };
    case "paint_door":
      return {
        type: "fixed",
        unitPriceCents: defaultCorePrices.paintDoorEachCents,
      };
    case "heavy_wall_prep":
      return {
        type: "fixed",
        unitPriceCents: defaultCorePrices.heavyPrepHourlyCents,
      };
    default:
      return null;
  }
}

export function getQuoteEvents(
  events: QuoteEvent[],
  quoteId: string,
): QuoteEvent[] {
  return events
    .filter((event) => event.quoteId === quoteId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function getQuoteStatus(
  quote: QuoteRecord,
  events: QuoteEvent[],
): QuoteStatus {
  return deriveQuoteStatus({
    events: getQuoteEvents(events, quote.id),
    validUntil: quote.validUntil,
    now: new Date(),
  });
}

export function getQuoteBlockers(quote: QuoteRecord): SendBlockers {
  return getQuoteSendBlockers(quote.lineItems);
}

export function getQuoteTotals(quote: QuoteRecord): QuoteTotals | null {
  try {
    return computeQuoteTotals({
      lineItems: quote.lineItems,
      discount: quote.discount,
      taxRate: quote.taxRate,
    });
  } catch {
    return null;
  }
}

export function getQuoteIsStale(quote: QuoteRecord): boolean {
  return isQuoteStale({
    sentAt: quote.sentAt,
    firstViewedAt: quote.firstViewedAt,
    respondedAt: quote.respondedAt,
    now: new Date(),
  });
}

export function getCustomer(
  customers: Customer[],
  customerId: string,
): Customer | undefined {
  return customers.find((customer) => customer.id === customerId);
}

function cloneQuoteAsDraft(
  quotes: QuoteRecord[],
  quoteId: string,
  newId: string,
  now: string,
): QuoteRecord | null {
  const quote = quotes.find((candidate) => candidate.id === quoteId);

  if (!quote) {
    return null;
  }

  return {
    ...quote,
    id: newId,
    lineItems: quote.lineItems.map((line) => ({ ...line, id: makeId("line") })),
    sentAt: null,
    firstViewedAt: null,
    respondedAt: null,
    supersededByQuoteId: null,
    createdAt: now,
    updatedAt: now,
  };
}

function withUpdatedAt(quote: QuoteRecord): QuoteRecord {
  return { ...quote, updatedAt: new Date().toISOString() };
}

function createEvent(
  quoteId: string,
  type: QuoteEvent["type"],
  meta: Record<string, unknown> = {},
): QuoteEvent {
  return {
    id: makeId("evt"),
    quoteId,
    type,
    meta,
    createdAt: new Date().toISOString(),
  };
}

function addDays(date: Date, days: number): string {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

function buildScopeSummary(
  customerName: string,
  checklist: PainterChecklist,
  notes: string[],
): string {
  const roomCount =
    checklist.rooms.small + checklist.rooms.medium + checklist.rooms.large;
  const surfaces = [
    checklist.surfaces.walls ? "walls" : null,
    checklist.surfaces.ceilings ? "ceilings" : null,
    checklist.surfaces.trim ? "trim" : null,
  ].filter((surface): surface is string => surface !== null);
  const scope = `Painting quote for ${customerName}: ${roomCount} ${roomCount === 1 ? "room" : "rooms"}${
    surfaces.length > 0 ? `, ${surfaces.join(", ")}` : ""
  }, ${checklist.coatCount} ${checklist.coatCount === 1 ? "coat" : "coats"}.`;

  return [scope, ...notes].join(" ");
}

function slugKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function centsToDollars(cents: number): string {
  return String(Math.round(cents / 100));
}

export function dollarsToCents(dollars: string): number {
  const parsed = Number(dollars.replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

export function corePricesFromPriceBook(items: PriceBookItem[]): PainterCorePriceInput {
  return {
    paintWalls: roomSizePrices(items, "paint_walls", defaultCorePrices.paintWalls),
    paintCeiling: roomSizePrices(items, "paint_ceiling", defaultCorePrices.paintCeiling),
    paintTrim: roomSizePrices(items, "paint_trim", defaultCorePrices.paintTrim),
    paintDoorEachCents: fixedPrice(items, "paint_door", defaultCorePrices.paintDoorEachCents),
    heavyPrepHourlyCents: fixedPrice(items, "heavy_wall_prep", defaultCorePrices.heavyPrepHourlyCents),
  };
}

function roomSizePrices(
  items: PriceBookItem[],
  key: PainterPriceBookKey,
  fallback: PainterCorePriceInput["paintWalls"],
) {
  const pricing = items.find((item) => item.key === key)?.pricing;
  return pricing?.type === "room_size" ? pricing.prices : fallback;
}

function fixedPrice(items: PriceBookItem[], key: PainterPriceBookKey, fallback: number) {
  const pricing = items.find((item) => item.key === key)?.pricing;
  return pricing?.type === "fixed" ? pricing.unitPriceCents : fallback;
}
