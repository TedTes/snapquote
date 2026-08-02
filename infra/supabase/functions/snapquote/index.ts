import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  assertQuoteCanSend,
  buildScopeSummary,
  computeTotalsIfReady,
  createPainterDraftLines,
  defaultCorePrices,
  defaultChecklist,
  deriveQuoteStatus,
  getQuoteSendBlockers,
  isQuoteStale,
  lineFromPriceBook,
  lineInsert,
  priceBookInsert,
  priceBookItemFromRow,
  pricingRegionFromRow,
  pricingVersionFromRow,
  publicToken,
  quoteLineFromRow,
  servicePriceSuggestionFromRows,
  serviceTemplateFromRow,
  starterDefinitions,
  toDiscount,
  totalsColumns,
  type LineRow,
  type PainterChecklist,
  type PriceBookItem,
  type PriceBookPricing,
  type PriceBookRow,
  type PricingRegionRow,
  type PricingVersionRow,
  type QuoteDiscount,
  type QuoteEvent,
  type QuoteLineItem,
  type QuoteRow,
  type ServicePriceSuggestionRow,
  type ServiceTemplateRow
} from "./domain.ts";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type, x-snapquote-org-id, stripe-signature, x-snapquote-webhook-secret, x-snapquote-admin-secret",
  "access-control-allow-methods": "DELETE,GET,POST,PATCH,OPTIONS"
};

const defaultOrgId = Deno.env.get("SNAPQUOTE_DEFAULT_ORG_ID") ?? "00000000-0000-4000-8000-000000000001";
const defaultUserId = Deno.env.get("SNAPQUOTE_DEFAULT_USER_ID") ?? "00000000-0000-4000-8000-000000000002";
const requestOrgIds = new WeakMap<Request, string>();
const appAccessTokenSeconds = 60 * 60 * 24 * 7;
const appRefreshTokenSeconds = 60 * 60 * 24 * 30;
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();
const maxRateLimitBuckets = 2_000;

const quoteVanPricing = {
  currency: "USD",
  trialDays: 14,
  freeSentQuoteLimit: 3,
  plans: {
    trial: {
      id: "trial",
      name: "Free trial",
      badge: "Trial",
      summary: "Try QuoteVan before paying.",
      detail: "14 days free, includes 3 sent quotes",
      monthlyPriceCents: 0,
      standardMonthlyPriceCents: 0,
      currency: "USD",
      available: true,
      sendQuotes: true
    },
    solo: {
      id: "solo",
      name: "Solo",
      badge: "Solo",
      summary: "Unlimited quote sending for one business.",
      detail: "$19/mo early access, later $29/mo",
      monthlyPriceCents: 1900,
      standardMonthlyPriceCents: 2900,
      currency: "USD",
      available: true,
      sendQuotes: true
    },
    crew: {
      id: "crew",
      name: "Crew",
      badge: "Crew",
      summary: "Team workflows, SMS, automations, and reporting.",
      detail: "Coming later, expected from $49/mo",
      monthlyPriceCents: null,
      standardMonthlyPriceCents: 4900,
      currency: "USD",
      available: false,
      sendQuotes: true
    },
    expired: {
      id: "expired",
      name: "Trial ended",
      badge: "Expired",
      summary: "Upgrade to keep sending quote links.",
      detail: "Drafts and previews stay available",
      monthlyPriceCents: null,
      standardMonthlyPriceCents: null,
      currency: "USD",
      available: false,
      sendQuotes: false
    }
  }
} as const;

type AuthSessionPayload = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: { id: string };
};

const pricingSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("fixed"), unitPriceCents: z.number().int().min(0) }),
  z.object({
    type: z.literal("room_size"),
    prices: z.object({
      small: z.number().int().min(0),
      medium: z.number().int().min(0),
      large: z.number().int().min(0)
    })
  })
]);

const checklistSchema = z.object({
  rooms: z.object({
    small: z.number().int().min(0).max(20),
    medium: z.number().int().min(0).max(20),
    large: z.number().int().min(0).max(20)
  }),
  surfaces: z.object({
    walls: z.boolean(),
    ceilings: z.boolean(),
    trim: z.boolean()
  }),
  doorCount: z.number().int().min(0).max(100),
  prepLevel: z.enum(["light", "normal", "heavy"]),
  coatCount: z.union([z.literal(1), z.literal(2)]),
  customerSuppliesPaint: z.boolean()
});

const onboardingSchema = z.object({
  businessName: z.string().trim().max(120).default(""),
  defaultTaxRate: z.number().min(0).max(1),
  defaultTerms: z.string().trim().max(4000).default(""),
  quoteValidDays: z.number().int().min(1).max(365).default(14),
  corePrices: z.object({
    paintWalls: z.object({ small: z.number().int().min(0), medium: z.number().int().min(0), large: z.number().int().min(0) }),
    paintCeiling: z.object({ small: z.number().int().min(0), medium: z.number().int().min(0), large: z.number().int().min(0) }),
    paintTrim: z.object({ small: z.number().int().min(0), medium: z.number().int().min(0), large: z.number().int().min(0) }),
    paintDoorEachCents: z.number().int().min(0),
    heavyPrepHourlyCents: z.number().int().min(0)
  }).default(defaultCorePrices)
});

const orgSettingsSchema = z.object({
  businessName: z.string().trim().max(120).optional(),
  defaultTaxRate: z.number().min(0).max(1).optional(),
  defaultTerms: z.string().trim().max(4000).optional(),
  quoteValidDays: z.number().int().min(1).max(365).optional(),
  defaultDepositPercent: z.number().min(0).max(100).optional(),
  contactPhone: z.string().trim().max(80).nullable().optional(),
  website: z.string().trim().max(240).nullable().optional(),
  logoUrl: z.string().trim().url().max(1000).nullable().optional()
});

const avatarUploadSchema = z.object({
  fileName: z.string().trim().min(1).max(180),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  base64: z.string().min(1).max(8_000_000)
});

const audioUploadSchema = z.object({
  fileName: z.string().trim().min(1).max(180),
  contentType: z.enum([
    "audio/aac",
    "audio/m4a",
    "audio/mp4",
    "audio/mpeg",
    "audio/ogg",
    "audio/wav",
    "audio/webm",
    "audio/x-m4a"
  ]),
  base64: z.string().min(1).max(18_000_000),
  durationSeconds: z.number().min(0).max(3600).optional()
});

const oauthProviderSchema = z.enum(["apple", "google"]);

const oauthStartSchema = z.object({
  provider: oauthProviderSchema,
  redirectTo: z.string().trim().min(1).max(1000)
});

const oauthCompleteSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresAt: z.number().int().positive(),
  provider: oauthProviderSchema.optional(),
  businessName: z.string().trim().min(1).max(120).optional(),
  name: z.string().trim().max(120).optional()
});

const nativeOAuthSchema = z.object({
  provider: z.literal("apple"),
  identityToken: z.string().min(1),
  authorizationCode: z.string().min(1).optional(),
  email: z.string().trim().email().max(320).optional(),
  businessName: z.string().trim().min(1).max(120).optional(),
  name: z.string().trim().max(120).optional(),
  nonce: z.string().min(1).max(256).optional()
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1)
});

const customerSchema = z.object({
  name: z.string().trim().min(1).max(160),
  email: z.string().email().nullable().optional(),
  phone: z.string().trim().min(7).max(32).nullable().optional(),
  address: z.string().trim().min(1).max(400),
  city: z.string().trim().max(120).optional()
});

const customerPatchSchema = customerSchema.partial().refine(
  (input) => Object.values(input).some((value) => value !== undefined),
  "At least one customer field is required"
);
const customerMergeSchema = z.object({
  targetCustomerId: z.string().uuid()
});
const workTypeSchema = z.enum(["interior_repaint", "exterior_trim"]);

const createQuoteSchema = z.object({
  customerId: z.string().uuid().optional(),
  customer: customerSchema.optional(),
  address: z.string().trim().min(1).max(400),
  workType: workTypeSchema.optional(),
  jobTitle: z.string().trim().max(160).optional(),
  checklist: checklistSchema.default(defaultChecklist),
  transcript: z.string().trim().max(5000).default(""),
  typedNotes: z.string().trim().max(5000).optional(),
  audioStoragePath: z.string().trim().min(1).max(1000).nullable().optional(),
  audioContentType: z.string().trim().min(1).max(120).nullable().optional(),
  audioDurationSeconds: z.number().int().min(0).max(3600).nullable().optional()
}).superRefine((input, context) => {
  const hasCustomerId = input.customerId !== undefined;
  const hasCustomer = input.customer !== undefined;

  if (hasCustomerId === hasCustomer) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["customerId"],
      message: "Provide exactly one of customerId or customer"
    });
  }
});

const extractScopeSchema = z.object({
  transcript: z.string().trim().max(5000).default(""),
  typedNotes: z.string().trim().max(5000).default(""),
  checklist: checklistSchema.default(defaultChecklist)
});

const extractionResultSchema = z.object({
  scope_summary: z.string().trim().min(1).max(1200),
  tasks: z.array(z.object({
    description: z.string().trim().min(1).max(240),
    quantity: z.number().positive().nullable(),
    unit: z.string().nullable(),
    kind: z.enum(["labour", "material"]),
    assumptions: z.array(z.string().trim().min(1).max(240)).max(10),
    confidence: z.number().min(0).max(1)
  })).max(40),
  site_conditions: z.array(z.string().trim().min(1).max(240)).max(20),
  questions_for_contractor: z.array(z.string().trim().min(1).max(240)).max(20)
});

const quotePatchSchema = z.object({
  lineItems: z.array(z.any()).optional(),
  discount: z.discriminatedUnion("type", [
    z.object({ type: z.literal("none"), value: z.literal(0) }),
    z.object({ type: z.literal("percent"), value: z.number().min(0).max(100) }),
    z.object({ type: z.literal("cents"), value: z.number().int().min(0) })
  ]).optional(),
  taxRate: z.number().min(0).max(1).optional(),
  notes: z.string().trim().max(4000).optional(),
  terms: z.string().trim().max(4000).optional(),
  validUntil: z.string().date().optional()
});

const priceBookPatchSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(1000).optional(),
  pricing: pricingSchema.optional(),
  confirmed: z.boolean().optional()
});

const priceBookCreateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).default(""),
  unit: z.enum(["room", "each", "hour", "flat", "sqft", "lnft", "day"]),
  kind: z.enum(["labour", "material"]),
  pricing: pricingSchema,
  confirmed: z.boolean().default(true)
});

const sendSchema = z.object({
  channels: z.array(z.enum(["email", "sms"])).min(1).max(2).default(["email"])
}).transform((input) => ({
  channels: Array.from(new Set(input.channels))
}));

const inboundEmailSchema = z.object({
  publicToken: z.string().trim().min(16).max(160).optional(),
  quoteToken: z.string().trim().min(16).max(160).optional(),
  from: z.string().trim().max(320).optional(),
  fromEmail: z.string().trim().email().max(320).optional(),
  subject: z.string().trim().max(500).optional(),
  text: z.string().trim().max(20_000).optional(),
  html: z.string().trim().max(80_000).optional(),
  receivedAt: z.string().trim().max(80).optional()
});

const publicPaymentConfirmSchema = z.object({
  sessionId: z.string().trim().min(1).max(260)
});

const pricingSuggestionQuerySchema = z.object({
  trade: z.string().trim().min(1).max(80).default("painting"),
  regionKey: z.string().trim().min(1).max(120).optional(),
  country: z.string().trim().min(2).max(3).optional(),
  region: z.string().trim().min(1).max(80).optional(),
  metro: z.string().trim().min(1).max(160).optional()
});

const pricingSuggestionIngestSchema = z.object({
  actor: z.string().trim().min(1).max(160).default("pricing-ingest"),
  trade: z.string().trim().min(1).max(80).default("painting"),
  region: z.object({
    key: z.string().trim().min(1).max(120),
    countryCode: z.string().trim().min(2).max(3).nullable().optional(),
    regionCode: z.string().trim().min(1).max(80).nullable().optional(),
    metroName: z.string().trim().min(1).max(160).nullable().optional(),
    currency: z.string().trim().length(3).default("USD"),
    laborMultiplier: z.number().positive().default(1),
    materialMultiplier: z.number().positive().default(1),
    confidence: z.number().min(0).max(1).default(0.5),
    active: z.boolean().default(true)
  }),
  source: z.object({
    key: z.string().trim().min(1).max(120).optional(),
    name: z.string().trim().min(1).max(240),
    sourceType: z.enum(["curated", "government", "vendor", "import", "llm_draft"]).default("import"),
    sourceUrl: z.string().trim().url().nullable().optional(),
    collectedAt: z.string().date().nullable().optional(),
    notes: z.string().trim().max(4000).default(""),
    confidence: z.number().min(0).max(1).default(0.5)
  }),
  version: z.object({
    key: z.string().trim().min(1).max(120).optional(),
    status: z.enum(["draft", "reviewed", "published", "retired"]).default("published"),
    formulaVersion: z.string().trim().min(1).max(80).default("manual-v1"),
    publishedAt: z.string().datetime().nullable().optional(),
    sourceSnapshot: z.record(z.unknown()).default({}),
    notes: z.string().trim().max(4000).default("")
  }).default({}),
  suggestions: z.array(z.object({
    key: z.string().trim().min(1).max(80).optional(),
    name: z.string().trim().min(1).max(160),
    description: z.string().trim().max(1000).default(""),
    aliases: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
    unit: z.enum(["room", "each", "hour", "flat", "sqft", "lnft", "day"]),
    kind: z.enum(["labour", "material"]).default("labour"),
    pricingType: z.enum(["fixed", "room_size"]).optional(),
    pricing: pricingSchema.optional(),
    lowCents: z.number().int().min(0),
    medianCents: z.number().int().min(0),
    highCents: z.number().int().min(0),
    confidence: z.number().min(0).max(1).default(0.5),
    provenance: z.record(z.unknown()).default({}),
    sourceNote: z.string().trim().max(1000).default("ingested source")
  })).min(1).max(200)
}).superRefine((input, context) => {
  for (const [index, suggestion] of input.suggestions.entries()) {
    if (suggestion.lowCents > suggestion.medianCents || suggestion.medianCents > suggestion.highCents) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["suggestions", index, "medianCents"],
        message: "Suggestion prices must be ordered low <= median <= high"
      });
    }
  }
});

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const db = getDb();
    const route = routeFromRequest(request);

    if (route.method === "GET" && route.path === "/health") {
      return json({ ok: true, service: "quotevan-edge", timestamp: new Date().toISOString() });
    }

    if (route.method === "GET" && route.path === "/admin/ops/health") {
      return json(await adminOpsHealth(db, request));
    }

    if (route.method === "POST" && route.path === "/v1/auth/refresh") {
      return json(await refreshAuthSession(db, request));
    }

    if (route.method === "POST" && route.path === "/v1/auth/oauth/start") {
      return json(await startOAuth(db, request));
    }

    if (route.method === "POST" && route.path === "/v1/auth/oauth/complete") {
      return json(await completeOAuth(db, request));
    }

    if (route.method === "POST" && route.path === "/v1/auth/oauth/native") {
      return json(await completeNativeOAuth(db, request));
    }

    if (route.method === "POST" && route.path === "/stripe/webhook") {
      return json(await handleStripeWebhook(db, request));
    }

    if (route.method === "POST" && route.path === "/email/reply-webhook") {
      return json(await handleInboundEmailReply(db, request));
    }

    if (route.method === "POST" && route.path === "/admin/pricing-suggestions/ingest") {
      return json(await ingestPricingSuggestions(db, request));
    }

    if (requiresAppAuth(route)) {
      const orgId = await authenticatedOrgIdFromRequest(db, request);
      requestOrgIds.set(request, orgId);
      await ensureOrg(db, orgId);
    }

    if (route.method === "GET" && route.path === "/v1/me") {
      return json(await getMe(db, request));
    }

    if (route.method === "PATCH" && route.path === "/v1/me") {
      return json(await updateMe(db, request));
    }

    if (route.method === "POST" && route.path === "/v1/profile/avatar") {
      return json(await uploadAvatar(db, request));
    }

    if (route.method === "GET" && route.path === "/v1/billing/portal") {
      return json(await billingPortal(db, request));
    }

    if (route.method === "GET" && route.path === "/v1/payments/connect") {
      return json(await getPaymentConnectStatus(db, request));
    }

    if (route.method === "POST" && route.path === "/v1/payments/connect/onboard") {
      return json(await createPaymentConnectOnboarding(db, request));
    }

    if (route.method === "POST" && route.path === "/v1/account/delete") {
      return json(await deleteAccount(db, request));
    }

    if (route.method === "POST" && route.path === "/v1/onboarding/painter") {
      return json(await onboardPainter(db, request));
    }

    if (route.method === "GET" && route.path === "/v1/pricing-suggestions") {
      return json(await listPricingSuggestions(db, request));
    }

    if (route.method === "GET" && route.path === "/v1/price-book") {
      return json({ items: await listPriceBook(db, orgIdFromRequest(request)) });
    }

    if (route.method === "POST" && route.path === "/v1/price-book") {
      return json(await createPriceBookItem(db, request), 201);
    }

    if (route.method === "PATCH" && match(route.path, "/v1/price-book/:id")) {
      return json(await updatePriceBookItem(db, request, params(route.path, "/v1/price-book/:id").id));
    }

    if (route.method === "POST" && match(route.path, "/v1/price-book/:id/archive")) {
      return json(await archivePriceBookItem(db, request, params(route.path, "/v1/price-book/:id/archive").id));
    }

    if (route.method === "GET" && route.path === "/v1/customers") {
      return json({ customers: await listCustomers(db, orgIdFromRequest(request), request) });
    }

    if (route.method === "POST" && route.path === "/v1/customers") {
      return json(await createCustomer(db, request), 201);
    }

    if (route.method === "PATCH" && match(route.path, "/v1/customers/:id")) {
      return json(await updateCustomer(db, request, params(route.path, "/v1/customers/:id").id));
    }

    if (route.method === "DELETE" && match(route.path, "/v1/customers/:id")) {
      return json(await deleteCustomer(db, request, params(route.path, "/v1/customers/:id").id));
    }

    if (route.method === "POST" && match(route.path, "/v1/customers/:id/merge")) {
      return json(await mergeCustomer(db, request, params(route.path, "/v1/customers/:id/merge").id));
    }

    if (route.method === "GET" && route.path === "/v1/quotes") {
      return json({ quotes: await listQuotes(db, orgIdFromRequest(request)) });
    }

    if (route.method === "POST" && route.path === "/v1/quotes") {
      return json(await createQuote(db, request), 201);
    }

    if (route.method === "POST" && route.path === "/v1/ai/transcribe") {
      return json(await transcribeAudio(db, request));
    }

    if (route.method === "POST" && route.path === "/v1/ai/extract") {
      return json(await extractScope(request));
    }

    if (route.method === "GET" && match(route.path, "/v1/quotes/:id")) {
      return json(await getQuoteResponse(db, orgIdFromRequest(request), params(route.path, "/v1/quotes/:id").id));
    }

    if (route.method === "PATCH" && match(route.path, "/v1/quotes/:id")) {
      return json(await patchQuote(db, request, params(route.path, "/v1/quotes/:id").id));
    }

    if (route.method === "POST" && match(route.path, "/v1/quotes/:id/lines/:lineId/confirm")) {
      const routeParams = params(route.path, "/v1/quotes/:id/lines/:lineId/confirm");
      return json(await confirmLine(db, request, routeParams.id, routeParams.lineId));
    }

    if (route.method === "POST" && match(route.path, "/v1/quotes/:id/lines/:lineId/save-price-book")) {
      const routeParams = params(route.path, "/v1/quotes/:id/lines/:lineId/save-price-book");
      return json(await saveLineToPriceBook(db, request, routeParams.id, routeParams.lineId), 201);
    }

    if (route.method === "POST" && match(route.path, "/v1/quotes/:id/send")) {
      return json(await sendQuote(db, request, params(route.path, "/v1/quotes/:id/send").id));
    }

    if (route.method === "POST" && match(route.path, "/v1/quotes/:id/resend")) {
      return json(await resendQuote(db, request, params(route.path, "/v1/quotes/:id/resend").id));
    }

    if (route.method === "POST" && match(route.path, "/v1/quotes/:id/follow-up")) {
      return json(await followUpQuote(db, request, params(route.path, "/v1/quotes/:id/follow-up").id));
    }

    if (route.method === "POST" && match(route.path, "/v1/quotes/:id/delete-draft")) {
      return json(await deleteDraftQuote(db, request, params(route.path, "/v1/quotes/:id/delete-draft").id));
    }

    if (route.method === "POST" && match(route.path, "/v1/quotes/:id/archive")) {
      return json(await archiveQuote(db, request, params(route.path, "/v1/quotes/:id/archive").id));
    }

    if (route.method === "POST" && match(route.path, "/v1/quotes/:id/duplicate")) {
      return json(await duplicateQuote(db, request, params(route.path, "/v1/quotes/:id/duplicate").id), 201);
    }

    if (route.method === "POST" && match(route.path, "/v1/quotes/:id/revise")) {
      return json(await reviseQuote(db, request, params(route.path, "/v1/quotes/:id/revise").id), 201);
    }

    if (route.method === "GET" && match(route.path, "/public/quotes/:token")) {
      const token = params(route.path, "/public/quotes/:token").token;
      enforceRateLimit(request, ["public_quote_view", token, requestClientKey(request)], 120, 60_000);
      return json(await viewPublicQuote(db, token));
    }

    if (route.method === "POST" && match(route.path, "/public/quotes/:token/respond")) {
      const token = params(route.path, "/public/quotes/:token/respond").token;
      enforceRateLimit(request, ["public_quote_respond", token, requestClientKey(request)], 12, 10 * 60_000);
      return json(await respondToPublicQuote(db, request, token));
    }

    if (route.method === "POST" && match(route.path, "/public/quotes/:token/pay")) {
      const token = params(route.path, "/public/quotes/:token/pay").token;
      enforceRateLimit(request, ["public_quote_pay", token, requestClientKey(request)], 10, 10 * 60_000);
      return json(await createPublicQuotePayment(db, token));
    }

    if (route.method === "POST" && match(route.path, "/public/quotes/:token/pay/confirm")) {
      const token = params(route.path, "/public/quotes/:token/pay/confirm").token;
      enforceRateLimit(request, ["public_quote_pay_confirm", token, requestClientKey(request)], 30, 10 * 60_000);
      return json(await confirmPublicQuotePayment(db, request, token));
    }

    return json({ error: "not_found", message: "Route not found" }, 404);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    if (status >= 500) {
      console.error("SnapQuote edge error", messageFromError(error));
    }

    return json({
      error: status >= 500 ? "server_error" : "request_failed",
      message: publicMessageFromError(error, status)
    }, status);
  }
});

