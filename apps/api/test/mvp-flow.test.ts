import { describe, expect, it } from "vitest";
import type { QuoteLineItem } from "@snapquote/shared";
import { buildServer } from "../src/server.js";
import { loadConfig } from "../src/config.js";
import { createInMemoryStore } from "../src/store.js";

type ApiQuoteLine = QuoteLineItem & {
  id: string;
};

type ApiQuote = {
  id: string;
  status: string;
  publicToken: string;
  isStale: boolean;
  lineItems: ApiQuoteLine[];
  sendBlockers: {
    reasons: string[];
  };
};

type OnboardingResponse = {
  priceBookItems: Array<{
    confirmedAt: string | null;
  }>;
};

type ConfirmLineResponse = {
  quote: ApiQuote;
};

type SaveLineResponse = {
  quote: ApiQuote;
};

function json<T>(response: { body: string }): T {
  return JSON.parse(response.body) as T;
}

const onboardingBody = {
  businessName: "Sharp Edge Painting",
  defaultTaxRate: 0.13,
  defaultTerms: "Payment due on completion.",
  quoteValidDays: 14,
  corePrices: {
    paintWalls: {
      small: 25000,
      medium: 42000,
      large: 65000
    },
    paintCeiling: {
      small: 12000,
      medium: 18000,
      large: 26000
    },
    paintTrim: {
      small: 9000,
      medium: 16000,
      large: 24000
    },
    paintDoorEachCents: 9500,
    heavyPrepHourlyCents: 8500
  }
};

const quoteBody = {
  customer: {
    name: "Maya Chen",
    email: "maya@example.com",
    phone: null,
    address: "18 Victor Ave"
  },
  address: "18 Victor Ave",
  checklist: {
    rooms: {
      small: 0,
      medium: 2,
      large: 0
    },
    surfaces: {
      walls: true,
      ceilings: true,
      trim: true
    },
    doorCount: 2,
    prepLevel: "normal",
    coatCount: 2,
    customerSuppliesPaint: true
  },
  transcript:
    "Paint two bedrooms, patch nail holes, remove the old wallpaper in the hallway, two coats, customer provides paint.",
  typedNotes: "Customer wants work completed this month."
};

describe("MVP API flow", () => {
  it("onboards, drafts with guardrails, resolves blockers, and sends", async () => {
    const store = createInMemoryStore();
    const app = await buildServer(
      loadConfig({
        NODE_ENV: "test"
      }),
      store
    );

    const onboardResponse = await app.inject({
      method: "POST",
      url: "/v1/onboarding/painter",
      payload: onboardingBody
    });
    expect(onboardResponse.statusCode).toBe(200);
    const onboarded = json<OnboardingResponse>(onboardResponse);
    expect(onboarded.priceBookItems.filter((item) => item.confirmedAt !== null)).toHaveLength(5);

    const draftResponse = await app.inject({
      method: "POST",
      url: "/v1/quotes",
      payload: quoteBody
    });
    expect(draftResponse.statusCode).toBe(201);
    const draft = json<ApiQuote>(draftResponse);
    expect(draft.lineItems.map((line) => line.matchState)).toEqual([
      "green",
      "green",
      "green",
      "green",
      "yellow",
      "red"
    ]);
    expect(draft.sendBlockers.reasons).toEqual([
      "1 line needs a price",
      "1 suggested line needs confirmation"
    ]);

    const blockedSendResponse = await app.inject({
      method: "POST",
      url: `/v1/quotes/${draft.id}/send`,
      payload: {
        channels: ["email"]
      }
    });
    expect(blockedSendResponse.statusCode).toBe(409);

    const yellowLine = draft.lineItems.find((line) => line.matchState === "yellow");
    const redLine = draft.lineItems.find((line) => line.matchState === "red");

    if (!yellowLine || !redLine) {
      throw new Error("Expected one yellow line and one red line in the draft");
    }

    const confirmResponse = await app.inject({
      method: "POST",
      url: `/v1/quotes/${draft.id}/lines/${yellowLine.id}/confirm`
    });
    expect(confirmResponse.statusCode).toBe(200);
    const confirmed = json<ConfirmLineResponse>(confirmResponse);

    const pricedLines = confirmed.quote.lineItems.map((line) =>
      line.id === redLine.id
        ? {
            ...line,
            unit: "flat",
            unitPriceCents: 30000
          }
        : line
    );
    const patchResponse = await app.inject({
      method: "PATCH",
      url: `/v1/quotes/${draft.id}`,
      payload: {
        lineItems: pricedLines
      }
    });
    expect(patchResponse.statusCode).toBe(200);

    const saveResponse = await app.inject({
      method: "POST",
      url: `/v1/quotes/${draft.id}/lines/${redLine.id}/save-price-book`
    });
    expect(saveResponse.statusCode).toBe(201);
    const saved = json<SaveLineResponse>(saveResponse);
    expect(saved.quote.sendBlockers.reasons).toEqual([]);

    const sendResponse = await app.inject({
      method: "POST",
      url: `/v1/quotes/${draft.id}/send`,
      payload: {
        channels: ["email"]
      }
    });
    expect(sendResponse.statusCode).toBe(200);
    const sent = json<ApiQuote>(sendResponse);
    expect(sent.status).toBe("sent");
    expect(sent.isStale).toBe(false);

    const earlyFollowUpResponse = await app.inject({
      method: "POST",
      url: `/v1/quotes/${draft.id}/follow-up`,
      payload: {
        channels: ["email"]
      }
    });
    expect(earlyFollowUpResponse.statusCode).toBe(409);

    const quoteRecord = store.getState().quotes.find((quote) => quote.id === draft.id);

    if (!quoteRecord) {
      throw new Error("Expected sent quote in store");
    }

    quoteRecord.sentAt = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();

    const staleResponse = await app.inject({
      method: "GET",
      url: `/v1/quotes/${draft.id}`
    });
    expect(json<ApiQuote>(staleResponse).isStale).toBe(true);

    const followUpResponse = await app.inject({
      method: "POST",
      url: `/v1/quotes/${draft.id}/follow-up`,
      payload: {
        channels: ["email"]
      }
    });
    expect(followUpResponse.statusCode).toBe(200);
    expect(store.getState().sentEmails.map((email) => email.purpose)).toEqual([
      "quote_send",
      "quote_follow_up"
    ]);

    const publicResponse = await app.inject({
      method: "GET",
      url: `/public/quotes/${sent.publicToken}`
    });
    expect(publicResponse.statusCode).toBe(200);
    expect(publicResponse.body).toContain("Quote");

    const viewedResponse = await app.inject({
      method: "GET",
      url: `/v1/quotes/${draft.id}`
    });
    expect(json<ApiQuote>(viewedResponse).status).toBe("viewed");

    const acceptResponse = await app.inject({
      method: "POST",
      url: `/public/quotes/${sent.publicToken}/respond`,
      payload: {
        action: "accept"
      }
    });
    expect(acceptResponse.statusCode).toBe(200);
    expect(json<ApiQuote>(acceptResponse).status).toBe("accepted");
  });
});
