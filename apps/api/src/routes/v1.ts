import { z } from "zod";
import type { FastifyPluginCallback } from "fastify";
import {
  createCustomerSchema,
  draftQuoteInputSchema,
  priceBookPricingSchema,
  quotePatchSchema,
  sendQuoteSchema
} from "@snapquote/shared";
import { quoteResponse, type InMemoryStore } from "../store.js";

type V1RouteOptions = {
  store: InMemoryStore;
};

const painterOnboardingSchema = z.object({
  businessName: z.string().trim().min(1).max(120),
  defaultTaxRate: z.number().min(0).max(1),
  defaultTerms: z.string().trim().max(4000),
  quoteValidDays: z.number().int().min(1).max(365),
  corePrices: z.object({
    paintWalls: z.object({
      small: z.number().int().min(0),
      medium: z.number().int().min(0),
      large: z.number().int().min(0)
    }),
    paintCeiling: z.object({
      small: z.number().int().min(0),
      medium: z.number().int().min(0),
      large: z.number().int().min(0)
    }),
    paintTrim: z.object({
      small: z.number().int().min(0),
      medium: z.number().int().min(0),
      large: z.number().int().min(0)
    }),
    paintDoorEachCents: z.number().int().min(0),
    heavyPrepHourlyCents: z.number().int().min(0)
  })
});

const priceBookPatchSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(1000).optional(),
  pricing: priceBookPricingSchema.optional(),
  confirmed: z.boolean().optional()
});

const createQuoteSchema = draftQuoteInputSchema.extend({
  customerId: z.string().uuid().optional(),
  customer: createCustomerSchema.optional(),
  address: z.string().trim().min(1).max(400)
});

export const v1Routes: FastifyPluginCallback<V1RouteOptions> = (app, options, done) => {
  const store = options.store;

  app.get("/me", () => store.getMe());

  app.post("/onboarding/painter", (request, reply) => {
    const parsed = painterOnboardingSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: "invalid_request",
        issues: parsed.error.flatten()
      });
    }

    return store.onboardPainter(parsed.data);
  });

  app.get("/price-book", () => ({
    items: store.listPriceBook()
  }));

  app.patch("/price-book/:id", (request, reply) => {
    const parsed = priceBookPatchSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: "invalid_request",
        issues: parsed.error.flatten()
      });
    }

    try {
      return store.updatePriceBookItem((request.params as { id: string }).id, {
        name: parsed.data.name,
        description: parsed.data.description,
        pricing: parsed.data.pricing,
        confirmedAt:
          parsed.data.confirmed === undefined
            ? undefined
            : parsed.data.confirmed
              ? new Date().toISOString()
              : null
      });
    } catch (error) {
      return reply.status(404).send(errorResponse(error));
    }
  });

  app.get("/customers", () => ({
    customers: store.listCustomers()
  }));

  app.post("/customers", (request, reply) => {
    const parsed = createCustomerSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: "invalid_request",
        issues: parsed.error.flatten()
      });
    }

    return reply.status(201).send(store.createCustomer(parsed.data));
  });

  app.get("/routes", () => ({
    prefix: "/v1",
    routes: [
      "GET /me",
      "POST /onboarding/painter",
      "GET /price-book",
      "PATCH /price-book/:id",
      "GET /customers",
      "POST /customers",
      "POST /quotes",
      "GET /quotes",
      "GET /quotes/:id",
      "PATCH /quotes/:id",
      "POST /quotes/:id/lines/:lineId/confirm",
      "POST /quotes/:id/lines/:lineId/save-price-book",
      "POST /quotes/:id/send",
      "POST /quotes/:id/follow-up"
    ]
  }));

  app.post("/quotes", (request, reply) => {
    const parsed = createQuoteSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: "invalid_request",
        issues: parsed.error.flatten()
      });
    }

    const quote = store.createDraftQuote(parsed.data);
    return reply.status(201).send(quoteResponse(store.getState(), quote));
  });

  app.get("/quotes", () => ({
    quotes: store.listQuotes().map((quote) => quoteResponse(store.getState(), quote))
  }));

  app.get("/quotes/:id", (request, reply) => {
    try {
      const quote = store.getQuote((request.params as { id: string }).id);
      return quoteResponse(store.getState(), quote);
    } catch (error) {
      return reply.status(404).send(errorResponse(error));
    }
  });

  app.patch("/quotes/:id", (request, reply) => {
    const parsed = quotePatchSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: "invalid_request",
        issues: parsed.error.flatten()
      });
    }

    try {
      const quote = store.patchQuote((request.params as { id: string }).id, parsed.data);
      return quoteResponse(store.getState(), quote);
    } catch (error) {
      return reply.status(409).send(errorResponse(error));
    }
  });

  app.post("/quotes/:id/lines/:lineId/confirm", (request, reply) => {
    const params = request.params as { id: string; lineId: string };

    try {
      const result = store.confirmYellowLine(params.id, params.lineId);
      return {
        item: result.item,
        quote: quoteResponse(store.getState(), result.quote)
      };
    } catch (error) {
      return reply.status(409).send(errorResponse(error));
    }
  });

  app.post("/quotes/:id/lines/:lineId/save-price-book", (request, reply) => {
    const params = request.params as { id: string; lineId: string };

    try {
      const result = store.saveLineToPriceBook(params.id, params.lineId);
      return reply.status(201).send({
        item: result.item,
        quote: quoteResponse(store.getState(), result.quote)
      });
    } catch (error) {
      return reply.status(409).send(errorResponse(error));
    }
  });

  app.post("/quotes/:id/send", (request, reply) => {
    const parsed = sendQuoteSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: "invalid_request",
        issues: parsed.error.flatten()
      });
    }

    try {
      const quote = store.sendQuote((request.params as { id: string }).id);
      return quoteResponse(store.getState(), quote);
    } catch (error) {
      return reply.status(409).send(errorResponse(error));
    }
  });

  app.post("/quotes/:id/follow-up", (request, reply) => {
    const parsed = sendQuoteSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: "invalid_request",
        issues: parsed.error.flatten()
      });
    }

    try {
      const quote = store.followUpQuote((request.params as { id: string }).id);
      return quoteResponse(store.getState(), quote);
    } catch (error) {
      return reply.status(409).send(errorResponse(error));
    }
  });

  app.get("/schema/health", () => ({
    ok: "boolean",
    service: "snapquote-api",
    version: "string",
    timestamp: "datetime"
  }));

  done();
};

function errorResponse(error: unknown) {
  return {
    error: "request_failed",
    message: error instanceof Error ? error.message : "Request failed"
  };
}