function getDb() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !key) {
    throw new HttpError(500, "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }

  return createClient(url, key, {
    auth: { flowType: "implicit", persistSession: false }
  });
}

async function refreshAuthSession(db: SupabaseClient, request: Request) {
  const input = parse(refreshSchema, await request.json());
  const authDb = getDb();
  const { data, error } = await authDb.auth.refreshSession({ refresh_token: input.refreshToken });

  if (!error && data.session && data.user) {
    const session = sessionResponse(data.session, data.user);
    const member = await single(db.from("snapquote_org_members").select("*").eq("auth_user_id", data.user.id));
    const org = await single(db.from("snapquote_orgs").select("*").eq("id", member.org_id));
    return await authResponse(db, session, org, member);
  }

  const payload = await verifyAppToken(input.refreshToken, "refresh");
  const member = await single(db.from("snapquote_org_members").select("*").eq("id", payload.sub));
  const org = await single(db.from("snapquote_orgs").select("*").eq("id", member.org_id));

  return await authResponse(db, await createAppSession(member), org, member);
}

async function startOAuth(db: SupabaseClient, request: Request) {
  const input = parse(oauthStartSchema, await request.json());
  const { data, error } = await db.auth.signInWithOAuth({
    provider: input.provider,
    options: {
      redirectTo: input.redirectTo,
      skipBrowserRedirect: true
    }
  });

  if (error || !data.url) {
    throw new HttpError(400, authFailureMessage(error));
  }

  return { provider: input.provider, redirectTo: input.redirectTo, url: data.url };
}

async function completeOAuth(db: SupabaseClient, request: Request) {
  const input = parse(oauthCompleteSchema, await request.json());
  const { data, error } = await db.auth.getUser(input.accessToken);

  if (error || !data.user) {
    throw new HttpError(401, "Could not complete sign in. Try again.");
  }

  return authResponseForSupabaseUser(db, {
    accessToken: input.accessToken,
    refreshToken: input.refreshToken,
    expiresAt: input.expiresAt,
    user: { id: data.user.id }
  }, data.user, input);
}

async function completeNativeOAuth(db: SupabaseClient, request: Request) {
  const input = parse(nativeOAuthSchema, await request.json());
  const authDb = getDb();
  const { data, error } = await authDb.auth.signInWithIdToken({
    provider: input.provider,
    token: input.identityToken,
    ...(input.nonce ? { nonce: input.nonce } : {})
  });

  if (error || !data.session || !data.user) {
    console.warn("Native Apple sign-in token exchange failed", authFailureMessage(error));
    throw new HttpError(401, nativeAppleAuthFailureMessage(error));
  }

  return authResponseForSupabaseUser(db, sessionResponse(data.session, data.user), data.user, input);
}

async function authResponseForSupabaseUser(
  db: SupabaseClient,
  session: AuthSessionPayload,
  user: any,
  input: { businessName?: string | undefined; email?: string | undefined; name?: string | undefined }
) {
  const existingMember = await maybeSingle(
    db.from("snapquote_org_members").select("*").eq("auth_user_id", user.id)
  );

  if (existingMember) {
    const org = await single(db.from("snapquote_orgs").select("*").eq("id", existingMember.org_id));
    return await authResponse(db, session, org, existingMember);
  }

  const email = input.email || user.email;

  if (!email) {
    throw new HttpError(400, "Your account did not provide an email address.");
  }

  const userMetadata = user.user_metadata ?? {};
  const providedName =
    input.name ||
    String(userMetadata.full_name ?? userMetadata.name ?? userMetadata.display_name ?? "").trim();
  const memberName = providedName || "Owner";
  const businessName =
    input.businessName ||
    String(userMetadata.business_name ?? "").trim() ||
    "";

  const org = await single(db.from("snapquote_orgs").insert({
    name: businessName,
    trade: "painting",
    default_tax_rate: 0.13,
    default_terms: "50% deposit due to schedule the job, balance due on completion.",
    quote_valid_days: 14,
    plan: "trial"
  }).select("*"));

  const member = await single(db.from("snapquote_org_members").insert({
    org_id: org.id,
    auth_user_id: user.id,
    email,
    name: memberName,
    role: "owner"
  }).select("*"));

  await seedStarterPriceBook(db, String(org.id), false);

  return await authResponse(db, session, org, member);
}

function sessionResponse(
  session: { access_token: string; refresh_token: string; expires_at?: number | null; expires_in: number },
  user: any
) {
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at ?? Math.floor(Date.now() / 1000) + session.expires_in,
    user
  };
}

function quoteVanPlanFromOrg(org: Record<string, unknown>) {
  const planId = String(org.plan ?? "trial");

  if (planId === "solo" || planId === "crew" || planId === "expired") {
    return quoteVanPricing.plans[planId];
  }

  return quoteVanPricing.plans.trial;
}

async function sendEntitlementResponse(db: SupabaseClient, orgId: string, org: Record<string, unknown>) {
  const plan = quoteVanPlanFromOrg(org);
  const trialEndsAt = plan.id === "trial" ? trialEndsAtFromOrg(org) : null;
  const sentQuoteCount = plan.id === "trial" ? await countSentQuotes(db, orgId) : null;
  const freeSendsRemaining = sentQuoteCount === null
    ? null
    : Math.max(0, quoteVanPricing.freeSentQuoteLimit - sentQuoteCount);
  const trialExpired = trialEndsAt !== null && Date.now() >= Date.parse(trialEndsAt);
  const canSendQuotes = plan.id === "trial"
    ? !trialExpired && sentQuoteCount !== null && sentQuoteCount < quoteVanPricing.freeSentQuoteLimit
    : plan.sendQuotes;

  return {
    canSendQuotes,
    trialEndsAt,
    trialExpired,
    freeSentQuoteLimit: quoteVanPricing.freeSentQuoteLimit,
    sentQuoteCount,
    freeSendsRemaining
  };
}

function billingResponse(org: Record<string, unknown>, entitlements: Awaited<ReturnType<typeof sendEntitlementResponse>>) {
  return {
    plan: quoteVanPlanFromOrg(org),
    pricing: {
      currency: quoteVanPricing.currency,
      trialDays: quoteVanPricing.trialDays,
      freeSentQuoteLimit: quoteVanPricing.freeSentQuoteLimit
    },
    usage: {
      sentQuoteCount: entitlements.sentQuoteCount,
      freeSendsRemaining: entitlements.freeSendsRemaining
    }
  };
}

function trialEndsAtFromOrg(org: Record<string, unknown>) {
  const createdAt = typeof org.created_at === "string" ? Date.parse(org.created_at) : Number.NaN;

  if (!Number.isFinite(createdAt)) {
    return null;
  }

  return new Date(createdAt + quoteVanPricing.trialDays * 24 * 60 * 60 * 1000).toISOString();
}

