import { beforeEach, describe, expect, it } from "vitest";
import type { MeResponse } from "../src/api/client";
import {
  defaultChecklist,
  useQuoteStore,
  type QuoteRecord,
} from "../src/state/quoteStore";
import type { PriceBookItem } from "@snapquote/shared";

const now = "2026-07-23T12:00:00.000Z";
const orgId = "00000000-0000-4000-8000-000000000001";

function item(overrides: Partial<PriceBookItem> = {}): PriceBookItem {
  return {
    id: "00000000-0000-4000-8000-000000000101",
    orgId,
    key: "paint_walls",
    name: "Paint walls",
    description: "Wall painting.",
    unit: "room",
    pricing: {
      type: "room_size",
      prices: { small: 25000, medium: 42000, large: 65000 },
    },
    kind: "labour",
    starter: true,
    confirmedAt: null,
    usageCount: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function quoteWithYellowLine(priceBookItemId: string): QuoteRecord {
  return {
    id: "quote-local",
    customerId: "customer-local",
    address: "18 Victor Ave",
    jobTitle: "Interior repair",
    lineItems: [
      {
        id: "line-local",
        position: 0,
        description: "Patch nail holes",
        quantity: 1,
        unit: "room",
        unitPriceCents: 5000,
        kind: "labour",
        source: "price_book",
        priceBookItemId,
        priceBookItemKey: "patch_nail_holes",
        matchConfidence: 0.75,
        matchState: "yellow",
      },
    ],
    discount: { type: "none", value: 0 },
    taxRate: 0.13,
    notes: "",
    terms: "",
    validUntil: "2026-08-06",
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
  };
}

function me(): MeResponse {
  return {
    user: {
      id: "user-1",
      orgId,
      email: "owner@example.com",
      name: "Owner",
      role: "owner",
    },
    org: {
      id: orgId,
      name: "SnapQuote Services",
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
    entitlements: {
      canSendQuotes: true,
      trialEndsAt: null,
    },
  };
}

describe("price book state", () => {
  beforeEach(() => {
    useQuoteStore.setState({
      priceBookItems: [],
      customers: [],
      quotes: [],
      events: [],
    });
  });

  it("creates and updates a local custom price item", () => {
    useQuoteStore.getState().addPriceBookItem({
      name: "Pressure wash siding",
      description: "Exterior prep",
      unit: "flat",
      kind: "labour",
      pricing: { type: "fixed", unitPriceCents: 18000 },
    });

    const created = useQuoteStore.getState().priceBookItems[0];
    expect(created?.name).toBe("Pressure wash siding");
    expect(created?.confirmedAt).not.toBeNull();
    expect(created?.usageCount).toBe(0);

    useQuoteStore.getState().updatePriceBookItem(created?.id ?? "", {
      name: "Pressure wash exterior",
      description: "Exterior washing before paint",
      pricing: { type: "fixed", unitPriceCents: 22000 },
    });

    const updated = useQuoteStore.getState().priceBookItems[0];
    expect(updated?.name).toBe("Pressure wash exterior");
    expect(updated?.description).toBe("Exterior washing before paint");
    expect(updated?.pricing).toEqual({
      type: "fixed",
      unitPriceCents: 22000,
    });
  });

  it("confirms a yellow line and increments the matched item usage count", () => {
    const starter = item({
      id: "00000000-0000-4000-8000-000000000106",
      key: "patch_nail_holes",
      name: "Patch nail holes",
      usageCount: 2,
    });

    useQuoteStore.setState({
      priceBookItems: [starter],
      quotes: [quoteWithYellowLine(starter.id)],
    });

    useQuoteStore.getState().confirmYellowLine("quote-local", "line-local");

    const confirmed = useQuoteStore.getState().priceBookItems[0];
    const line = useQuoteStore.getState().quotes[0]?.lineItems[0];
    expect(confirmed?.confirmedAt).not.toBeNull();
    expect(confirmed?.usageCount).toBe(3);
    expect(line?.matchState).toBe("green");
  });

  it("archives a local price item from the active list", () => {
    const active = item({ confirmedAt: now });
    useQuoteStore.setState({ priceBookItems: [active] });

    useQuoteStore.getState().archivePriceBookItem(active.id);

    expect(useQuoteStore.getState().priceBookItems).toEqual([]);
  });

  it("archives a local quote from the active list", () => {
    const quote = { ...quoteWithYellowLine("item-confirmed"), sentAt: now };
    useQuoteStore.setState({
      quotes: [quote],
      events: [
        {
          id: "event-sent",
          quoteId: quote.id,
          type: "sent",
          meta: { channel: "email" },
          createdAt: now,
        },
      ],
    });

    useQuoteStore.getState().archiveQuote(quote.id);

    expect(useQuoteStore.getState().quotes).toEqual([]);
    expect(useQuoteStore.getState().events).toEqual([]);
  });

  it("removes only local artifacts that were synced remotely", () => {
    const syncedQuote = quoteWithYellowLine("item-confirmed");
    const unsyncedQuote = {
      ...quoteWithYellowLine("item-confirmed"),
      id: "quote-unsynced",
    };
    const localCustomer = {
      id: "cust-local",
      orgId,
      name: "Maya Chen",
      email: "maya@example.com",
      phone: null,
      address: "18 Victor Ave",
      createdAt: now,
    };
    const syncedItem = item({
      id: "pbi-local",
      key: "custom_cleanup",
      name: "Custom cleanup",
      starter: false,
    });
    const unsyncedItem = item({
      id: "pbi-unsynced",
      key: "custom_prep",
      name: "Custom prep",
      starter: false,
    });

    useQuoteStore.setState({
      customers: [localCustomer],
      priceBookItems: [syncedItem, unsyncedItem],
      quotes: [syncedQuote, unsyncedQuote],
      events: [
        {
          id: "event-synced",
          quoteId: syncedQuote.id,
          type: "created",
          meta: {},
          createdAt: now,
        },
        {
          id: "event-unsynced",
          quoteId: unsyncedQuote.id,
          type: "created",
          meta: {},
          createdAt: now,
        },
      ],
    });

    useQuoteStore.getState().removeLocalSyncArtifacts({
      customerIds: [localCustomer.id],
      priceBookItemIds: [syncedItem.id],
      quoteIds: [syncedQuote.id],
    });

    expect(useQuoteStore.getState().customers).toEqual([]);
    expect(useQuoteStore.getState().priceBookItems).toEqual([unsyncedItem]);
    expect(useQuoteStore.getState().quotes).toEqual([unsyncedQuote]);
    expect(useQuoteStore.getState().events).toEqual([
      {
        id: "event-unsynced",
        quoteId: unsyncedQuote.id,
        type: "created",
        meta: {},
        createdAt: now,
      },
    ]);
  });

  it("keeps remote price items over local items with the same key during hydration", () => {
    const remote = item({
      id: "00000000-0000-4000-8000-000000000201",
      key: "paint_walls",
      name: "Remote paint walls",
      confirmedAt: now,
    });
    const localConflict = item({
      id: "pbi-local-conflict",
      key: "paint_walls",
      name: "Local paint walls",
      confirmedAt: now,
    });
    const localUnique = item({
      id: "pbi-local-unique",
      key: "custom_cleanup",
      name: "Custom cleanup",
      starter: false,
      confirmedAt: now,
    });

    useQuoteStore.setState({ priceBookItems: [localConflict, localUnique] });
    useQuoteStore.getState().hydrateRemoteState({
      me: me(),
      priceBookItems: [remote],
      customers: [],
      quotes: [],
    });

    expect(
      useQuoteStore.getState().priceBookItems.map((candidate) => candidate.name),
    ).toEqual(["Remote paint walls", "Custom cleanup"]);
  });
});
