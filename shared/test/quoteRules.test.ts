import { describe, expect, it } from "vitest";
import {
  canAcceptPublicQuote,
  deriveCustomerCity,
  deriveJobLabel,
  deriveQuoteStatus,
  getQuoteSendBlockers,
  isQuoteStale,
  sendQuoteSchema,
  type PainterChecklist,
  type QuoteEvent,
  type QuoteLineItem
} from "../src/index.js";

function checklist(overrides: Partial<PainterChecklist> = {}): PainterChecklist {
  return {
    rooms: { small: 0, medium: 0, large: 0 },
    surfaces: { walls: true, ceilings: true, trim: true },
    doorCount: 0,
    prepLevel: "normal",
    coatCount: 2,
    customerSuppliesPaint: false,
    ...overrides
  };
}

const pricedLine: QuoteLineItem = {
  position: 0,
  description: "Paint walls",
  quantity: 2,
  unit: "room",
  unitPriceCents: 40000,
  kind: "labour",
  source: "manual",
  priceBookItemId: null,
  priceBookItemKey: null,
  matchConfidence: null,
  matchState: "green"
};

const event = (type: QuoteEvent["type"], createdAt = "2026-07-20T12:00:00.000Z"): QuoteEvent => ({
  id: crypto.randomUUID(),
  quoteId: crypto.randomUUID(),
  type,
  meta: {},
  createdAt
});

describe("quote rules", () => {
  it("blocks sends for red and yellow lines", () => {
    expect(
      getQuoteSendBlockers([
        pricedLine,
        {
          ...pricedLine,
          matchState: "yellow"
        },
        {
          ...pricedLine,
          unitPriceCents: null,
          matchState: "red"
        }
      ])
    ).toEqual({
      redLineCount: 1,
      yellowLineCount: 1,
      reasons: ["1 line needs a price", "1 suggested line needs confirmation"]
    });
  });

  it("derives status from events with terminal statuses taking priority", () => {
    expect(
      deriveQuoteStatus({
        events: [event("created"), event("sent"), event("viewed"), event("accepted")],
        validUntil: "2026-07-30",
        now: new Date("2026-07-20T12:00:00.000Z")
      })
    ).toBe("accepted");
  });

  it("marks stale quotes after the configured age when unanswered", () => {
    expect(
      isQuoteStale({
        sentAt: "2026-07-16T12:00:00.000Z",
        firstViewedAt: null,
        respondedAt: null,
        now: new Date("2026-07-20T12:00:00.000Z")
      })
    ).toBe(true);
  });

  it("blocks public accept after expiry", () => {
    expect(
      canAcceptPublicQuote({
        status: "expired",
        validUntil: "2026-07-19",
        now: new Date("2026-07-20T12:00:00.000Z")
      })
    ).toBe(false);
  });

  it("accepts email and SMS as explicit quote delivery channels", () => {
    expect(sendQuoteSchema.parse({ channels: ["email"] })).toEqual({ channels: ["email"] });
    expect(sendQuoteSchema.parse({ channels: ["sms"] })).toEqual({ channels: ["sms"] });
    expect(sendQuoteSchema.parse({ channels: ["email", "sms"] })).toEqual({ channels: ["email", "sms"] });
  });
});

describe("deriveJobLabel", () => {
  it("appends a singular room count to a typed job title with no room mention", () => {
    expect(
      deriveJobLabel({
        workType: "interior_repaint",
        jobTitle: "Interior repaint",
        checklist: checklist({ rooms: { small: 0, medium: 1, large: 0 } }),
        scopeSummary: ""
      })
    ).toBe("Interior repaint · 1 room");
  });

  it("appends a plural room count to a typed job title with no room mention", () => {
    expect(
      deriveJobLabel({
        workType: "interior_repaint",
        jobTitle: "Interior repaint",
        checklist: checklist({ rooms: { small: 0, medium: 2, large: 0 } }),
        scopeSummary: ""
      })
    ).toBe("Interior repaint · 2 rooms");
  });

  it("leaves an already-descriptive typed job title untouched", () => {
    expect(
      deriveJobLabel({
        workType: "interior_repaint",
        jobTitle: "Kitchen + hallway",
        checklist: checklist({ rooms: { small: 0, medium: 2, large: 0 } }),
        scopeSummary: ""
      })
    ).toBe("Kitchen + hallway");
  });

  it("does not double up a room count when the typed title already mentions one", () => {
    expect(
      deriveJobLabel({
        workType: "exterior_trim",
        jobTitle: "Exterior trim + 2 doors",
        checklist: checklist({ doorCount: 2 }),
        scopeSummary: ""
      })
    ).toBe("Exterior trim + 2 doors");
  });

  it("builds a label from the checklist when no job title was typed", () => {
    expect(
      deriveJobLabel({
        workType: "interior_repaint",
        jobTitle: "",
        checklist: checklist({ rooms: { small: 0, medium: 2, large: 0 } }),
        scopeSummary: ""
      })
    ).toBe("Interior repaint · 2 rooms");

    expect(
      deriveJobLabel({
        workType: "exterior_trim",
        jobTitle: "  ",
        checklist: checklist({ doorCount: 2 }),
        scopeSummary: ""
      })
    ).toBe("Exterior trim + 2 doors");
  });

  it("uses work type plus checklist when the typed title is generic", () => {
    expect(
      deriveJobLabel({
        workType: "interior_repaint",
        jobTitle: "Interior Paint",
        checklist: checklist({ rooms: { small: 0, medium: 3, large: 0 } }),
        scopeSummary: ""
      })
    ).toBe("Interior repaint · 3 rooms");
  });

  it("falls back to a truncated scope summary when the checklist has no signal", () => {
    expect(
      deriveJobLabel({
        workType: "interior_repaint",
        jobTitle: "",
        checklist: checklist(),
        scopeSummary: "A very long scope summary that should be truncated for the card title"
      })
    ).toBe("A very long scope summary that s…");
  });

  it("keeps a short scope summary intact", () => {
    expect(
      deriveJobLabel({
        workType: "interior_repaint",
        jobTitle: "",
        checklist: checklist(),
        scopeSummary: "Short scope"
      })
    ).toBe("Short scope");
  });

  it("falls back to a generic placeholder and never renders blank", () => {
    expect(
      deriveJobLabel({
        workType: "interior_repaint",
        jobTitle: "",
        checklist: checklist(),
        scopeSummary: ""
      })
    ).toBe("Untitled quote");

    expect(
      deriveJobLabel({
        workType: "interior_repaint",
        jobTitle: "   ",
        checklist: checklist(),
        scopeSummary: "   "
      })
    ).toBe("Untitled quote");
  });
});

describe("deriveCustomerCity", () => {
  it("takes the last comma-separated segment as the city", () => {
    expect(deriveCustomerCity("18 Victor Ave, Toronto")).toBe("Toronto");
  });

  it("skips a trailing province/state or postal segment", () => {
    expect(deriveCustomerCity("42 Draft St, Etobicoke, ON")).toBe("Etobicoke");
    expect(deriveCustomerCity("42 Draft St, Etobicoke, ON M4B 1B3")).toBe("Etobicoke");
  });

  it("falls back to the whole address when there is no comma", () => {
    expect(deriveCustomerCity("Toronto")).toBe("Toronto");
  });

  it("returns an empty string for a blank address", () => {
    expect(deriveCustomerCity("   ")).toBe("");
  });
});