async function countSentQuotes(db: SupabaseClient, orgId: string) {
  const { count, error } = await db.from("snapquote_quotes")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .not("sent_at", "is", null);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

async function assertOrgCanSendQuote(db: SupabaseClient, orgId: string) {
  const org = await single(db.from("snapquote_orgs").select("*").eq("id", orgId));
  const entitlements = await sendEntitlementResponse(db, orgId, org);

  if (entitlements.canSendQuotes) {
    return;
  }

  const plan = quoteVanPlanFromOrg(org);

  if (plan.id === "trial" && entitlements.trialExpired) {
    throw new HttpError(402, "Your free trial has ended. Upgrade to Solo to keep sending quote links.");
  }

  if (plan.id === "trial" && entitlements.freeSendsRemaining === 0) {
    throw new HttpError(402, `You have used your ${quoteVanPricing.freeSentQuoteLimit} free sent quotes. Upgrade to Solo to keep sending quote links.`);
  }

  throw new HttpError(402, "Upgrade to Solo to keep sending quote links.");
}

async function authResponse(
  db: SupabaseClient,
  session: AuthSessionPayload,
  org: Record<string, unknown>,
  member: Record<string, unknown>
) {
  const orgId = String(org.id ?? member.org_id);
  const entitlements = await sendEntitlementResponse(db, orgId, org);

  return {
    session: {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresAt: session.expiresAt
    },
    me: {
      user: {
        id: member.id,
        orgId: member.org_id,
        email: member.email,
        name: member.name,
        role: member.role
      },
      org: orgResponse(org),
      entitlements,
      billing: billingResponse(org, entitlements)
    }
  };
}

async function createAppSession(member: Record<string, unknown>): Promise<AuthSessionPayload> {
  const now = Math.floor(Date.now() / 1000);
  const orgId = String(member.org_id);
  const userId = String(member.id);
  const email = String(member.email);
  const accessExpiresAt = now + appAccessTokenSeconds;
  const refreshExpiresAt = now + appRefreshTokenSeconds;

  return {
    accessToken: await signAppToken({
      typ: "access",
      sub: userId,
      org: orgId,
      email,
      exp: accessExpiresAt
    }),
    refreshToken: await signAppToken({
      typ: "refresh",
      sub: userId,
      org: orgId,
      email,
      exp: refreshExpiresAt
    }),
    expiresAt: accessExpiresAt,
    user: { id: userId }
  };
}

async function ensureOrg(db: SupabaseClient, orgId: string) {
  const { data: org, error } = await db.from("snapquote_orgs").select("id").eq("id", orgId).maybeSingle();

  if (error) {
    throw error;
  }

  if (org) {
    return;
  }

  must(await db.from("snapquote_orgs").insert({
    id: orgId,
    name: "",
    trade: "painting",
    default_tax_rate: 0.13,
    default_terms: "50% deposit due to schedule the job, balance due on completion.",
    quote_valid_days: 14,
    plan: "trial"
  }));

  must(await db.from("snapquote_org_members").insert({
    id: defaultUserId,
    org_id: orgId,
    email: "demo@snapquote.local",
    name: "Demo Contractor",
    role: "owner"
  }));

  await seedStarterPriceBook(db, orgId, false);
}

async function getMe(db: SupabaseClient, request: Request) {
  const orgId = orgIdFromRequest(request);
  let org = await single(db.from("snapquote_orgs").select("*").eq("id", orgId));
  const hasStripeAccount = typeof org.stripe_account_id === "string" && org.stripe_account_id.length > 0;

  if (hasStripeAccount && (!org.stripe_charges_enabled || !org.stripe_payouts_enabled)) {
    org = await refreshStripeAccountStatus(db, orgId);
  }

  const user = await memberFromBearer(db, request) ??
    await single(db.from("snapquote_org_members").select("*").eq("org_id", orgId).limit(1));

  const entitlements = await sendEntitlementResponse(db, orgId, org);

  return {
    user: {
      id: user.id,
      orgId: user.org_id,
      email: user.email,
      name: user.name,
      role: user.role
    },
    org: orgResponse(org),
    entitlements,
    billing: billingResponse(org, entitlements)
  };
}

async function updateMe(db: SupabaseClient, request: Request) {
  const orgId = orgIdFromRequest(request);
  const input = parse(orgSettingsSchema, await request.json());
  const patch: Record<string, unknown> = {};

  if (input.businessName !== undefined) patch.name = input.businessName;
  if (input.defaultTaxRate !== undefined) patch.default_tax_rate = input.defaultTaxRate;
  if (input.defaultTerms !== undefined) patch.default_terms = input.defaultTerms;
  if (input.quoteValidDays !== undefined) patch.quote_valid_days = input.quoteValidDays;
  if (input.defaultDepositPercent !== undefined) patch.default_deposit_percent = input.defaultDepositPercent;
  if (input.contactPhone !== undefined) patch.contact_phone = input.contactPhone;
  if (input.website !== undefined) patch.website = input.website;
  if (input.logoUrl !== undefined) patch.logo_url = input.logoUrl;

  if (Object.keys(patch).length > 0) {
    await single(db.from("snapquote_orgs").update(patch).eq("id", orgId).select("*"));
  }

  return getMe(db, request);
}

async function uploadAvatar(db: SupabaseClient, request: Request) {
  const orgId = orgIdFromRequest(request);
  const input = parse(avatarUploadSchema, await request.json());
  const extension = extensionForContentType(input.contentType);
  const objectPath = `${orgId}/business-logo.${extension}`;
  const bytes = Uint8Array.from(atob(input.base64), (char) => char.charCodeAt(0));
  const bucket = "snapquote-avatars";

  const { error: bucketError } = await db.storage.createBucket(bucket, { public: true });

  if (bucketError && !bucketError.message.toLowerCase().includes("already exists")) {
    throw bucketError;
  }

  must(await db.storage.from(bucket).upload(objectPath, bytes, {
    contentType: input.contentType,
    upsert: true
  }));

  const { data } = db.storage.from(bucket).getPublicUrl(objectPath);
  const org = await single(db.from("snapquote_orgs").update({
    logo_url: `${data.publicUrl}?v=${Date.now()}`
  }).eq("id", orgId).select("*"));

  return { org: orgResponse(org) };
}

async function billingPortal(db: SupabaseClient, request: Request) {
  const member = await memberFromBearer(db, request);

  if (!member?.auth_user_id) {
    throw new HttpError(401, "Sign in before managing billing.");
  }

  const url = envFirst("QUOTEVAN_BILLING_PORTAL_URL", "SNAPQUOTE_BILLING_PORTAL_URL") ?? null;

  return { url };
}

async function deleteAccount(db: SupabaseClient, request: Request) {
  const member = await memberFromBearer(db, request);

  if (!member || !member.auth_user_id) {
    throw new HttpError(401, "Sign in before deleting your account.");
  }

  const authUserId = String(member.auth_user_id);
  const orgId = String(member.org_id);
  const { error: authError } = await db.auth.admin.deleteUser(authUserId);

  if (authError) {
    throw authError;
  }

  must(await db.from("snapquote_orgs").delete().eq("id", orgId));

  return { deleted: true };
}

async function adminOpsHealth(db: SupabaseClient, request: Request) {
  assertAdminSecret(request);

  const database = {
    orgs: await tableHealth(db, "snapquote_orgs"),
    orgMembers: await tableHealth(db, "snapquote_org_members"),
    customers: await tableHealth(db, "snapquote_customers"),
    priceBookItems: await tableHealth(db, "snapquote_price_book_items"),
    quotes: await tableHealth(db, "snapquote_quotes"),
    quoteLineItems: await tableHealth(db, "snapquote_quote_line_items"),
    quoteEvents: await tableHealth(db, "snapquote_quote_events"),
    quotePublicLinks: await tableHealth(db, "snapquote_quote_public_links"),
    quotePayments: await tableHealth(db, "snapquote_quote_payments"),
    pricingSuggestions: await tableHealth(db, "snapquote_service_price_suggestions")
  };
  const checks = Object.values(database);

  return {
    ok: checks.every((check) => check.ok),
    service: "quotevan-edge",
    timestamp: new Date().toISOString(),
    config: {
      supabaseUrl: hasEnv("SUPABASE_URL"),
      serviceRoleKey: hasEnv("SUPABASE_SERVICE_ROLE_KEY"),
      publicBaseUrl: hasAnyEnv("QUOTEVAN_PUBLIC_BASE_URL", "SNAPQUOTE_PUBLIC_BASE_URL"),
      resendApiKey: hasEnv("RESEND_API_KEY"),
      emailFrom: hasAnyEnv("QUOTE_EMAIL_FROM", "SNAPQUOTE_EMAIL_FROM"),
      emailWebhookUrl: hasAnyEnv("QUOTE_EMAIL_WEBHOOK_URL", "SNAPQUOTE_EMAIL_WEBHOOK_URL"),
      inboundEmailSecret: hasAnyEnv("QUOTEVAN_INBOUND_EMAIL_SECRET", "SNAPQUOTE_INBOUND_EMAIL_SECRET", "SNAPQUOTE_EMAIL_WEBHOOK_SECRET"),
      openAiApiKey: hasEnv("OPENAI_API_KEY"),
      stripeSecretKey: hasEnv("STRIPE_SECRET_KEY"),
      stripeWebhookSecret: hasEnv("STRIPE_WEBHOOK_SECRET"),
      stripeConnectReturnUrl: hasAnyEnv("QUOTEVAN_CONNECT_RETURN_URL", "SNAPQUOTE_CONNECT_RETURN_URL"),
      twilioAccountSid: hasEnv("TWILIO_ACCOUNT_SID"),
      twilioAuthToken: hasEnv("TWILIO_AUTH_TOKEN"),
      twilioFromPhone: hasAnyEnv("TWILIO_FROM_PHONE", "SNAPQUOTE_FROM_PHONE"),
      adminSecret: hasAnyEnv("QUOTEVAN_ADMIN_SECRET", "SNAPQUOTE_ADMIN_SECRET", "SNAPQUOTE_PRICING_INGEST_SECRET"),
      billingPortalUrl: hasAnyEnv("QUOTEVAN_BILLING_PORTAL_URL", "SNAPQUOTE_BILLING_PORTAL_URL")
    },
    database,
    runtime: {
      rateLimitBuckets: rateLimitBuckets.size
    }
  };
}

async function tableHealth(db: SupabaseClient, table: string) {
  const { count, error } = await db.from(table).select("id", { count: "exact", head: true });

  if (error) {
    return { ok: false, count: null, error: error.message };
  }

  return { ok: true, count: count ?? 0 };
}

function envFirst(...names: string[]) {
  for (const name of names) {
    const value = Deno.env.get(name);

    if (value) {
      return value;
    }
  }

  return undefined;
}

function hasEnv(name: string) {
  return Boolean(envFirst(name));
}

function hasAnyEnv(...names: string[]) {
  return names.some((name) => hasEnv(name));
}

async function memberFromBearer(db: SupabaseClient, request: Request) {
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!bearerToken) {
    return null;
  }

  const appPayload = await verifyAppToken(bearerToken, "access").catch(() => null);

  if (appPayload) {
    return maybeSingle(db.from("snapquote_org_members").select("*").eq("id", appPayload.sub));
  }

  const { data, error } = await db.auth.getUser(bearerToken);

  if (error || !data.user) {
    return null;
  }

  const { data: member, error: memberError } = await db
    .from("snapquote_org_members")
    .select("*")
    .eq("auth_user_id", data.user.id)
    .maybeSingle();

  if (memberError) {
    throw memberError;
  }

  return member;
}

async function onboardPainter(db: SupabaseClient, request: Request) {
  const orgId = orgIdFromRequest(request);
  const input = parse(onboardingSchema, await request.json());

  const org = await single(db.from("snapquote_orgs").update({
    name: input.businessName,
    default_tax_rate: input.defaultTaxRate,
    default_terms: input.defaultTerms,
    quote_valid_days: input.quoteValidDays,
    setup_completed_at: new Date().toISOString()
  }).eq("id", orgId).select("*"));

  await seedStarterPriceBook(db, orgId, true, input.corePrices);
  return { org: orgResponse(org), priceBookItems: await listPriceBook(db, orgId) };
}

async function seedStarterPriceBook(
  db: SupabaseClient,
  orgId: string,
  replace: boolean,
  corePrices = defaultCorePrices
) {
  if (replace) {
    must(await db.from("snapquote_price_book_items").delete().eq("org_id", orgId).eq("starter", true));
  }

  const existing = await listPriceBook(db, orgId);
  const existingKeys = new Set(existing.map((item) => item.key));
  const now = new Date().toISOString();
  const rows = starterDefinitions
    .filter((definition) => !existingKeys.has(definition.key))
    .map((definition) => {
      const pricing = corePricing(definition.key, corePrices) ?? definition.pricing;

      return priceBookInsert({
        orgId,
        key: definition.key,
        name: definition.name,
        description: definition.description,
        unit: definition.unit,
        kind: definition.kind,
        starter: true,
        pricing,
        confirmedAt: definition.core && corePricing(definition.key, corePrices) ? now : null,
        usageCount: 0
      });
    });

  if (rows.length > 0) {
    must(await db.from("snapquote_price_book_items").insert(rows));
  }
}

async function listPricingSuggestions(db: SupabaseClient, request: Request) {
  const query = parse(pricingSuggestionQuerySchema, Object.fromEntries(new URL(request.url).searchParams.entries()));
  const versionRow = await maybeSingle(db
    .from("snapquote_pricing_versions")
    .select("*")
    .eq("trade", query.trade)
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(1));

  if (!versionRow) {
    return {
      version: null,
      region: null,
      suggestions: []
    };
  }

  const regionRow = await resolvePricingRegion(db, query);

  if (!regionRow) {
    return {
      version: pricingVersionFromRow(versionRow as PricingVersionRow),
      region: null,
      suggestions: []
    };
  }

  let suggestionRows = await suggestionRowsForRegion(db, String(versionRow.id), String(regionRow.id));
  let selectedRegionRow = regionRow;

  if (suggestionRows.length === 0 && regionRow.key !== "global") {
    const fallbackRegion = await pricingRegionByKey(db, "global");

    if (fallbackRegion) {
      selectedRegionRow = fallbackRegion;
      suggestionRows = await suggestionRowsForRegion(db, String(versionRow.id), String(fallbackRegion.id));
    }
  }

  const templateRows = await serviceTemplatesByIds(
    db,
    suggestionRows.map((row) => row.service_template_id)
  );
  const templateById = new Map(templateRows.map((row) => [row.id, row]));

  return {
    version: pricingVersionFromRow(versionRow as PricingVersionRow),
    region: pricingRegionFromRow(selectedRegionRow),
    suggestions: suggestionRows
      .map((row) => {
        const template = templateById.get(row.service_template_id);
        return template ? servicePriceSuggestionFromRows(row, template, selectedRegionRow, versionRow as PricingVersionRow) : null;
      })
      .filter((suggestion) => suggestion !== null)
  };
}

async function ingestPricingSuggestions(db: SupabaseClient, request: Request) {
  assertAdminSecret(request);
  const input = parse(pricingSuggestionIngestSchema, await request.json());
  const region = await upsertPricingRegion(db, input.region);
  const sourceKey = input.source.key ?? slugKey(`${input.source.sourceType}-${input.source.name}`);
  const source = await upsertPricingSource(db, { ...input.source, key: sourceKey });
  const versionKey = input.version.key ?? slugKey(`${input.trade}-${input.region.key}-${input.version.formulaVersion}`);
  const publishedAt = input.version.status === "published"
    ? input.version.publishedAt ?? new Date().toISOString()
    : input.version.publishedAt ?? null;
  const version = await upsertPricingVersion(db, {
    key: versionKey,
    trade: input.trade,
    status: input.version.status,
    formulaVersion: input.version.formulaVersion,
    publishedAt,
    sourceSnapshot: {
      ...input.version.sourceSnapshot,
      sources: Array.from(new Set([
        ...arrayOfStrings((input.version.sourceSnapshot as { sources?: unknown }).sources),
        sourceKey
      ]))
    },
    notes: input.version.notes
  });

  const ingestedSuggestions: Array<{ id: string; templateKey: string; name: string }> = [];

  for (const suggestion of input.suggestions) {
    const templateKey = suggestion.key ?? slugKey(suggestion.name);
    const pricing = suggestionPricing(suggestion);
    const pricingType = pricing.type;
    const template = await upsertServiceTemplate(db, {
      trade: input.trade,
      key: templateKey,
      name: suggestion.name,
      description: suggestion.description,
      unit: suggestion.unit,
      kind: suggestion.kind,
      defaultPricingType: pricingType,
      aliases: suggestion.aliases
    });
    const serviceSuggestion = await upsertServicePriceSuggestion(db, {
      versionId: String(version.id),
      templateId: String(template.id),
      regionId: String(region.id),
      unit: suggestion.unit,
      pricingType,
      lowCents: suggestion.lowCents,
      medianCents: suggestion.medianCents,
      highCents: suggestion.highCents,
      pricing,
      currency: String(region.currency),
      confidence: suggestion.confidence,
      provenance: {
        ...suggestion.provenance,
        sourceKey,
        ingestedAt: new Date().toISOString()
      }
    });

    await upsertSuggestionSourceLink(db, String(serviceSuggestion.id), String(source.id), suggestion.sourceNote);
    ingestedSuggestions.push({ id: String(serviceSuggestion.id), templateKey, name: suggestion.name });
  }

  must(await db.from("snapquote_pricing_suggestion_audit_log").insert({
    version_id: version.id,
    action: "ingest_pricing_suggestions",
    actor: input.actor,
    meta: {
      regionKey: input.region.key,
      sourceKey,
      suggestionCount: ingestedSuggestions.length,
      templateKeys: ingestedSuggestions.map((suggestion) => suggestion.templateKey)
    }
  }));

  return {
    ok: true,
    version: pricingVersionFromRow(version as PricingVersionRow),
    region: pricingRegionFromRow(region as PricingRegionRow),
    source: { id: source.id, key: source.key, name: source.name },
    suggestions: ingestedSuggestions
  };
}

async function resolvePricingRegion(
  db: SupabaseClient,
  query: z.infer<typeof pricingSuggestionQuerySchema>
): Promise<PricingRegionRow | null> {
  if (query.regionKey) {
    const explicit = await pricingRegionByKey(db, query.regionKey);

    if (explicit) {
      return explicit;
    }
  }

  if (query.country && query.region && query.metro) {
    const metro = await maybeSingle(db
      .from("snapquote_pricing_regions")
      .select("*")
      .eq("country_code", query.country.toUpperCase())
      .eq("region_code", query.region.toUpperCase())
      .ilike("metro_name", query.metro)
      .eq("active", true)
      .limit(1));

    if (metro) {
      return metro as PricingRegionRow;
    }
  }

  if (query.country && query.region) {
    const stateRegion = await maybeSingle(db
      .from("snapquote_pricing_regions")
      .select("*")
      .eq("country_code", query.country.toUpperCase())
      .eq("region_code", query.region.toUpperCase())
      .is("metro_name", null)
      .eq("active", true)
      .limit(1));

    if (stateRegion) {
      return stateRegion as PricingRegionRow;
    }
  }

  return await pricingRegionByKey(db, "global");
}

async function pricingRegionByKey(db: SupabaseClient, key: string): Promise<PricingRegionRow | null> {
  const row = await maybeSingle(db
    .from("snapquote_pricing_regions")
    .select("*")
    .eq("key", key)
    .eq("active", true)
    .limit(1));

  return row as PricingRegionRow | null;
}

