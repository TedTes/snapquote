import { describe, expect, it } from "vitest";
import {
  canAcceptPublicQuote,
  deriveQuoteStatus,
  getQuoteSendBlockers,
  isQuoteStale,
  sendQuoteSchema,
  type QuoteEvent,
  type QuoteLineItem
} from "../src/index.js";

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
