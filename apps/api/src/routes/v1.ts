import type { FastifyPluginCallback } from "fastify";
import {
  computeQuoteTotals,
  quotePatchSchema,
  sendQuoteSchema
} from "@snapquote/shared";

const demoOrgId = "00000000-0000-4000-8000-000000000001";
const demoUserId = "00000000-0000-4000-8000-000000000002";

export const v1Routes: FastifyPluginCallback = (app, _options, done) => {
  app.get("/me", () => ({
    user: {
      id: demoUserId,
      orgId: demoOrgId,
      email: "demo@snapquote.local",
      name: "Demo Contractor",
      role: "owner"
    },
    org: {
      id: demoOrgId,
      name: "SnapQuote Painting Co.",
      trade: "painter",
      logoUrl: null,
      defaultTaxRate: 0.13,
      defaultTerms: "Payment due on completion. Scope changes require approval.",
      quoteValidDays: 14,
      plan: "trial"
    },
    entitlements: {
      canSendQuotes: true,
      trialEndsAt: null
    }
  }));

  app.get("/routes", () => ({
    prefix: "/v1",
    routes: [
      "GET /me",
      "PATCH /org",
      "GET /price-book",
      "POST /price-book",
      "POST /price-book/import",
      "GET /customers",
      "POST /customers",
      "POST /jobs",
      "POST /jobs/:id/media/presign",
      "POST /jobs/:id/complete",
      "GET /quotes",
      "PATCH /quotes/:id",
      "POST /quotes/:id/send",
      "POST /quotes/:id/follow-up"
    ]
  }));

  app.patch("/quotes/:id", (request, reply) => {
    const parsed = quotePatchSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: "invalid_request",
        issues: parsed.error.flatten()
      });
    }

    const lineItems = parsed.data.lineItems ?? [];
    const discount = parsed.data.discount ?? {
      type: "none" as const,
      value: 0
    };
    const taxRate = parsed.data.taxRate ?? 0;

    try {
      const totals = computeQuoteTotals({
        lineItems,
        discount,
        taxRate
      });

      return {
        ok: true,
        quoteId: (request.params as { id: string }).id,
        totals,
        status: "draft"
      };
    } catch (error) {
      return reply.status(409).send({
        error: "needs_price",
        message: error instanceof Error ? error.message : "Quote cannot be totalled"
      });
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

    return reply.status(501).send({
      error: "not_implemented",
      message: "Sending requires Clerk, Stripe entitlement, email, and SMS providers."
    });
  });

  app.get("/schema/health", () => ({
    ok: "boolean",
    service: "snapquote-api",
    version: "string",
    timestamp: "datetime"
  }));

  done();
};