async function suggestionRowsForRegion(
  db: SupabaseClient,
  versionId: string,
  regionId: string
): Promise<ServicePriceSuggestionRow[]> {
  const { data, error } = await db
    .from("snapquote_service_price_suggestions")
    .select("*")
    .eq("version_id", versionId)
    .eq("region_id", regionId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return data as ServicePriceSuggestionRow[];
}

async function serviceTemplatesByIds(db: SupabaseClient, ids: string[]): Promise<ServiceTemplateRow[]> {
  if (ids.length === 0) {
    return [];
  }

  const { data, error } = await db
    .from("snapquote_service_templates")
    .select("*")
    .in("id", ids);

  if (error) {
    throw error;
  }

  return (data as ServiceTemplateRow[]).map((row) => {
    const template = serviceTemplateFromRow(row);
    return {
      id: template.id,
      trade: template.trade,
      key: template.key,
      name: template.name,
      description: template.description,
      unit: template.unit,
      kind: template.kind,
      default_pricing_type: template.defaultPricingType,
      aliases: template.aliases,
      active: template.active,
      created_at: template.createdAt,
      updated_at: template.updatedAt
    };
  });
}

async function upsertPricingRegion(
  db: SupabaseClient,
  input: z.infer<typeof pricingSuggestionIngestSchema>["region"]
) {
  const patch = {
    key: input.key,
    country_code: input.countryCode?.toUpperCase() ?? null,
    region_code: input.regionCode?.toUpperCase() ?? null,
    metro_name: input.metroName ?? null,
    currency: input.currency.toUpperCase(),
    labor_multiplier: input.laborMultiplier,
    material_multiplier: input.materialMultiplier,
    confidence: input.confidence,
    active: input.active
  };
  const existing = await maybeSingle(db.from("snapquote_pricing_regions").select("*").eq("key", input.key).limit(1));

  if (existing) {
    return await single(db.from("snapquote_pricing_regions").update(patch).eq("id", existing.id).select("*"));
  }

  return await single(db.from("snapquote_pricing_regions").insert(patch).select("*"));
}

async function upsertPricingSource(
  db: SupabaseClient,
  input: z.infer<typeof pricingSuggestionIngestSchema>["source"] & { key: string }
) {
  const patch = {
    key: input.key,
    name: input.name,
    source_type: input.sourceType,
    source_url: input.sourceUrl ?? null,
    collected_at: input.collectedAt ?? null,
    notes: input.notes,
    confidence: input.confidence
  };
  const existing = await maybeSingle(db.from("snapquote_pricing_sources").select("*").eq("key", input.key).limit(1));

  if (existing) {
    return await single(db.from("snapquote_pricing_sources").update(patch).eq("id", existing.id).select("*"));
  }

  return await single(db.from("snapquote_pricing_sources").insert(patch).select("*"));
}

async function upsertPricingVersion(
  db: SupabaseClient,
  input: {
    key: string;
    trade: string;
    status: PricingVersionRow["status"];
    formulaVersion: string;
    publishedAt: string | null;
    sourceSnapshot: Record<string, unknown>;
    notes: string;
  }
) {
  const patch = {
    key: input.key,
    trade: input.trade,
    status: input.status,
    formula_version: input.formulaVersion,
    published_at: input.publishedAt,
    source_snapshot: input.sourceSnapshot,
    notes: input.notes
  };
  const existing = await maybeSingle(db.from("snapquote_pricing_versions").select("*").eq("key", input.key).limit(1));

  if (existing) {
    return await single(db.from("snapquote_pricing_versions").update(patch).eq("id", existing.id).select("*"));
  }

  return await single(db.from("snapquote_pricing_versions").insert(patch).select("*"));
}

async function upsertServiceTemplate(
  db: SupabaseClient,
  input: {
    trade: string;
    key: string;
    name: string;
    description: string;
    unit: ServiceTemplateRow["unit"];
    kind: ServiceTemplateRow["kind"];
    defaultPricingType: ServiceTemplateRow["default_pricing_type"];
    aliases: string[];
  }
) {
  const patch = {
    trade: input.trade,
    key: input.key,
    name: input.name,
    description: input.description,
    unit: input.unit,
    kind: input.kind,
    default_pricing_type: input.defaultPricingType,
    aliases: input.aliases,
    active: true
  };
  const existing = await maybeSingle(db
    .from("snapquote_service_templates")
    .select("*")
    .eq("trade", input.trade)
    .eq("key", input.key)
    .limit(1));

  if (existing) {
    return await single(db.from("snapquote_service_templates").update(patch).eq("id", existing.id).select("*"));
  }

  return await single(db.from("snapquote_service_templates").insert(patch).select("*"));
}

async function upsertServicePriceSuggestion(
  db: SupabaseClient,
  input: {
    versionId: string;
    templateId: string;
    regionId: string;
    unit: ServicePriceSuggestionRow["unit"];
    pricingType: ServicePriceSuggestionRow["pricing_type"];
    lowCents: number;
    medianCents: number;
    highCents: number;
    pricing: PriceBookPricing;
    currency: string;
    confidence: number;
    provenance: Record<string, unknown>;
  }
) {
  const patch = {
    version_id: input.versionId,
    service_template_id: input.templateId,
    region_id: input.regionId,
    unit: input.unit,
    pricing_type: input.pricingType,
    low_cents: input.lowCents,
    median_cents: input.medianCents,
    high_cents: input.highCents,
    pricing: input.pricing,
    currency: input.currency,
    confidence: input.confidence,
    provenance: input.provenance
  };
  const existing = await maybeSingle(db
    .from("snapquote_service_price_suggestions")
    .select("*")
    .eq("version_id", input.versionId)
    .eq("service_template_id", input.templateId)
    .eq("region_id", input.regionId)
    .limit(1));

  if (existing) {
    return await single(db.from("snapquote_service_price_suggestions").update(patch).eq("id", existing.id).select("*"));
  }

  return await single(db.from("snapquote_service_price_suggestions").insert(patch).select("*"));
}

async function upsertSuggestionSourceLink(db: SupabaseClient, suggestionId: string, sourceId: string, note: string) {
  const existing = await maybeSingle(db
    .from("snapquote_suggestion_source_links")
    .select("*")
    .eq("suggestion_id", suggestionId)
    .eq("source_id", sourceId)
    .limit(1));
  const patch = {
    suggestion_id: suggestionId,
    source_id: sourceId,
    weight: 1,
    note
  };

  if (existing) {
    must(await db
      .from("snapquote_suggestion_source_links")
      .update({ weight: patch.weight, note: patch.note })
      .eq("suggestion_id", suggestionId)
      .eq("source_id", sourceId));
    return;
  }

  must(await db.from("snapquote_suggestion_source_links").insert(patch));
}

function suggestionPricing(
  suggestion: z.infer<typeof pricingSuggestionIngestSchema>["suggestions"][number]
): PriceBookPricing {
  if (suggestion.pricing) {
    return suggestion.pricing;
  }

  const pricingType = suggestion.pricingType ?? (suggestion.unit === "room" ? "room_size" : "fixed");

  if (pricingType === "room_size") {
    return {
      type: "room_size",
      prices: {
        small: suggestion.lowCents,
        medium: suggestion.medianCents,
        large: suggestion.highCents
      }
    };
  }

  return {
    type: "fixed",
    unitPriceCents: suggestion.medianCents
  };
}

async function listPriceBook(db: SupabaseClient, orgId: string): Promise<PriceBookItem[]> {
  const { data, error } = await db.from("snapquote_price_book_items").select("*").eq("org_id", orgId)
    .is("archived_at", null)
    .order("confirmed_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data as PriceBookRow[]).map(priceBookItemFromRow);
}

async function updatePriceBookItem(db: SupabaseClient, request: Request, id: string) {
  const input = parse(priceBookPatchSchema, await request.json());
  const patch: Record<string, unknown> = {};

  if (input.name !== undefined) {
    patch.name = input.name;
  }

  if (input.description !== undefined) {
    patch.description = input.description;
  }

  if (input.confirmed !== undefined) {
    patch.confirmed_at = input.confirmed ? new Date().toISOString() : null;
  }

  if (input.pricing !== undefined) {
    Object.assign(patch, pricingColumns(input.pricing));
  }

  const item = await single(
    db.from("snapquote_price_book_items").update(patch).eq("id", id).eq("org_id", orgIdFromRequest(request)).select("*")
  );
  return priceBookItemFromRow(item as PriceBookRow);
}

async function archivePriceBookItem(db: SupabaseClient, request: Request, id: string) {
  const orgId = orgIdFromRequest(request);
  const now = new Date().toISOString();
  const item = await single(
    db.from("snapquote_price_book_items")
      .update({ archived_at: now, updated_at: now })
      .eq("id", id)
      .eq("org_id", orgId)
      .is("archived_at", null)
      .select("id")
  ) as { id: string };

  return { id: item.id, archived: true };
}

async function createPriceBookItem(db: SupabaseClient, request: Request) {
  const orgId = orgIdFromRequest(request);
  const input = parse(priceBookCreateSchema, await request.json());
  const now = new Date().toISOString();
  const item = await single(db.from("snapquote_price_book_items").insert(priceBookInsert({
    orgId,
    key: slugKey(input.name),
    name: input.name,
    description: input.description,
    unit: input.unit,
    pricing: input.pricing,
    kind: input.kind,
    starter: false,
    confirmedAt: input.confirmed ? now : null,
    usageCount: 0
  })).select("*"));

  return priceBookItemFromRow(item as PriceBookRow);
}

async function listCustomers(db: SupabaseClient, orgId: string, request: Request) {
  const search = new URL(request.url).searchParams.get("q")?.trim();
  let query = db.from("snapquote_customers").select("*").eq("org_id", orgId);

  if (search !== undefined && search.length > 0) {
    const term = searchTerm(search);
    query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%,address.ilike.%${term}%,city.ilike.%${term}%`);
  }

  const { data, error } = await query.order("created_at", { ascending: false }).limit(100);

  if (error) {
    throw error;
  }

  return data.map(customerResponse);
}

async function createCustomer(db: SupabaseClient, request: Request) {
  const input = parse(customerSchema, await request.json());
  const row = await upsertCustomerFromInput(db, orgIdFromRequest(request), input);
  return customerResponse(row);
}

async function updateCustomer(db: SupabaseClient, request: Request, customerId: string) {
  const orgId = orgIdFromRequest(request);
  const input = parse(customerPatchSchema, await request.json());
  await assertCustomerContactAvailable(db, orgId, input, customerId);

  const patch: Record<string, string | null> = {};

  if (input.name !== undefined) {
    patch.name = input.name;
  }

  if (input.email !== undefined) {
    patch.email = normalizedEmail(input.email);
  }

  if (input.phone !== undefined) {
    patch.phone = input.phone ?? null;
  }

  if (input.address !== undefined) {
    patch.address = input.address;
  }

  if (input.city !== undefined) {
    patch.city = input.city;
  } else if (input.address !== undefined) {
    patch.city = deriveCustomerCity(input.address);
  }

  const row = await single(db.from("snapquote_customers").update(patch).eq("org_id", orgId).eq("id", customerId).select("*"));
  return customerResponse(row);
}

async function deleteCustomer(db: SupabaseClient, request: Request, customerId: string) {
  const orgId = orgIdFromRequest(request);
  await single(db.from("snapquote_customers").select("id").eq("org_id", orgId).eq("id", customerId));
  const quoteCount = await countCustomerQuotes(db, orgId, customerId);

  if (quoteCount > 0) {
    throw new HttpError(409, "Merge or reassign this customer's quotes before deleting.");
  }

  must(await db.from("snapquote_customers").delete().eq("org_id", orgId).eq("id", customerId));

  return { id: customerId, deleted: true };
}

async function mergeCustomer(db: SupabaseClient, request: Request, sourceCustomerId: string) {
  const orgId = orgIdFromRequest(request);
  const input = parse(customerMergeSchema, await request.json());

  if (input.targetCustomerId === sourceCustomerId) {
    throw new HttpError(409, "Choose a different customer to merge into.");
  }

  await single(db.from("snapquote_customers").select("id").eq("org_id", orgId).eq("id", sourceCustomerId));
  const target = await single(db.from("snapquote_customers").select("*").eq("org_id", orgId).eq("id", input.targetCustomerId));
  const { data: quoteRows, error: quoteError } = await db
    .from("snapquote_quotes")
    .select("id")
    .eq("org_id", orgId)
    .eq("customer_id", sourceCustomerId);

  if (quoteError) {
    throw quoteError;
  }

  const reassignedQuoteIds = (quoteRows ?? []).map((row) => String(row.id));

  if (reassignedQuoteIds.length > 0) {
    must(await db
      .from("snapquote_quotes")
      .update({ customer_id: input.targetCustomerId })
      .eq("org_id", orgId)
      .eq("customer_id", sourceCustomerId));
  }

  must(await db.from("snapquote_customers").delete().eq("org_id", orgId).eq("id", sourceCustomerId));

  return {
    sourceCustomerId,
    targetCustomer: customerResponse(target),
    reassignedQuoteIds
  };
}

async function createQuote(db: SupabaseClient, request: Request) {
  const orgId = orgIdFromRequest(request);
  const input = parse(createQuoteSchema, await request.json());
  const customer = input.customerId
    ? await single(db.from("snapquote_customers").select("*").eq("org_id", orgId).eq("id", input.customerId))
    : await createCustomerFromInput(db, orgId, input.customer!);

  const org = await single(db.from("snapquote_orgs").select("*").eq("id", orgId));
  const priceBookItems = await listPriceBook(db, orgId);
  const draft = createPainterDraftLines({
    checklist: input.checklist as PainterChecklist,
    transcript: input.transcript,
    priceBookItems
  });
  const extractionResult = await extractScopeForInput({
    transcript: input.transcript,
    typedNotes: input.typedNotes ?? "",
    checklist: input.checklist as PainterChecklist
  }).catch(() => ({
    source: "fallback" as const,
    extraction: fallbackExtraction(input.transcript, input.typedNotes ?? "", input.checklist as PainterChecklist)
  }));
  console.info("SnapQuote quote extraction source", { source: extractionResult.source });
  const extractedLines = lineItemsFromExtraction({
    tasks: extractionResult.extraction.tasks,
    existingLines: draft.lineItems,
    priceBookItems,
    startPosition: draft.lineItems.length
  });
  const lineItems = [...draft.lineItems, ...extractedLines].map((line, index) => ({ ...line, position: index }));
  const scopeNotes = uniqueStrings([
    ...draft.scopeNotes,
    ...extractionResult.extraction.site_conditions,
    ...extractionResult.extraction.questions_for_contractor.map((question) => `Question: ${question}`)
  ]);
  const discount: QuoteDiscount = { type: "none", value: 0 };
  const totals = computeTotalsIfReady({
    lineItems,
    discount,
    taxRate: Number(org.default_tax_rate)
  });
  const validUntil = addDays(new Date(), Number(org.quote_valid_days));
  const quote = await single(db.from("snapquote_quotes").insert({
    org_id: orgId,
    customer_id: customer.id,
    address: input.address,
    work_type: input.workType ?? inferQuoteWorkType(input.jobTitle ?? "", input.checklist as PainterChecklist),
    job_title: input.jobTitle ?? "",
    valid_until: validUntil,
    discount_type: discount.type,
    discount_value: discount.value,
    tax_rate: Number(org.default_tax_rate),
    deposit_percent: Number(org.default_deposit_percent ?? 50),
    payment_currency: String(org.payment_currency ?? "cad").toLowerCase(),
    notes: input.typedNotes ?? "",
    terms: org.default_terms,
    scope_summary: extractionResult.extraction.scope_summary || buildScopeSummary(customer.name, input.checklist as PainterChecklist, scopeNotes),
    scope_notes: scopeNotes,
    conflicts: draft.conflicts,
    checklist: input.checklist,
    transcript: input.transcript,
    audio_storage_path: input.audioStoragePath ?? null,
    audio_content_type: input.audioContentType ?? null,
    audio_duration_seconds: input.audioDurationSeconds ?? null,
    ...totalsColumns(totals)
  }).select("*"));

  must(await db.from("snapquote_quote_line_items").insert(lineItems.map((line) => lineInsert(quote.id, line))));
  must(await db.from("snapquote_quote_public_links").insert({ quote_id: quote.id, token: publicToken() }));
  await createEvent(db, quote.id, "created");

  return getQuoteResponse(db, orgId, quote.id);
}

async function transcribeAudio(db: SupabaseClient, request: Request) {
  const orgId = orgIdFromRequest(request);
  const input = parse(audioUploadSchema, await request.json());
  const bytes = Uint8Array.from(atob(input.base64), (char) => char.charCodeAt(0));
  const bucket = "snapquote-quote-audio";
  const objectPath = `${orgId}/${crypto.randomUUID()}-${safeStorageName(input.fileName)}`;

  const { error: bucketError } = await db.storage.createBucket(bucket, { public: false });

  if (bucketError && !bucketError.message.toLowerCase().includes("already exists")) {
    throw bucketError;
  }

  must(await db.storage.from(bucket).upload(objectPath, bytes, {
    contentType: input.contentType,
    upsert: false
  }));

  const transcription = await transcribeWithOpenAI(bytes, input.contentType, input.fileName);

  return {
    source: transcription.source,
    model: "model" in transcription ? transcription.model : undefined,
    transcript: transcription.transcript,
    audio: {
      storagePath: objectPath,
      contentType: input.contentType,
      durationSeconds: input.durationSeconds ?? null
    }
  };
}

async function transcribeWithOpenAI(bytes: Uint8Array, contentType: string, fileName: string) {
  const openAiKey = Deno.env.get("OPENAI_API_KEY");

  if (!openAiKey) {
    console.info("SnapQuote transcription source", { source: "fallback", reason: "missing_openai_key" });
    return { source: "fallback" as const, transcript: "" };
  }

  const model = Deno.env.get("OPENAI_TRANSCRIBE_MODEL") ?? "gpt-4o-mini-transcribe";
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: contentType }), safeStorageName(fileName));
  form.append("model", model);

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      "authorization": `Bearer ${openAiKey}`
    },
    body: form
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    console.warn("SnapQuote OpenAI transcription failed", { status: response.status, message });
    return { source: "fallback" as const, transcript: "" };
  }

  const body = await response.json();
  const transcript = typeof body.text === "string" ? body.text.trim() : "";
  console.info("SnapQuote transcription source", { source: "openai", model });

  return { source: "openai" as const, model, transcript };
}

async function extractScope(request: Request) {
  const input = parse(extractScopeSchema, await request.json());
  return extractScopeForInput(input);
}

async function extractScopeForInput(input: z.infer<typeof extractScopeSchema>) {
  const openAiKey = Deno.env.get("OPENAI_API_KEY");
  const fallback = () => ({
    source: "fallback" as const,
    extraction: fallbackExtraction(input.transcript, input.typedNotes, input.checklist as PainterChecklist)
  });

  if (!openAiKey) {
    console.info("SnapQuote extraction source", { source: "fallback", reason: "missing_openai_key" });
    return fallback();
  }

  const model = Deno.env.get("OPENAI_MODEL") ?? "gpt-4.1-mini";
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "authorization": `Bearer ${openAiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content: [
              "Extract quote scope for a painting contractor.",
              "Never invent prices. Extract scope, quantities, assumptions, questions, and site conditions only.",
              "If a detail is not stated, leave it out or ask a contractor question."
            ].join(" ")
          },
          {
            role: "user",
            content: JSON.stringify({
              transcript: input.transcript,
              typedNotes: input.typedNotes,
              checklist: input.checklist
            })
          }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "snapquote_scope_extraction",
            strict: true,
            schema: extractionJsonSchema()
          }
        }
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI extraction failed with ${response.status}`);
    }

    const body = await response.json();
    const text = extractResponseText(body);
    const extraction = parse(extractionResultSchema, JSON.parse(text));
    console.info("SnapQuote extraction source", { source: "openai", model });

    return { source: "openai" as const, model, extraction };
  } catch (error) {
    console.warn("SnapQuote OpenAI extraction failed; using fallback", messageFromError(error));
    return fallback();
  }
}

async function listQuotes(db: SupabaseClient, orgId: string) {
  await refreshStatuses(db, orgId);
  const { data, error } = await db
    .from("snapquote_quotes")
    .select("id")
    .eq("org_id", orgId)
    .is("archived_at", null)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return Promise.all(data.map((row) => getQuoteResponse(db, orgId, row.id)));
}

async function getQuoteResponse(db: SupabaseClient, orgId: string, quoteId: string) {
  await refreshStatuses(db, orgId);
  const quote = await single(db.from("snapquote_quotes").select("*").eq("org_id", orgId).eq("id", quoteId)) as QuoteRow;
  const org = await single(db.from("snapquote_orgs").select("*").eq("id", quote.org_id));
  const customer = await single(db.from("snapquote_customers").select("*").eq("id", quote.customer_id));
  const lineItems = await listLines(db, quote.id);
  const publicLink = await ensurePublicQuoteLink(db, quote.id);
  const totals = quote.total_cents === null
    ? null
    : {
        subtotalCents: quote.subtotal_cents ?? 0,
        discountCents: quote.discount_cents ?? 0,
        taxCents: quote.tax_cents ?? 0,
        totalCents: quote.total_cents
      };

  return {
    id: quote.id,
    orgId: quote.org_id,
    org: orgResponse(org),
    customerId: quote.customer_id,
    customer: customerResponse(customer),
    address: quote.address,
    workType: quote.work_type,
    jobTitle: quote.job_title,
    status: quote.status,
    publicToken: publicLink.token,
    publicUrl: publicQuoteUrl(publicLink.token),
    validUntil: quote.valid_until,
    lineItems,
    discount: toDiscount(quote.discount_type, quote.discount_value),
    taxRate: Number(quote.tax_rate),
    totals,
    notes: quote.notes,
    terms: quote.terms,
    scopeSummary: quote.scope_summary,
    scopeNotes: quote.scope_notes,
    conflicts: quote.conflicts,
    checklist: quote.checklist,
    transcript: quote.transcript,
    audioStoragePath: quote.audio_storage_path ?? null,
    audioContentType: quote.audio_content_type ?? null,
    audioDurationSeconds: quote.audio_duration_seconds ?? null,
    sentAt: quote.sent_at,
    firstViewedAt: quote.first_viewed_at,
    respondedAt: quote.responded_at,
    supersededByQuoteId: quote.superseded_by_quote_id,
    archivedAt: quote.archived_at,
    payment: {
      status: quote.payment_status ?? "not_requested",
      depositPercent: Number(quote.deposit_percent ?? 50),
      depositAmountCents: quote.deposit_amount_cents,
      paidAmountCents: quote.paid_amount_cents ?? 0,
      currency: String(quote.payment_currency ?? "cad"),
      paidAt: quote.paid_at,
      checkoutSessionId: quote.stripe_checkout_session_id,
      providerConnected: Boolean(org.stripe_charges_enabled && org.stripe_payouts_enabled && org.stripe_account_id)
    },
    createdAt: quote.created_at,
    updatedAt: quote.updated_at,
    sendBlockers: getQuoteSendBlockers(lineItems),
    isStale: isQuoteStale({
      sentAt: quote.sent_at,
      firstViewedAt: quote.first_viewed_at,
      respondedAt: quote.responded_at,
      now: new Date()
    })
  };
}

async function ensurePublicQuoteLink(db: SupabaseClient, quoteId: string) {
  const existing = await maybeSingle(
    db.from("snapquote_quote_public_links")
      .select("*")
      .eq("quote_id", quoteId)
      .is("revoked_at", null)
  );

  if (existing) {
    return existing;
  }

  return await single(
    db.from("snapquote_quote_public_links")
      .insert({ quote_id: quoteId, token: publicToken() })
      .select("*")
  );
}

async function patchQuote(db: SupabaseClient, request: Request, quoteId: string) {
  const orgId = orgIdFromRequest(request);
  const input = parse(quotePatchSchema, await request.json());
  const quote = await single(db.from("snapquote_quotes").select("*").eq("id", quoteId).eq("org_id", orgId)) as QuoteRow;

  if (quote.status !== "draft") {
    throw new HttpError(409, "Sent/responded quotes are immutable; revise to create a new draft");
  }

  let lineItems = await listLines(db, quoteId);

  if (input.lineItems !== undefined) {
    const existingLineIds = new Set(lineItems.map((line) => line.id));
    must(await db.from("snapquote_quote_line_items").delete().eq("quote_id", quoteId));
    const normalized = input.lineItems.map((line: QuoteLineItem, index: number) => ({
      ...line,
      id: line.id && existingLineIds.has(line.id) ? line.id : undefined,
      position: index
    }));
    if (normalized.length > 0) {
      must(await db.from("snapquote_quote_line_items").insert(normalized.map((line: QuoteLineItem) => lineInsert(quoteId, line))));
    }
    lineItems = normalized;
  }

  const discount = input.discount ?? toDiscount(quote.discount_type, quote.discount_value);
  const taxRate = input.taxRate ?? Number(quote.tax_rate);
  const totals = computeTotalsIfReady({ lineItems, discount, taxRate });
  const patch: Record<string, unknown> = {
    discount_type: discount.type,
    discount_value: discount.value,
    tax_rate: taxRate,
    ...totalsColumns(totals)
  };

  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.terms !== undefined) patch.terms = input.terms;
  if (input.validUntil !== undefined) patch.valid_until = input.validUntil;

  must(await db.from("snapquote_quotes").update(patch).eq("id", quoteId).eq("org_id", orgId));
  return getQuoteResponse(db, orgId, quoteId);
}

async function confirmLine(db: SupabaseClient, request: Request, quoteId: string, lineId: string) {
  const orgId = orgIdFromRequest(request);
  const line = await single(db.from("snapquote_quote_line_items").select("*").eq("id", lineId).eq("quote_id", quoteId)) as LineRow;

  if (line.match_state !== "yellow" || !line.price_book_item_id) {
    throw new HttpError(409, "Only yellow price-book lines can be confirmed");
  }

  const now = new Date().toISOString();
  const existingItem = await single(
    db.from("snapquote_price_book_items")
      .select("usage_count")
      .eq("id", line.price_book_item_id)
      .eq("org_id", orgId)
      .is("archived_at", null)
  ) as { usage_count: number };
  const item = await single(
    db.from("snapquote_price_book_items")
      .update({
        confirmed_at: now,
        usage_count: existingItem.usage_count + 1,
        updated_at: now
      })
      .eq("id", line.price_book_item_id)
      .eq("org_id", orgId)
      .is("archived_at", null)
      .select("*")
  );
  must(await db.from("snapquote_quote_line_items").update({ match_state: "green", match_confidence: 1 }).eq("id", lineId));
  await recomputeQuoteTotals(db, orgId, quoteId);

  return {
    item: priceBookItemFromRow(item as PriceBookRow),
    quote: await getQuoteResponse(db, orgId, quoteId)
  };
}

async function saveLineToPriceBook(db: SupabaseClient, request: Request, quoteId: string, lineId: string) {
  const orgId = orgIdFromRequest(request);
  const line = await single(db.from("snapquote_quote_line_items").select("*").eq("id", lineId).eq("quote_id", quoteId)) as LineRow;

  if (line.unit_price_cents === null) {
    throw new HttpError(409, "Line must have a unit price before it can be saved to the price book");
  }

  const key = priceBookKeyFromLine(line);
  const now = new Date().toISOString();
  const existingItem = await maybeSingle(
    db.from("snapquote_price_book_items")
      .select("*")
      .eq("org_id", orgId)
      .eq("key", key)
      .limit(1)
  ) as PriceBookRow | null;
  const itemPatch = {
    name: priceBookNameFromLineDescription(line.description),
    description: line.description,
    unit: line.unit ?? "flat",
    kind: line.kind,
    starter: false,
    confirmed_at: now,
    usage_count: existingItem ? existingItem.usage_count + 1 : 1,
    updated_at: now,
    archived_at: null,
    ...pricingColumns({ type: "fixed", unitPriceCents: line.unit_price_cents })
  };
  const item = existingItem
    ? await single(
        db.from("snapquote_price_book_items")
          .update(itemPatch)
          .eq("id", existingItem.id)
          .eq("org_id", orgId)
          .select("*")
      )
    : await single(db.from("snapquote_price_book_items").insert({
        org_id: orgId,
        key,
        ...itemPatch
      }).select("*"));

  must(await db.from("snapquote_quote_line_items").update({
    source: "price_book",
    price_book_item_id: item.id,
    price_book_item_key: item.key,
    match_confidence: 1,
    match_state: "green"
  }).eq("id", lineId));
  await recomputeQuoteTotals(db, orgId, quoteId);

  return {
    item: priceBookItemFromRow(item as PriceBookRow),
    quote: await getQuoteResponse(db, orgId, quoteId)
  };
}

async function sendQuote(db: SupabaseClient, request: Request, quoteId: string) {
  const input = parse(sendSchema, await request.json().catch(() => ({})));
  const orgId = orgIdFromRequest(request);
  const quote = await single(db.from("snapquote_quotes").select("*").eq("id", quoteId).eq("org_id", orgId)) as QuoteRow;
  const customer = await single(db.from("snapquote_customers").select("*").eq("id", quote.customer_id));
  const lineItems = await listLines(db, quoteId);

  if (quote.status !== "draft") {
    throw new HttpError(409, "Only draft quotes can be sent");
  }

  if (input.channels.includes("email") && !stringOrNull(customer.email)) {
    throw new HttpError(409, "Customer email is required before sending");
  }

  if (input.channels.includes("sms") && !stringOrNull(customer.phone)) {
    throw new HttpError(409, "Customer phone is required before texting");
  }

  assertQuoteCanSend(lineItems);
  await assertOrgCanSendQuote(db, orgId);

  const totals = computeTotalsIfReady({
    lineItems,
    discount: toDiscount(quote.discount_type, quote.discount_value),
    taxRate: Number(quote.tax_rate)
  });
  must(await db.from("snapquote_quotes").update(totalsColumns(totals)).eq("id", quoteId).eq("org_id", orgId));

  const delivery = await deliverQuoteNotification("quote_sent", await getQuoteResponse(db, orgId, quoteId), input.channels);
  const now = new Date().toISOString();
  must(await db.from("snapquote_quotes").update({ sent_at: now, status: "sent" }).eq("id", quoteId).eq("org_id", orgId));
  const response = await getQuoteResponse(db, orgId, quoteId);
  await createEvent(db, quoteId, "sent", { channel: input.channels.length === 1 ? input.channels[0] : "multi", channels: input.channels, ...delivery });

  return response;
}

async function resendQuote(db: SupabaseClient, request: Request, quoteId: string) {
  const input = parse(sendSchema, await request.json().catch(() => ({})));
  const orgId = orgIdFromRequest(request);
  const quote = await single(db.from("snapquote_quotes").select("*").eq("id", quoteId).eq("org_id", orgId)) as QuoteRow;
  const customer = await single(db.from("snapquote_customers").select("*").eq("id", quote.customer_id));

  if (quote.status !== "sent" && quote.status !== "viewed") {
    throw new HttpError(409, "Only sent quotes awaiting a response can be resent");
  }

  if (input.channels.includes("email") && !stringOrNull(customer.email)) {
    throw new HttpError(409, "Customer email is required before resending");
  }

  if (input.channels.includes("sms") && !stringOrNull(customer.phone)) {
    throw new HttpError(409, "Customer phone is required before texting a quote link");
  }

  const response = await getQuoteResponse(db, orgId, quoteId);
  const delivery = await deliverQuoteNotification("quote_sent", response, input.channels);
  const now = new Date().toISOString();
  must(await db.from("snapquote_quotes").update({ updated_at: now }).eq("id", quoteId).eq("org_id", orgId));
  await createEvent(db, quoteId, "sent", { channel: input.channels.length === 1 ? input.channels[0] : "multi", channels: input.channels, resend: true, ...delivery });

  return await getQuoteResponse(db, orgId, quoteId);
}

async function followUpQuote(db: SupabaseClient, request: Request, quoteId: string) {
  const input = parse(sendSchema, await request.json().catch(() => ({})));
  const orgId = orgIdFromRequest(request);
  const quote = await single(db.from("snapquote_quotes").select("*").eq("id", quoteId).eq("org_id", orgId)) as QuoteRow;
  const customer = await single(db.from("snapquote_customers").select("*").eq("id", quote.customer_id));

  if (quote.status !== "sent" && quote.status !== "viewed") {
    throw new HttpError(409, "Only sent quotes awaiting a response can be followed up");
  }

  if (input.channels.includes("email") && !stringOrNull(customer.email)) {
    throw new HttpError(409, "Customer email is required before following up");
  }

  if (input.channels.includes("sms") && !stringOrNull(customer.phone)) {
    throw new HttpError(409, "Customer phone is required before texting a follow-up");
  }

  if (!isQuoteStale({ sentAt: quote.sent_at, firstViewedAt: quote.first_viewed_at, respondedAt: quote.responded_at, now: new Date() })) {
    throw new HttpError(409, "Quote is not stale yet");
  }

  const response = await getQuoteResponse(db, orgId, quoteId);
  const delivery = await deliverQuoteNotification("quote_follow_up", response, input.channels);
  await createEvent(db, quoteId, "followed_up", { channel: input.channels.length === 1 ? input.channels[0] : "multi", channels: input.channels, ...delivery });

  return response;
}

async function deleteDraftQuote(db: SupabaseClient, request: Request, quoteId: string) {
  const orgId = orgIdFromRequest(request);
  const quote = await single(db.from("snapquote_quotes").select("*").eq("id", quoteId).eq("org_id", orgId)) as QuoteRow;

  if (quote.status !== "draft") {
    throw new HttpError(409, "Only draft quotes can be deleted");
  }

  must(await db.from("snapquote_quotes").delete().eq("id", quoteId).eq("org_id", orgId));

  return { id: quoteId, deleted: true };
}

async function archiveQuote(db: SupabaseClient, request: Request, quoteId: string) {
  const orgId = orgIdFromRequest(request);
  const quote = await single(db.from("snapquote_quotes").select("*").eq("id", quoteId).eq("org_id", orgId)) as QuoteRow;

  if (quote.status === "draft") {
    throw new HttpError(409, "Draft quotes should be deleted, not archived");
  }

  if (quote.archived_at) {
    return { id: quoteId, archived: true, archivedAt: quote.archived_at };
  }

  const archivedAt = new Date().toISOString();
  must(await db.from("snapquote_quotes").update({ archived_at: archivedAt }).eq("id", quoteId).eq("org_id", orgId));
  await createEvent(db, quoteId, "archived");

  return { id: quoteId, archived: true, archivedAt };
}

async function duplicateQuote(db: SupabaseClient, request: Request, quoteId: string) {
  const orgId = orgIdFromRequest(request);
  const cloned = await cloneQuoteAsDraft(db, orgId, quoteId);

  return cloned;
}

async function reviseQuote(db: SupabaseClient, request: Request, quoteId: string) {
  const orgId = orgIdFromRequest(request);
  const cloned = await cloneQuoteAsDraft(db, orgId, quoteId);
  const now = new Date().toISOString();

  must(await db.from("snapquote_quotes").update({
    superseded_by_quote_id: cloned.id,
    status: "superseded"
  }).eq("id", quoteId).eq("org_id", orgId));
  await createEvent(db, quoteId, "superseded", { supersededByQuoteId: cloned.id });

  return {
    quote: cloned,
    supersededQuote: await getQuoteResponse(db, orgId, quoteId),
    revisedAt: now
  };
}

async function cloneQuoteAsDraft(db: SupabaseClient, orgId: string, quoteId: string) {
  const source = await single(db.from("snapquote_quotes").select("*").eq("id", quoteId).eq("org_id", orgId)) as QuoteRow;
  const org = await single(db.from("snapquote_orgs").select("*").eq("id", orgId));
  const lineItems = await listLines(db, quoteId);
  const discount = toDiscount(source.discount_type, source.discount_value);
  const taxRate = Number(source.tax_rate);
  const totals = computeTotalsIfReady({ lineItems, discount, taxRate });
  const cloned = await single(db.from("snapquote_quotes").insert({
    org_id: orgId,
    customer_id: source.customer_id,
    address: source.address,
    work_type: source.work_type,
    job_title: source.job_title,
    status: "draft",
    valid_until: addDays(new Date(), Number(org.quote_valid_days)),
    discount_type: discount.type,
    discount_value: discount.value,
    tax_rate: taxRate,
    notes: source.notes,
    terms: source.terms,
    scope_summary: source.scope_summary,
    scope_notes: source.scope_notes,
    conflicts: source.conflicts,
    checklist: source.checklist,
    transcript: source.transcript,
    audio_storage_path: source.audio_storage_path ?? null,
    audio_content_type: source.audio_content_type ?? null,
    audio_duration_seconds: source.audio_duration_seconds ?? null,
    payment_status: "not_requested",
    deposit_percent: Number(source.deposit_percent ?? org.default_deposit_percent ?? 50),
    deposit_amount_cents: null,
    paid_amount_cents: 0,
    payment_currency: String(source.payment_currency ?? org.payment_currency ?? "cad").toLowerCase(),
    paid_at: null,
    stripe_checkout_session_id: null,
    stripe_payment_intent_id: null,
    sent_at: null,
    first_viewed_at: null,
    responded_at: null,
    superseded_by_quote_id: null,
    ...totalsColumns(totals)
  }).select("*")) as QuoteRow;

  if (lineItems.length > 0) {
    must(await db.from("snapquote_quote_line_items").insert(
      lineItems.map((line, index) => lineInsert(cloned.id, { ...line, id: undefined, position: index }))
    ));
  }

  must(await db.from("snapquote_quote_public_links").insert({ quote_id: cloned.id, token: publicToken() }));
  await createEvent(db, cloned.id, "created", { sourceQuoteId: quoteId });

  return getQuoteResponse(db, orgId, cloned.id);
}

async function viewPublicQuote(db: SupabaseClient, token: string) {
  const link = await single(db.from("snapquote_quote_public_links").select("*").eq("token", token).is("revoked_at", null));
  const quote = await single(db.from("snapquote_quotes").select("*").eq("id", link.quote_id)) as QuoteRow;

  if (!quote.first_viewed_at) {
    const now = new Date().toISOString();
    must(await db.from("snapquote_quotes").update({ first_viewed_at: now }).eq("id", quote.id));
    must(await db.from("snapquote_quote_public_links").update({ viewed_at: now }).eq("id", link.id));
    await createEvent(db, quote.id, "viewed");
  }

  return publicQuoteResponse(await getQuoteResponse(db, quote.org_id, quote.id));
}

async function respondToPublicQuote(db: SupabaseClient, request: Request, token: string) {
  const input = parse(z.object({ action: z.enum(["accept", "decline"]) }), await request.json());
  const link = await single(db.from("snapquote_quote_public_links").select("*").eq("token", token).is("revoked_at", null));
  const quote = await single(db.from("snapquote_quotes").select("*").eq("id", link.quote_id)) as QuoteRow;

  if (quote.responded_at) {
    throw new HttpError(409, "Quote has already been responded to");
  }

  if (input.action === "accept" && new Date() > new Date(`${quote.valid_until}T23:59:59.999Z`)) {
    throw new HttpError(409, "Expired quotes cannot be accepted");
  }

  const now = new Date().toISOString();
  must(await db.from("snapquote_quotes").update({
    responded_at: now,
    status: input.action === "accept" ? "accepted" : "declined"
  }).eq("id", quote.id));
  await createEvent(db, quote.id, input.action === "accept" ? "accepted" : "declined");

  return publicQuoteResponse(await getQuoteResponse(db, quote.org_id, quote.id));
}

async function getPaymentConnectStatus(db: SupabaseClient, request: Request) {
  const orgId = orgIdFromRequest(request);
  const org = await refreshStripeAccountStatus(db, orgId);

  return {
    provider: "stripe",
    accountId: org.stripe_account_id ?? null,
    chargesEnabled: Boolean(org.stripe_charges_enabled),
    payoutsEnabled: Boolean(org.stripe_payouts_enabled),
    connected: Boolean(org.stripe_account_id && org.stripe_charges_enabled && org.stripe_payouts_enabled),
    currency: org.payment_currency ?? "cad",
    defaultDepositPercent: Number(org.default_deposit_percent ?? 50)
  };
}

async function createPaymentConnectOnboarding(db: SupabaseClient, request: Request) {
  const orgId = orgIdFromRequest(request);
  const org = await single(db.from("snapquote_orgs").select("*").eq("id", orgId));
  const member = await single(db.from("snapquote_org_members").select("*").eq("org_id", orgId).limit(1));
  let accountId = typeof org.stripe_account_id === "string" ? org.stripe_account_id : "";

  if (!accountId) {
    const account = await stripePost("accounts", {
      type: "express",
      country: Deno.env.get("STRIPE_CONNECT_COUNTRY") ?? "CA",
      email: String(member.email),
      "capabilities[card_payments][requested]": "true",
      "capabilities[transfers][requested]": "true",
      "business_profile[name]": String(org.name ?? "QuoteVan provider")
    });
    accountId = String(account.id);
    must(await db.from("snapquote_orgs").update({ stripe_account_id: accountId }).eq("id", orgId));
  }

  const returnUrl = stripeConnectUrl(
    envFirst("QUOTEVAN_CONNECT_RETURN_URL", "SNAPQUOTE_CONNECT_RETURN_URL"),
    "/payment/connect/return"
  );
  const refreshUrl = stripeConnectUrl(
    envFirst("QUOTEVAN_CONNECT_REFRESH_URL", "SNAPQUOTE_CONNECT_REFRESH_URL"),
    "/payment/connect/refresh"
  );
  const link = await stripePost("account_links", {
    account: accountId,
    type: "account_onboarding",
    return_url: returnUrl,
    refresh_url: refreshUrl
  });

  return {
    provider: "stripe",
    accountId,
    url: link.url
  };
}

async function createPublicQuotePayment(db: SupabaseClient, token: string) {
  const link = await single(db.from("snapquote_quote_public_links").select("*").eq("token", token).is("revoked_at", null));
  const quote = await single(db.from("snapquote_quotes").select("*").eq("id", link.quote_id)) as QuoteRow;
  const org = await refreshStripeAccountStatus(db, quote.org_id);
  const customer = await single(db.from("snapquote_customers").select("*").eq("id", quote.customer_id));

  if (!quote.total_cents || quote.total_cents <= 0) {
    throw new HttpError(409, "This quote is not ready for payment");
  }

  if (quote.status === "declined" || quote.status === "expired" || quote.status === "superseded") {
    throw new HttpError(409, "This quote is not payable");
  }

  if (new Date() > new Date(`${quote.valid_until}T23:59:59.999Z`)) {
    throw new HttpError(409, "Expired quotes cannot be paid");
  }

  const connectedAccountId = typeof org.stripe_account_id === "string" ? org.stripe_account_id : "";

  if (!connectedAccountId || !org.stripe_charges_enabled || !org.stripe_payouts_enabled) {
    throw new HttpError(409, "This provider has not enabled online deposits yet");
  }

  const depositPercent = Number(quote.deposit_percent ?? org.default_deposit_percent ?? 50);
  const amountCents = quote.deposit_amount_cents ?? Math.max(100, Math.round(Number(quote.total_cents) * (depositPercent / 100)));
  const currency = String(quote.payment_currency ?? org.payment_currency ?? "cad").toLowerCase();
  const publicUrl = publicQuoteUrl(token);

  if (!/^https?:\/\//i.test(publicUrl)) {
    throw new HttpError(500, "Public quote host is not configured");
  }

  const successUrl = `${publicUrl}${publicUrl.includes("?") ? "&" : "?"}payment=success&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${publicUrl}${publicUrl.includes("?") ? "&" : "?"}payment=cancelled`;

  const session = await stripePost("checkout/sessions", {
    mode: "payment",
    "payment_method_types[0]": "card",
    success_url: successUrl,
    cancel_url: cancelUrl,
    customer_email: customer.email ? String(customer.email) : undefined,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": currency,
    "line_items[0][price_data][unit_amount]": String(amountCents),
    "line_items[0][price_data][product_data][name]": `Deposit for quote #${quote.id.slice(0, 4).toUpperCase()}`,
    "line_items[0][price_data][product_data][description]": `${Math.round(depositPercent)}% deposit for ${String(org.name ?? "your service provider")}`,
    "metadata[quote_id]": quote.id,
    "metadata[public_token]": token,
    "metadata[kind]": "quote_deposit",
    "payment_intent_data[metadata][quote_id]": quote.id,
    "payment_intent_data[metadata][public_token]": token
  }, { stripeAccount: connectedAccountId });

  must(await db.from("snapquote_quote_payments").upsert({
    quote_id: quote.id,
    provider: "stripe",
    provider_account_id: connectedAccountId,
    provider_checkout_session_id: session.id,
    provider_payment_intent_id: session.payment_intent ?? null,
    amount_cents: amountCents,
    currency,
    status: "checkout_created",
    checkout_url: session.url ?? null,
    expires_at: session.expires_at ? new Date(Number(session.expires_at) * 1000).toISOString() : null,
    raw_event: { created_from: "public_quote" }
  }, { onConflict: "provider_checkout_session_id" }));

  must(await db.from("snapquote_quotes").update({
    payment_status: "checkout_created",
    deposit_amount_cents: amountCents,
    deposit_percent: depositPercent,
    payment_currency: currency,
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id: session.payment_intent ?? null
  }).eq("id", quote.id));
  await createEvent(db, quote.id, "payment_started", { provider: "stripe", sessionId: session.id, amountCents, currency });

  return {
    provider: "stripe",
    checkoutUrl: session.url,
    sessionId: session.id,
    amountCents,
    currency
  };
}

async function confirmPublicQuotePayment(db: SupabaseClient, request: Request, token: string) {
  const input = parse(publicPaymentConfirmSchema, await request.json());
  const link = await single(db.from("snapquote_quote_public_links").select("*").eq("token", token).is("revoked_at", null));
  const quote = await single(db.from("snapquote_quotes").select("*").eq("id", link.quote_id)) as QuoteRow;
  const org = await single(db.from("snapquote_orgs").select("*").eq("id", quote.org_id));
  const connectedAccountId = typeof org.stripe_account_id === "string" ? org.stripe_account_id : "";
  const session = await stripeGet(`checkout/sessions/${encodeURIComponent(input.sessionId)}`, { stripeAccount: connectedAccountId || undefined });

  if (String(session.metadata?.quote_id ?? "") !== quote.id) {
    throw new HttpError(403, "Payment session does not match this quote");
  }

  if (session.payment_status === "paid" || session.status === "complete") {
    await markQuotePaymentPaid(db, quote, {
      sessionId: String(session.id),
      paymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
      amountCents: Number(session.amount_total ?? quote.deposit_amount_cents ?? 0),
      currency: String(session.currency ?? quote.payment_currency ?? "cad"),
      rawEvent: { confirmed_from: "public_return", session }
    });
  }

  return publicQuoteResponse(await getQuoteResponse(db, quote.org_id, quote.id));
}

async function handleStripeWebhook(db: SupabaseClient, request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (secret) {
    await verifyStripeSignature(body, signature, secret);
  }

  const event = JSON.parse(body) as Record<string, any>;
  const object = event.data?.object as Record<string, any> | undefined;

  if (!object || object.object !== "checkout.session") {
    return { received: true };
  }

  const quoteId = String(object.metadata?.quote_id ?? "");

  if (!quoteId) {
    return { received: true };
  }

  const quote = await single(db.from("snapquote_quotes").select("*").eq("id", quoteId)) as QuoteRow;

  if (event.type === "checkout.session.completed" || object.payment_status === "paid") {
    await markQuotePaymentPaid(db, quote, {
      sessionId: String(object.id),
      paymentIntentId: typeof object.payment_intent === "string" ? object.payment_intent : null,
      amountCents: Number(object.amount_total ?? quote.deposit_amount_cents ?? 0),
      currency: String(object.currency ?? quote.payment_currency ?? "cad"),
      rawEvent: event
    });
  } else if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
    await markQuotePaymentFailed(db, quote, String(object.id), event);
  }

  return { received: true };
}

async function handleInboundEmailReply(db: SupabaseClient, request: Request) {
  assertInboundEmailWebhookSecret(request);
  const input = parse(inboundEmailSchema, await request.json());
  const token = input.publicToken ?? input.quoteToken ?? extractPublicQuoteToken(input.text, input.html);

  if (!token) {
    throw new HttpError(400, "A quote token or quote link is required");
  }

  const link = await single(
    db.from("snapquote_quote_public_links")
      .select("*")
      .eq("token", token)
      .is("revoked_at", null)
  );
  const quoteId = String(link.quote_id);
  const message = emailPreview(input.text ?? stripHtml(input.html ?? ""));

  await createEvent(db, quoteId, "customer_replied", {
    from: input.fromEmail ?? input.from ?? null,
    subject: input.subject ?? null,
    receivedAt: input.receivedAt ?? new Date().toISOString(),
    preview: message || null,
    publicToken: token
  });

  return { ok: true, quoteId };
}

async function markQuotePaymentPaid(db: SupabaseClient, quote: QuoteRow, input: {
  sessionId: string;
  paymentIntentId: string | null;
  amountCents: number;
  currency: string;
  rawEvent: Record<string, unknown>;
}) {
  const now = new Date().toISOString();
  const paidAmountCents = input.amountCents > 0 ? input.amountCents : quote.deposit_amount_cents ?? 0;
  const paymentPatch: Record<string, unknown> = {
    status: "paid",
    provider_payment_intent_id: input.paymentIntentId,
    currency: input.currency.toLowerCase(),
    paid_at: now,
    raw_event: input.rawEvent
  };

  if (paidAmountCents > 0) {
    paymentPatch.amount_cents = paidAmountCents;
  }

  must(await db.from("snapquote_quote_payments").update(paymentPatch).eq("provider_checkout_session_id", input.sessionId));

  const patch: Record<string, unknown> = {
    payment_status: "paid",
    paid_amount_cents: paidAmountCents,
    paid_at: now,
    stripe_checkout_session_id: input.sessionId,
    stripe_payment_intent_id: input.paymentIntentId,
    status: quote.status === "declined" || quote.status === "superseded" ? quote.status : "accepted"
  };

  if (!quote.responded_at) {
    patch.responded_at = now;
  }

  must(await db.from("snapquote_quotes").update(patch).eq("id", quote.id));
  await createEvent(db, quote.id, "payment_paid", {
    provider: "stripe",
    sessionId: input.sessionId,
    paymentIntentId: input.paymentIntentId,
    amountCents: paidAmountCents,
    currency: input.currency.toLowerCase()
  });

  if (!quote.responded_at && quote.status !== "accepted") {
    await createEvent(db, quote.id, "accepted", { source: "payment" });
  }
}

async function markQuotePaymentFailed(db: SupabaseClient, quote: QuoteRow, sessionId: string, rawEvent: Record<string, unknown>) {
  must(await db.from("snapquote_quote_payments").update({
    status: "failed",
    raw_event: rawEvent
  }).eq("provider_checkout_session_id", sessionId));
  must(await db.from("snapquote_quotes").update({ payment_status: "failed" }).eq("id", quote.id));
  await createEvent(db, quote.id, "payment_failed", { provider: "stripe", sessionId });
}

async function refreshStripeAccountStatus(db: SupabaseClient, orgId: string) {
  const org = await single(db.from("snapquote_orgs").select("*").eq("id", orgId));
  const accountId = typeof org.stripe_account_id === "string" ? org.stripe_account_id : "";

  if (!accountId || !Deno.env.get("STRIPE_SECRET_KEY")) {
    return org;
  }

  const account = await stripeGet(`accounts/${encodeURIComponent(accountId)}`);
  const chargesEnabled = Boolean(account.charges_enabled);
  const payoutsEnabled = Boolean(account.payouts_enabled);

  if (chargesEnabled !== Boolean(org.stripe_charges_enabled) || payoutsEnabled !== Boolean(org.stripe_payouts_enabled)) {
    const updated = await single(db.from("snapquote_orgs").update({
      stripe_charges_enabled: chargesEnabled,
      stripe_payouts_enabled: payoutsEnabled
    }).eq("id", orgId).select("*"));
    return updated;
  }

  return org;
}

function publicQuoteResponse<T extends {
  audioStoragePath: string | null;
  audioContentType: string | null;
  audioDurationSeconds: number | null;
}>(quote: T): T {
  return {
    ...quote,
    audioStoragePath: null,
    audioContentType: null,
    audioDurationSeconds: null
  };
}

async function createCustomerFromInput(db: SupabaseClient, orgId: string, input: z.infer<typeof customerSchema>) {
  return await insertCustomerFromInput(db, orgId, input);
}

async function upsertCustomerFromInput(db: SupabaseClient, orgId: string, input: z.infer<typeof customerSchema>) {
  const existing = await findExistingCustomer(db, orgId, input);

  if (existing !== null) {
    // Reuse the matched customer's identity as-is. Do not overwrite name/email/phone/address
    // here -- this runs implicitly on every quote creation, and a matching email/phone (e.g.
    // reused test contact info, or two customers sharing a number) must never silently rename
    // an existing customer and every quote already tied to them. Explicit edits go through
    // updateCustomer (PATCH /v1/customers/:id) instead.
    return existing;
  }

  return await insertCustomerFromInput(db, orgId, input);
}

async function insertCustomerFromInput(db: SupabaseClient, orgId: string, input: z.infer<typeof customerSchema>) {
  return await single(db.from("snapquote_customers").insert({
    org_id: orgId,
    name: input.name,
    email: normalizedEmail(input.email),
    phone: input.phone ?? null,
    address: input.address,
    city: input.city ?? deriveCustomerCity(input.address)
  }).select("*"));
}

async function findExistingCustomer(db: SupabaseClient, orgId: string, input: Pick<z.infer<typeof customerSchema>, "email" | "phone">) {
  const email = normalizedEmail(input.email);

  if (email !== null) {
    const { data, error } = await db.from("snapquote_customers").select("*").eq("org_id", orgId).ilike("email", email).limit(1);

    if (error) {
      throw error;
    }

    if (data.length > 0) {
      return data[0] as Record<string, unknown>;
    }
  }

  if (input.phone !== undefined && input.phone !== null) {
    const { data, error } = await db.from("snapquote_customers").select("*").eq("org_id", orgId).eq("phone", input.phone).limit(1);

    if (error) {
      throw error;
    }

    if (data.length > 0) {
      return data[0] as Record<string, unknown>;
    }
  }

  return null;
}

async function assertCustomerContactAvailable(
  db: SupabaseClient,
  orgId: string,
  input: Pick<z.infer<typeof customerPatchSchema>, "email" | "phone">,
  customerId: string
) {
  const existing = await findExistingCustomer(db, orgId, input);

  if (existing !== null && String(existing.id) !== customerId) {
    throw new HttpError(409, "Another customer already uses that contact detail.");
  }
}

async function countCustomerQuotes(db: SupabaseClient, orgId: string, customerId: string) {
  const { count, error } = await db
    .from("snapquote_quotes")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("customer_id", customerId);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

async function listLines(db: SupabaseClient, quoteId: string): Promise<(QuoteLineItem & { id: string })[]> {
  const { data, error } = await db.from("snapquote_quote_line_items").select("*").eq("quote_id", quoteId).order("position", { ascending: true });

  if (error) {
    throw error;
  }

  return (data as LineRow[]).map(quoteLineFromRow);
}

async function recomputeQuoteTotals(db: SupabaseClient, orgId: string, quoteId: string) {
  const quote = await single(db.from("snapquote_quotes").select("*").eq("id", quoteId).eq("org_id", orgId)) as QuoteRow;
  const lineItems = await listLines(db, quoteId);
  const totals = computeTotalsIfReady({
    lineItems,
    discount: toDiscount(quote.discount_type, quote.discount_value),
    taxRate: Number(quote.tax_rate)
  });
  must(await db.from("snapquote_quotes").update(totalsColumns(totals)).eq("id", quoteId).eq("org_id", orgId));
}

async function refreshStatuses(db: SupabaseClient, orgId: string) {
  const { data: quotes, error } = await db.from("snapquote_quotes").select("*").eq("org_id", orgId);

  if (error) {
    throw error;
  }

  for (const quote of quotes as QuoteRow[]) {
    const { data: events, error: eventsError } = await db.from("snapquote_quote_events").select("*").eq("quote_id", quote.id);

    if (eventsError) {
      throw eventsError;
    }

    const status = deriveQuoteStatus({
      events: (events as { type: QuoteEvent["type"]; created_at: string }[]).map((event) => ({
        type: event.type,
        createdAt: event.created_at
      })),
      validUntil: quote.valid_until,
      now: new Date(),
      supersededByQuoteId: quote.superseded_by_quote_id
    });

    if (status !== quote.status) {
      must(await db.from("snapquote_quotes").update({ status }).eq("id", quote.id));
    }
  }
}

async function createEvent(db: SupabaseClient, quoteId: string, type: QuoteEvent["type"], meta: Record<string, unknown> = {}) {
  must(await db.from("snapquote_quote_events").insert({ quote_id: quoteId, type, meta }));
}

type QuoteNotificationKind = "quote_sent" | "quote_follow_up";
type QuoteDeliveryChannel = "email" | "sms";

async function deliverQuoteNotification(kind: QuoteNotificationKind, quote: Record<string, any>, channels: QuoteDeliveryChannel[] = ["email"]) {
  const results: Record<string, unknown> = {};
  const publicUrl = typeof quote.publicUrl === "string" ? quote.publicUrl : publicQuoteUrl(String(quote.publicToken));

  if (channels.includes("email")) {
    results.email = await deliverQuoteEmail(kind, quote, publicUrl);
  }

  if (channels.includes("sms")) {
    results.sms = await deliverQuoteSms(kind, quote, publicUrl);
  }

  return { delivery: channels.length === 1 ? channels[0] : "multi", provider: "quotevan", channels, publicUrl, ...results };
}

async function deliverQuoteEmail(kind: QuoteNotificationKind, quote: Record<string, any>, publicUrl: string) {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const webhookUrl = envFirst("QUOTE_EMAIL_WEBHOOK_URL", "SNAPQUOTE_EMAIL_WEBHOOK_URL");
  const payload = {
    kind,
    quoteId: quote.id,
    publicToken: quote.publicToken,
    publicUrl,
    customer: quote.customer,
    address: quote.address,
    jobTitle: quote.jobTitle,
    totals: quote.totals,
    validUntil: quote.validUntil
  };

  if (resendKey) {
    const from = envFirst("QUOTE_EMAIL_FROM", "SNAPQUOTE_EMAIL_FROM", "SNAPQUOTE_FROM_EMAIL");

    if (!from) {
      throw new HttpError(500, "Quote email sender is not configured");
    }

    if (!publicUrl.startsWith("http://") && !publicUrl.startsWith("https://")) {
      throw new HttpError(500, "Public quote host is not configured");
    }

    const email = quoteEmail(kind, quote, publicUrl);
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${resendKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        from,
        to: [quote.customer.email],
        reply_to: envFirst("QUOTE_REPLY_TO_EMAIL", "SNAPQUOTE_REPLY_TO_EMAIL") ?? undefined,
        subject: email.subject,
        html: email.html,
        text: email.text
      })
    });

    if (!response.ok) {
      console.warn("QuoteVan Resend delivery failed", response.status, await response.text());
      throw new HttpError(502, "Quote email could not be sent");
    }

    const body = await response.json().catch(() => ({})) as { id?: string };
    return { delivery: "resend", provider: "resend", messageId: body.id ?? null, publicUrl };
  }

  if (!webhookUrl) {
    return { delivery: "simulated", publicUrl };
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new HttpError(response.status, `Email webhook failed: ${await response.text()}`);
  }

  return { delivery: "webhook", publicUrl };
}

async function deliverQuoteSms(kind: QuoteNotificationKind, quote: Record<string, any>, publicUrl: string) {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const from = envFirst("TWILIO_FROM_PHONE", "SNAPQUOTE_FROM_PHONE");
  const to = String(quote.customer?.phone ?? "").trim();

  if (!to) {
    throw new HttpError(409, "Customer phone is required before texting");
  }

  if (!accountSid || !authToken || !from) {
    throw new HttpError(500, "Text messaging is not configured");
  }

  if (!publicUrl.startsWith("http://") && !publicUrl.startsWith("https://")) {
    throw new HttpError(500, "Public quote host is not configured");
  }

  const orgName = String(quote.org?.name ?? "QuoteVan");
  const total = formatEmailMoney(quote.totals?.totalCents ?? null);
  const lead = kind === "quote_sent"
    ? `${orgName} sent your quote for ${total}:`
    : `${orgName} is following up on your quote for ${total}:`;
  const params = new URLSearchParams({
    From: from,
    To: to,
    Body: `${lead} ${publicUrl}`
  });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`, {
    method: "POST",
    headers: {
      authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      "content-type": "application/x-www-form-urlencoded"
    },
    body: params
  });

  if (!response.ok) {
    console.warn("QuoteVan SMS delivery failed", response.status, await response.text());
    throw new HttpError(502, "Quote text could not be sent");
  }

  const body = await response.json().catch(() => ({})) as { sid?: string };
  return { delivery: "twilio", provider: "twilio", messageId: body.sid ?? null, publicUrl };
}

function publicQuoteUrl(token: string) {
  const baseUrl = envFirst("QUOTEVAN_PUBLIC_BASE_URL", "SNAPQUOTE_PUBLIC_BASE_URL");

  if (!baseUrl) {
    return `/q/${token}`;
  }

  return `${baseUrl.replace(/\/$/, "")}/q/${token}`;
}

function stripeConnectUrl(configuredUrl: string | undefined, fallbackPath: string) {
  const url = configuredUrl ?? webBaseUrl(fallbackPath);

  if (!url.startsWith("https://") && !url.startsWith("http://")) {
    throw new HttpError(500, "Stripe Connect return URLs must be normal web URLs");
  }

  return url;
}

function webBaseUrl(path: string) {
  const baseUrl = envFirst("QUOTEVAN_PUBLIC_BASE_URL", "SNAPQUOTE_PUBLIC_BASE_URL");

  if (!baseUrl) {
    throw new HttpError(500, "Public QuoteVan URL is required before opening payment setup");
  }

  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

function quoteEmail(kind: QuoteNotificationKind, quote: Record<string, any>, publicUrl: string) {
  const orgName = String(quote.org?.name ?? "QuoteVan");
  const customerName = String(quote.customer?.name ?? "there");
  const total = formatEmailMoney(quote.totals?.totalCents ?? null);
  const validUntil = formatEmailDate(String(quote.validUntil));
  const subject = kind === "quote_sent"
    ? `Quote from ${orgName}`
    : `Reminder: quote from ${orgName}`;
  const intro = kind === "quote_sent"
    ? `${orgName} sent you a quote for ${total}.`
    : `${orgName} is following up on your quote for ${total}.`;
  const lines = Array.isArray(quote.lineItems) ? quote.lineItems : [];
  const lineText = lines
    .map((line: Record<string, any>) => `- ${line.description}: ${formatEmailMoney(line.unitPriceCents === null ? null : Math.round(Number(line.quantity) * Number(line.unitPriceCents)))}`)
    .join("\n");
  const lineRows = lines
    .map((line: Record<string, any>) => {
      const amount = line.unitPriceCents === null ? null : Math.round(Number(line.quantity) * Number(line.unitPriceCents));
      return `<tr>
        <td style="padding:13px 22px;border-top:1px solid #eee9df;vertical-align:top;color:#1d1c19;line-height:1.35">
          <strong style="display:block;font-size:14px;line-height:1.25;font-weight:800;word-break:break-word">${escapeHtml(String(line.description))}</strong>
          <span style="display:block;margin-top:3px;color:#6f6a61;font-size:13px;line-height:1.25">${escapeHtml(describeEmailQuantity(Number(line.quantity), line.unit ?? null))}</span>
        </td>
        <td style="padding:13px 22px 13px 10px;border-top:1px solid #eee9df;vertical-align:top;text-align:right;white-space:nowrap;color:#1d1c19;font-weight:800;font-size:14px">${escapeHtml(formatEmailMoney(amount))}</td>
      </tr>`;
    })
    .join("");
  const subtotal = formatEmailMoney(quote.totals?.subtotalCents ?? null);
  const tax = formatEmailMoney(quote.totals?.taxCents ?? null);
  const discount = quote.totals && Number(quote.totals.discountCents) > 0 ? formatEmailMoney(Number(quote.totals.discountCents)) : null;
  const taxLabel = `Tax (${Math.round(Number(quote.taxRate ?? 0) * 100)}%)`;
  const text = [
    `Hi ${customerName},`,
    "",
    intro,
    `Valid until ${validUntil}.`,
    "",
    quote.scopeSummary ? String(quote.scopeSummary) : "",
    "",
    lineText,
    "",
    `View, accept, or decline the quote: ${publicUrl}`,
    "",
    "No account is needed."
  ].filter((line) => line !== "").join("\n");
  const html = `
    <div style="margin:0;background:#ebe9e3;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#1d1c19">
      <div style="max-width:560px;margin:0 auto;background:#fffdfa;border:1px solid #ded9cd;border-radius:16px;overflow:hidden;box-shadow:0 12px 34px rgba(29,28,25,.08)">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">
          <tr>
            <td style="padding:24px 24px 16px">
              <p style="margin:0 0 10px;color:#8d887f;font-size:11px;font-weight:800;letter-spacing:.13em;text-transform:uppercase">Quote from</p>
              <h1 style="margin:0 0 8px;color:#1d1c19;font-size:24px;line-height:1.1;font-weight:850">${escapeHtml(orgName)}</h1>
              <p style="margin:0;color:#646058;font-size:14px;line-height:1.45">Hi ${escapeHtml(customerName)}, ${escapeHtml(intro)} Valid until ${escapeHtml(validUntil)}.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 24px 20px">
              <a href="${escapeHtml(publicUrl)}" style="display:block;background:#1d1c19;color:#fffdfa;text-align:center;text-decoration:none;font-weight:800;border-radius:10px;padding:14px 18px">View quote</a>
            </td>
          </tr>
          ${quote.scopeSummary ? `<tr><td style="padding:0 24px 18px;color:#646058;font-size:14px;line-height:1.45">${escapeHtml(String(quote.scopeSummary))}</td></tr>` : ""}
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;table-layout:fixed">
          <tbody>${lineRows}</tbody>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background:#fbfaf6;border-top:1px solid #ded9cd">
          <tr>
            <td style="padding:16px 22px 4px;color:#646058;font-size:14px">Subtotal</td>
            <td style="padding:16px 22px 4px;text-align:right;color:#646058;font-size:14px;font-weight:700;white-space:nowrap">${escapeHtml(subtotal)}</td>
          </tr>
          ${discount ? `<tr><td style="padding:4px 22px;color:#646058;font-size:14px">Discount</td><td style="padding:4px 22px;text-align:right;color:#646058;font-size:14px;font-weight:700;white-space:nowrap">-${escapeHtml(discount)}</td></tr>` : ""}
          <tr>
            <td style="padding:4px 22px 12px;color:#646058;font-size:14px">${escapeHtml(taxLabel)}</td>
            <td style="padding:4px 22px 12px;text-align:right;color:#646058;font-size:14px;font-weight:700;white-space:nowrap">${escapeHtml(tax)}</td>
          </tr>
          <tr>
            <td style="padding:14px 22px 18px;border-top:1px solid #1d1c19;color:#1d1c19;font-size:18px;font-weight:800">Total</td>
            <td style="padding:14px 22px 18px;border-top:1px solid #1d1c19;text-align:right;color:#1d1c19;font-size:24px;font-weight:850;white-space:nowrap">${escapeHtml(total)}</td>
          </tr>
        </table>
        ${quote.terms ? `<div style="padding:16px 22px;border-top:1px solid #e5e0d6;color:#646058;font-size:13px;line-height:1.45"><strong style="color:#1d1c19">Terms.</strong> ${escapeHtml(String(quote.terms))}</div>` : ""}
      </div>
      <p style="max-width:560px;margin:14px auto 0;text-align:center;color:#8d887f;font-size:12px;line-height:1.4">No account needed. Questions? Reply to this email. Sent with QuoteVan.</p>
    </div>
  `;

  return { subject, text, html };
}

function formatEmailMoney(cents: number | null) {
  if (cents === null) return "$--";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(cents / 100);
}

function formatEmailDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(iso));
}

function describeEmailQuantity(quantity: number, unit: string | null) {
  const qty = Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(1);

  if (unit === null) return qty;
  if (unit === "each") return `${qty} each`;
  if (unit === "flat") return "Flat";
  if (unit === "sqft") return `${qty} sq ft`;
  if (unit === "lnft") return `${qty} linear ft`;
  return `${qty} ${quantity === 1 ? unit : `${unit}s`}`;
}

function escapeHtml(input: string) {
  return input.replace(/[&<>"']/g, (char) => {
    if (char === "&") return "&amp;";
    if (char === "<") return "&lt;";
    if (char === ">") return "&gt;";
    if (char === "\"") return "&quot;";
    return "&#39;";
  });
}

async function stripePost(path: string, params: Record<string, string | number | boolean | null | undefined>, options: { stripeAccount?: string | undefined } = {}) {
  return await stripeRequest(path, {
    method: "POST",
    params,
    stripeAccount: options.stripeAccount
  });
}

async function stripeGet(path: string, options: { stripeAccount?: string | undefined } = {}) {
  return await stripeRequest(path, {
    method: "GET",
    params: {},
    stripeAccount: options.stripeAccount
  });
}

async function stripeRequest(path: string, input: {
  method: "GET" | "POST";
  params: Record<string, string | number | boolean | null | undefined>;
  stripeAccount?: string | undefined;
}) {
  const secretKey = Deno.env.get("STRIPE_SECRET_KEY");

  if (!secretKey) {
    throw new HttpError(500, "Stripe payments are not configured");
  }

  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(input.params)) {
    if (value !== undefined && value !== null) {
      params.set(key, String(value));
    }
  }

  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: input.method,
    headers: {
      authorization: `Bearer ${secretKey}`,
      ...(input.stripeAccount ? { "stripe-account": input.stripeAccount } : {}),
      ...(input.method === "POST" ? { "content-type": "application/x-www-form-urlencoded" } : {})
    },
    body: input.method === "POST" ? params : undefined
  });

  const body = await response.json().catch(() => ({})) as Record<string, any>;

  if (!response.ok) {
    const message = typeof body.error?.message === "string" ? body.error.message : "Stripe request failed";
    throw new HttpError(response.status >= 500 ? 502 : 400, message);
  }

  return body;
}

async function verifyStripeSignature(body: string, header: string, secret: string) {
  const parts = Object.fromEntries(
    header.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key, value];
    })
  );
  const timestamp = parts.t;
  const signature = parts.v1;

  if (!timestamp || !signature) {
    throw new HttpError(400, "Invalid Stripe signature");
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${body}`));
  const expected = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");

  if (!timingSafeEqualHex(expected, signature)) {
    throw new HttpError(400, "Invalid Stripe signature");
  }
}

function timingSafeEqualHex(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }

  let result = 0;

  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return result === 0;
}

function routeFromRequest(request: Request) {
  const url = new URL(request.url);
  let path = url.pathname.replace(/^\/functions\/v1/, "");
  path = path.replace(/^\/snapquote/, "") || "/";
  return { method: request.method, path };
}

function match(path: string, pattern: string) {
  return path.split("/").length === pattern.split("/").length && pattern.split("/").every((part, index) => {
    const actual = path.split("/")[index];
    return part.startsWith(":") || part === actual;
  });
}

function params(path: string, pattern: string) {
  const values: Record<string, string> = {};
  const pathParts = path.split("/");
  const patternParts = pattern.split("/");

  for (let index = 0; index < patternParts.length; index += 1) {
    const part = patternParts[index];

    if (part.startsWith(":")) {
      values[part.slice(1)] = pathParts[index];
    }
  }

  return values;
}

function requiresAppAuth(route: { method: string; path: string }) {
  return route.path.startsWith("/v1/") && !route.path.startsWith("/v1/auth/");
}

async function authenticatedOrgIdFromRequest(db: SupabaseClient, request: Request) {
  const member = await memberFromBearer(db, request);

  if (!member?.org_id) {
    throw new HttpError(401, "Sign in to use QuoteVan.");
  }

  return String(member.org_id);
}

function orgIdFromRequest(request: Request) {
  const orgId = requestOrgIds.get(request);

  if (!orgId) {
    throw new HttpError(401, "Sign in to use QuoteVan.");
  }

  return orgId;
}

function orgResponse(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    trade: row.trade,
    logoUrl: row.logo_url,
    contactPhone: row.contact_phone,
    website: row.website,
    defaultTaxRate: Number(row.default_tax_rate),
    defaultTerms: row.default_terms,
    quoteValidDays: row.quote_valid_days,
    setupCompletedAt: typeof row.setup_completed_at === "string" ? row.setup_completed_at : null,
    plan: row.plan,
    paymentCurrency: row.payment_currency ?? "cad",
    defaultDepositPercent: Number(row.default_deposit_percent ?? 50),
    paymentsConnected: Boolean(row.stripe_charges_enabled && row.stripe_payouts_enabled && row.stripe_account_id)
  };
}

function extensionForContentType(contentType: "image/jpeg" | "image/png" | "image/webp") {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}

function safeStorageName(fileName: string) {
  const cleaned = fileName.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned.length > 0 ? cleaned.slice(0, 120) : "recording.m4a";
}

function normalizedEmail(email: string | null | undefined) {
  return typeof email === "string" && email.trim().length > 0 ? email.trim().toLowerCase() : null;
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function searchTerm(value: string) {
  return value.replace(/[%(),]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
}

function deriveCustomerCity(address: string) {
  const trimmed = address.trim();

  if (trimmed.length === 0) {
    return "";
  }

  const segments = trimmed.split(",").map((segment) => segment.trim()).filter((segment) => segment.length > 0);
  const last = segments.at(-1) ?? trimmed;

  if (segments.length >= 3 && /^(?:[a-z]{2}|[a-z]{2}\s+[a-z]\d[a-z][ -]?\d[a-z]\d|\d{5}(?:-\d{4})?|canada|usa|united states)$/i.test(last)) {
    return segments.at(-2) ?? last;
  }

  return last;
}

function inferQuoteWorkType(jobTitle: string, checklist: PainterChecklist): z.infer<typeof workTypeSchema> {
  const typed = jobTitle.trim().toLowerCase();
  const rooms = checklist.rooms.small + checklist.rooms.medium + checklist.rooms.large;

  if (typed.includes("exterior") || (rooms === 0 && checklist.doorCount > 0)) {
    return "exterior_trim";
  }

  return "interior_repaint";
}

function customerResponse(row: Record<string, unknown>) {
  const address = stringOrNull(row.address) ?? "";

  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    address,
    city: stringOrNull(row.city) ?? deriveCustomerCity(address),
    createdAt: row.created_at
  };
}

function pricingColumns(pricing: PriceBookPricing) {
  if (pricing.type === "fixed") {
    return {
      pricing_type: "fixed",
      unit_price_cents: pricing.unitPriceCents,
      small_price_cents: null,
      medium_price_cents: null,
      large_price_cents: null
    };
  }

  return {
    pricing_type: "room_size",
    unit_price_cents: null,
    small_price_cents: pricing.prices.small,
    medium_price_cents: pricing.prices.medium,
    large_price_cents: pricing.prices.large
  };
}

function fallbackExtraction(transcript: string, typedNotes: string, checklist: PainterChecklist): z.infer<typeof extractionResultSchema> {
  const sourceText = [transcript, typedNotes].filter((part) => part.trim().length > 0).join(" ");
  const roomCount = checklist.rooms.small + checklist.rooms.medium + checklist.rooms.large;
  const customerSuppliesMaterials =
    checklist.customerSuppliesPaint ||
    /\b(customer|client|homeowner)\b.*\b(supplies|provides|provided)\b.*\b(paint|materials?)\b/i.test(sourceText);
  const tasks: z.infer<typeof extractionResultSchema>["tasks"] = [];

  if (checklist.surfaces.walls && roomCount > 0) {
    tasks.push({
      description: "Paint walls",
      quantity: roomCount,
      unit: "room",
      kind: "labour",
      assumptions: ["Room count came from the locked checklist."],
      confidence: 0.9
    });
  }

  if (checklist.surfaces.ceilings && roomCount > 0) {
    tasks.push({
      description: "Paint ceilings",
      quantity: roomCount,
      unit: "room",
      kind: "labour",
      assumptions: ["Room count came from the locked checklist."],
      confidence: 0.9
    });
  }

  if (checklist.surfaces.trim && roomCount > 0) {
    tasks.push({
      description: "Paint trim",
      quantity: roomCount,
      unit: "room",
      kind: "labour",
      assumptions: ["Room count came from the locked checklist."],
      confidence: 0.9
    });
  }

  if (checklist.doorCount > 0) {
    tasks.push({
      description: "Paint doors",
      quantity: checklist.doorCount,
      unit: "each",
      kind: "labour",
      assumptions: ["Door count came from the locked checklist."],
      confidence: 0.9
    });
  }

  if (/\b(patch|fill|repair)\b.*\b(nail\s+holes?|holes?)\b/i.test(sourceText)) {
    tasks.push({
      description: "Patch nail holes",
      quantity: roomCount > 0 ? roomCount : null,
      unit: roomCount > 0 ? "room" : null,
      kind: "labour",
      assumptions: ["Transcript mentioned patching nail holes."],
      confidence: 0.82
    });
  }

  if (/\b(remove|strip|take\s+off)\b.*\bwallpaper\b/i.test(sourceText)) {
    tasks.push({
      description: "Remove wallpaper",
      quantity: null,
      unit: null,
      kind: "labour",
      assumptions: ["Transcript mentioned wallpaper removal but no measured quantity."],
      confidence: 0.78
    });
  }

  if (/\b(primer|prime|priming)\b/i.test(sourceText)) {
    tasks.push({
      description: "Primer coat",
      quantity: roomCount > 0 ? roomCount : null,
      unit: roomCount > 0 ? "room" : null,
      kind: "material",
      assumptions: ["Transcript mentioned primer."],
      confidence: 0.8
    });
  }

  if (
    /\b(materials?|paint)\b.*\ballowance\b/i.test(sourceText) ||
    /\ballowance\b.*\b(materials?|paint)\b/i.test(sourceText)
  ) {
    tasks.push({
      description: "Material allowance",
      quantity: 1,
      unit: "flat",
      kind: "material",
      assumptions: ["Transcript mentioned a paint or material allowance."],
      confidence: 0.74
    });
  }

  return {
    scope_summary:
      sourceText.trim().length > 0
        ? sourceText.trim().slice(0, 1200)
        : `Painting scope from checklist: ${roomCount} rooms, ${checklist.coatCount} coats.`,
    tasks,
    site_conditions: customerSuppliesMaterials ? ["Customer supplies paint."] : [],
    questions_for_contractor: tasks.some((task) => task.quantity === null)
      ? ["Confirm quantities for the unmeasured extra work before sending."]
      : []
  };
}

function lineItemsFromExtraction(params: {
  tasks: z.infer<typeof extractionResultSchema>["tasks"];
  existingLines: QuoteLineItem[];
  priceBookItems: PriceBookItem[];
  startPosition: number;
}) {
  const lines: QuoteLineItem[] = [];

  for (const task of params.tasks) {
    if (isTaskAlreadyCovered(task.description, [...params.existingLines, ...lines])) {
      continue;
    }

    const item = bestPriceBookMatch(task.description, params.priceBookItems);
    const quantity = task.quantity ?? 1;
    const unit = normalizeExtractedUnit(task.unit);
    const position = params.startPosition + lines.length;

    if (item) {
      lines.push(lineFromPriceBook(item, task.description, quantity, null, position));
      continue;
    }

    lines.push({
      position,
      description: task.description,
      quantity,
      unit,
      unitPriceCents: null,
      kind: task.kind,
      source: "manual",
      priceBookItemId: null,
      priceBookItemKey: null,
      matchConfidence: task.confidence,
      matchState: "red"
    });
  }

  return lines;
}

function isTaskAlreadyCovered(description: string, lines: QuoteLineItem[]) {
  const normalized = normalizeText(description);
  const buckets = [
    /paint walls?/,
    /paint ceilings?/,
    /paint trim/,
    /paint doors?/,
    /patch .*holes?/,
    /primer|prime/,
    /wallpaper/,
    /material allowance|paint.*material/
  ];

  if (buckets.some((bucket) => bucket.test(normalized) && lines.some((line) => bucket.test(normalizeText(line.description))))) {
    return true;
  }

  const taskTokens = tokenSet(description);
  return lines.some((line) => overlapScore(taskTokens, tokenSet(line.description)) >= 0.72);
}

function bestPriceBookMatch(description: string, items: PriceBookItem[]) {
  const descriptionTokens = tokenSet(description);
  let best: { item: PriceBookItem; score: number } | null = null;

  for (const item of items) {
    const score = Math.max(
      overlapScore(descriptionTokens, tokenSet(item.name)),
      overlapScore(descriptionTokens, tokenSet(item.description)),
      item.key ? overlapScore(descriptionTokens, tokenSet(item.key.replaceAll("_", " "))) : 0
    );

    if (!best || score > best.score) {
      best = { item, score };
    }
  }

  return best && best.score >= 0.55 ? best.item : null;
}

function normalizeExtractedUnit(unit: string | null): QuoteLineItem["unit"] {
  if (
    unit === "room" ||
    unit === "each" ||
    unit === "hour" ||
    unit === "flat" ||
    unit === "sqft" ||
    unit === "lnft" ||
    unit === "day"
  ) {
    return unit;
  }

  return "flat";
}

function tokenSet(value: string) {
  return new Set(normalizeText(value).split(" ").filter((token) => token.length >= 3));
}

function overlapScore(left: Set<string>, right: Set<string>) {
  if (left.size === 0 || right.size === 0) {
    return 0;
  }

  let matches = 0;

  for (const token of left) {
    if (right.has(token)) {
      matches += 1;
    }
  }

  return matches / Math.max(left.size, right.size);
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))];
}

function extractionJsonSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["scope_summary", "tasks", "site_conditions", "questions_for_contractor"],
    properties: {
      scope_summary: { type: "string" },
      tasks: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["description", "quantity", "unit", "kind", "assumptions", "confidence"],
          properties: {
            description: { type: "string" },
            quantity: { anyOf: [{ type: "number" }, { type: "null" }] },
            unit: { anyOf: [{ type: "string" }, { type: "null" }] },
            kind: { type: "string", enum: ["labour", "material"] },
            assumptions: { type: "array", items: { type: "string" } },
            confidence: { type: "number", minimum: 0, maximum: 1 }
          }
        }
      },
      site_conditions: { type: "array", items: { type: "string" } },
      questions_for_contractor: { type: "array", items: { type: "string" } }
    }
  };
}

function extractResponseText(body: unknown): string {
  if (typeof body === "object" && body !== null && "output_text" in body && typeof body.output_text === "string") {
    return body.output_text;
  }

  if (typeof body !== "object" || body === null || !("output" in body) || !Array.isArray(body.output)) {
    throw new HttpError(502, "OpenAI response did not include output text");
  }

  for (const item of body.output) {
    if (typeof item !== "object" || item === null || !("content" in item) || !Array.isArray(item.content)) {
      continue;
    }

    for (const content of item.content) {
      if (typeof content === "object" && content !== null && "text" in content && typeof content.text === "string") {
        return content.text;
      }
    }
  }

  throw new HttpError(502, "OpenAI response did not include output text");
}

function corePricing(key: string, corePrices: typeof defaultCorePrices): PriceBookPricing | null {
  if (key === "paint_walls") return { type: "room_size", prices: corePrices.paintWalls };
  if (key === "paint_ceiling") return { type: "room_size", prices: corePrices.paintCeiling };
  if (key === "paint_trim") return { type: "room_size", prices: corePrices.paintTrim };
  if (key === "paint_door") return { type: "fixed", unitPriceCents: corePrices.paintDoorEachCents };
  if (key === "heavy_wall_prep") return { type: "fixed", unitPriceCents: corePrices.heavyPrepHourlyCents };
  return null;
}

async function signAppToken(payload: {
  typ: "access" | "refresh";
  sub: string;
  org: string;
  email: string;
  exp: number;
}) {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const encodedPayload = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await hmacSha256(`${encodedHeader}.${encodedPayload}`);

  return `${encodedHeader}.${encodedPayload}.${base64UrlEncode(signature)}`;
}

async function verifyAppToken(token: string, type: "access" | "refresh") {
  const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");

  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new HttpError(401, "Session expired. Sign in again.");
  }

  const expected = await hmacSha256(`${encodedHeader}.${encodedPayload}`);
  const actual = base64UrlDecode(encodedSignature);

  if (!timingSafeEqual(actual, expected)) {
    throw new HttpError(401, "Session expired. Sign in again.");
  }

  const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(encodedPayload))) as {
    typ?: string;
    sub?: string;
    org?: string;
    email?: string;
    exp?: number;
  };

  if (
    payload.typ !== type ||
    typeof payload.sub !== "string" ||
    typeof payload.org !== "string" ||
    typeof payload.email !== "string" ||
    typeof payload.exp !== "number" ||
    payload.exp <= Math.floor(Date.now() / 1000)
  ) {
    throw new HttpError(401, "Session expired. Sign in again.");
  }

  return {
    typ: payload.typ,
    sub: payload.sub,
    org: payload.org,
    email: payload.email,
    exp: payload.exp
  };
}

async function hmacSha256(value: string) {
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!secret) {
    throw new HttpError(500, "SUPABASE_SERVICE_ROLE_KEY is required");
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));

  return new Uint8Array(signature);
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) {
    return false;
  }

  let diff = 0;

  for (let index = 0; index < left.length; index += 1) {
    diff |= left[index] ^ right[index];
  }

  return diff === 0;
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);

  if (!parsed.success) {
    throw new HttpError(400, JSON.stringify(parsed.error.flatten()));
  }

  return parsed.data;
}

async function single(query: PromiseLike<{ data: unknown; error: unknown }>) {
  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;

  if (!row) {
    throw new HttpError(404, "Record not found");
  }

  return row as Record<string, any>;
}

async function maybeSingle(query: PromiseLike<{ data: unknown; error: unknown }>) {
  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  return row ? row as Record<string, any> : null;
}

function must(result: { error: unknown }) {
  if (result.error) {
    throw result.error;
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "content-type": "application/json"
    }
  });
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

function slugKey(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80);
}

function priceBookKeyFromLine(line: LineRow) {
  return slugKey(line.description) || `line_${line.id.replaceAll("-", "").slice(0, 32)}`;
}

function priceBookNameFromLineDescription(description: string) {
  const clean = description.replace(/\s+/g, " ").trim();

  if (clean.length <= 160) {
    return clean || "Untitled item";
  }

  return `${clean.slice(0, 157).trimEnd()}...`;
}

function messageFromError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }

  return "Request failed";
}

function authFailureMessage(...errors: unknown[]) {
  const message = errors.map(debugMessageFromError).find((candidate) => candidate !== "Request failed");

  if (!message || message === "{}") {
    return "Could not complete sign in. Try again.";
  }

  return message;
}

function nativeAppleAuthFailureMessage(error: unknown) {
  const message = authFailureMessage(error);
  const lower = message.toLowerCase();

  if (lower.includes("audience") || lower.includes("client") || lower.includes("bundle")) {
    return "Apple sign-in is not configured for this app bundle.";
  }

  if (lower.includes("nonce")) {
    return "Apple sign-in could not verify this request. Try again.";
  }

  if (lower.includes("provider") || lower.includes("apple")) {
    return "Apple sign-in is not fully enabled for this Supabase project.";
  }

  return "Could not complete Apple sign-in. Try again.";
}

function debugMessageFromError(error: unknown) {
  if (!error) {
    return "Request failed";
  }

  const message = messageFromError(error);

  if (message !== "Request failed" && message !== "{}") {
    return message;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Request failed";
  }
}

function publicMessageFromError(error: unknown, status: number) {
  if (status < 500) {
    return messageFromError(error);
  }

  const message = messageFromError(error).toLowerCase();

  if (message.includes("stripe payments are not configured") || message.includes("payment") && message.includes("not configured")) {
    return "Online deposits are not configured yet. Add Stripe keys before opening payment setup.";
  }

  if (message.includes("permission denied") || message.includes("relation ") || message.includes("schema ")) {
    return "QuoteVan is still finishing setup. Try again in a moment.";
  }

  return "QuoteVan hit a server problem. Try again in a moment.";
}

function enforceRateLimit(request: Request, keyParts: string[], limit: number, windowMs: number) {
  const now = Date.now();
  const key = keyParts.join(":");
  const bucket = rateLimitBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
    pruneRateLimitBuckets(now);
    return;
  }

  if (bucket.count >= limit) {
    throw new HttpError(429, "Too many requests. Try again in a moment.");
  }

  bucket.count += 1;
  rateLimitBuckets.set(key, bucket);
}

function pruneRateLimitBuckets(now: number) {
  if (rateLimitBuckets.size <= maxRateLimitBuckets) {
    return;
  }

  for (const [key, bucket] of rateLimitBuckets) {
    if (bucket.resetAt <= now) {
      rateLimitBuckets.delete(key);
    }
  }
}

function requestClientKey(request: Request) {
  const cfIp = request.headers.get("cf-connecting-ip")?.trim();

  if (cfIp) {
    return cfIp;
  }

  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();

  return forwardedFor || "unknown-client";
}

function assertInboundEmailWebhookSecret(request: Request) {
  const expected = envFirst("QUOTEVAN_INBOUND_EMAIL_SECRET", "SNAPQUOTE_INBOUND_EMAIL_SECRET", "SNAPQUOTE_EMAIL_WEBHOOK_SECRET");

  if (!expected) {
    throw new HttpError(500, "Inbound email webhook secret is not configured");
  }

  const authorization = request.headers.get("authorization") ?? "";
  const bearer = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";
  const provided = bearer || request.headers.get("x-snapquote-webhook-secret")?.trim();

  if (provided !== expected) {
    throw new HttpError(401, "Invalid email webhook secret");
  }
}

function assertAdminSecret(request: Request) {
  const expected = envFirst("QUOTEVAN_ADMIN_SECRET", "SNAPQUOTE_ADMIN_SECRET", "SNAPQUOTE_PRICING_INGEST_SECRET");

  if (!expected) {
    throw new HttpError(500, "Admin secret is not configured");
  }

  const authorization = request.headers.get("authorization") ?? "";
  const bearer = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";
  const provided = bearer || request.headers.get("x-snapquote-admin-secret")?.trim();

  if (provided !== expected) {
    throw new HttpError(401, "Invalid admin secret");
  }
}

function arrayOfStrings(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function extractPublicQuoteToken(...values: Array<string | undefined>) {
  for (const value of values) {
    if (!value) {
      continue;
    }

    const match = value.match(/\/q\/([A-Za-z0-9_-]{16,160})/);

    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

function stripHtml(value: string) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function emailPreview(value: string) {
  const clean = value.replace(/\s+/g, " ").trim();

  if (clean.length <= 500) {
    return clean;
  }

  return `${clean.slice(0, 497)}...`;
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
