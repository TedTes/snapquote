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
  publicToken,
  quoteLineFromRow,
  starterDefinitions,
  toDiscount,
  totalsColumns,
  type LineRow,
  type PainterChecklist,
  type PriceBookItem,
  type PriceBookPricing,
  type PriceBookRow,
  type QuoteDiscount,
  type QuoteEvent,
  type QuoteLineItem,
  type QuoteRow
} from "./domain.ts";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type, x-snapquote-org-id",
  "access-control-allow-methods": "GET,POST,PATCH,OPTIONS"
};

const defaultOrgId = Deno.env.get("SNAPQUOTE_DEFAULT_ORG_ID") ?? "00000000-0000-4000-8000-000000000001";
const defaultUserId = Deno.env.get("SNAPQUOTE_DEFAULT_USER_ID") ?? "00000000-0000-4000-8000-000000000002";
const requestOrgIds = new WeakMap<Request, string>();
const appAccessTokenSeconds = 60 * 60 * 24 * 7;
const appRefreshTokenSeconds = 60 * 60 * 24 * 30;

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
  address: z.string().trim().min(1).max(400)
});

const createQuoteSchema = z.object({
  customerId: z.string().uuid().optional(),
  customer: customerSchema.optional(),
  address: z.string().trim().min(1).max(400),
  jobTitle: z.string().trim().max(160).optional(),
  checklist: checklistSchema.default(defaultChecklist),
  transcript: z.string().trim().max(5000).default(""),
  typedNotes: z.string().trim().max(5000).optional(),
  audioStoragePath: z.string().trim().min(1).max(1000).nullable().optional(),
  audioContentType: z.string().trim().min(1).max(120).nullable().optional(),
  audioDurationSeconds: z.number().int().min(0).max(3600).nullable().optional()
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
  channels: z.array(z.literal("email")).min(1).max(1).default(["email"])
});

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const db = getDb();
    const route = routeFromRequest(request);

    if (route.method === "GET" && route.path === "/health") {
      return json({ ok: true, service: "snapquote-edge", timestamp: new Date().toISOString() });
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

    const orgId = await resolveOrgId(db, request);
    requestOrgIds.set(request, orgId);
    await ensureOrg(db, orgId);

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

    if (route.method === "POST" && route.path === "/v1/account/delete") {
      return json(await deleteAccount(db, request));
    }

    if (route.method === "POST" && route.path === "/v1/onboarding/painter") {
      return json(await onboardPainter(db, request));
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
      return json({ customers: await listCustomers(db, orgIdFromRequest(request)) });
    }

    if (route.method === "POST" && route.path === "/v1/customers") {
      return json(await createCustomer(db, request), 201);
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

    if (route.method === "POST" && match(route.path, "/v1/quotes/:id/follow-up")) {
      return json(await followUpQuote(db, request, params(route.path, "/v1/quotes/:id/follow-up").id));
    }

    if (route.method === "POST" && match(route.path, "/v1/quotes/:id/delete-draft")) {
      return json(await deleteDraftQuote(db, request, params(route.path, "/v1/quotes/:id/delete-draft").id));
    }

    if (route.method === "POST" && match(route.path, "/v1/quotes/:id/duplicate")) {
      return json(await duplicateQuote(db, request, params(route.path, "/v1/quotes/:id/duplicate").id), 201);
    }

    if (route.method === "POST" && match(route.path, "/v1/quotes/:id/revise")) {
      return json(await reviseQuote(db, request, params(route.path, "/v1/quotes/:id/revise").id), 201);
    }

    if (route.method === "GET" && match(route.path, "/public/quotes/:token")) {
      return json(await viewPublicQuote(db, params(route.path, "/public/quotes/:token").token));
    }

    if (route.method === "POST" && match(route.path, "/public/quotes/:token/respond")) {
      return json(await respondToPublicQuote(db, request, params(route.path, "/public/quotes/:token/respond").token));
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
    return authResponse(session, org, member);
  }

  const payload = await verifyAppToken(input.refreshToken, "refresh");
  const member = await single(db.from("snapquote_org_members").select("*").eq("id", payload.sub));
  const org = await single(db.from("snapquote_orgs").select("*").eq("id", member.org_id));

  return authResponse(await createAppSession(member), org, member);
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
    return authResponse(session, org, existingMember);
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

  return authResponse(session, org, member);
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

function authResponse(
  session: AuthSessionPayload,
  org: Record<string, unknown>,
  member: Record<string, unknown>
) {
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
      entitlements: {
        canSendQuotes: true,
        trialEndsAt: null
      }
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
  const org = await single(db.from("snapquote_orgs").select("*").eq("id", orgId));
  const user = await memberFromBearer(db, request) ??
    await single(db.from("snapquote_org_members").select("*").eq("org_id", orgId).limit(1));

  return {
    user: {
      id: user.id,
      orgId: user.org_id,
      email: user.email,
      name: user.name,
      role: user.role
    },
    org: orgResponse(org),
    entitlements: {
      canSendQuotes: true,
      trialEndsAt: null
    }
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

  const url = Deno.env.get("SNAPQUOTE_BILLING_PORTAL_URL") ?? null;

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

async function listCustomers(db: SupabaseClient, orgId: string) {
  const { data, error } = await db.from("snapquote_customers").select("*").eq("org_id", orgId).order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data.map(customerResponse);
}

async function createCustomer(db: SupabaseClient, request: Request) {
  const input = parse(customerSchema, await request.json());
  const row = await single(db.from("snapquote_customers").insert({
    org_id: orgIdFromRequest(request),
    name: input.name,
    email: input.email ?? null,
    phone: input.phone ?? null,
    address: input.address
  }).select("*"));
  return customerResponse(row);
}

async function createQuote(db: SupabaseClient, request: Request) {
  const orgId = orgIdFromRequest(request);
  const input = parse(createQuoteSchema, await request.json());
  const customer = input.customerId
    ? await single(db.from("snapquote_customers").select("*").eq("org_id", orgId).eq("id", input.customerId))
    : await createCustomerFromInput(db, orgId, input.customer ?? {
        name: "Unnamed customer",
        email: "customer@example.com",
        phone: null,
        address: input.address
      });

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
    job_title: input.jobTitle ?? "",
    valid_until: validUntil,
    discount_type: discount.type,
    discount_value: discount.value,
    tax_rate: Number(org.default_tax_rate),
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
  const { data, error } = await db.from("snapquote_quotes").select("id").eq("org_id", orgId).order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return Promise.all(data.map((row) => getQuoteResponse(db, orgId, row.id)));
}

async function getQuoteResponse(db: SupabaseClient, orgId: string, quoteId: string) {
  await refreshStatuses(db, orgId);
  const quote = await single(db.from("snapquote_quotes").select("*").eq("org_id", orgId).eq("id", quoteId)) as QuoteRow;
  const customer = await single(db.from("snapquote_customers").select("*").eq("id", quote.customer_id));
  const lineItems = await listLines(db, quote.id);
  const publicLink = await single(db.from("snapquote_quote_public_links").select("*").eq("quote_id", quote.id));
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
    customerId: quote.customer_id,
    customer: customerResponse(customer),
    address: quote.address,
    jobTitle: quote.job_title,
    status: quote.status,
    publicToken: publicLink.token,
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

async function patchQuote(db: SupabaseClient, request: Request, quoteId: string) {
  const orgId = orgIdFromRequest(request);
  const input = parse(quotePatchSchema, await request.json());
  const quote = await single(db.from("snapquote_quotes").select("*").eq("id", quoteId).eq("org_id", orgId)) as QuoteRow;

  if (quote.status !== "draft") {
    throw new HttpError(409, "Sent/responded quotes are immutable; revise to create a new draft");
  }

  let lineItems = await listLines(db, quoteId);

  if (input.lineItems !== undefined) {
    must(await db.from("snapquote_quote_line_items").delete().eq("quote_id", quoteId));
    const normalized = input.lineItems.map((line: QuoteLineItem, index: number) => ({ ...line, position: index }));
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

  const item = await single(db.from("snapquote_price_book_items").insert({
    org_id: orgId,
    key: slugKey(line.description),
    name: line.description,
    description: line.description,
    unit: line.unit ?? "flat",
    pricing_type: "fixed",
    unit_price_cents: line.unit_price_cents,
    kind: line.kind,
    starter: false,
    confirmed_at: new Date().toISOString(),
    usage_count: 1
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
  parse(sendSchema, await request.json().catch(() => ({})));
  const orgId = orgIdFromRequest(request);
  const quote = await single(db.from("snapquote_quotes").select("*").eq("id", quoteId).eq("org_id", orgId)) as QuoteRow;
  const customer = await single(db.from("snapquote_customers").select("*").eq("id", quote.customer_id));
  const lineItems = await listLines(db, quoteId);

  if (quote.status !== "draft") {
    throw new HttpError(409, "Only draft quotes can be sent");
  }

  if (!customer.email) {
    throw new HttpError(409, "Customer email is required before sending");
  }

  assertQuoteCanSend(lineItems);
  const totals = computeTotalsIfReady({
    lineItems,
    discount: toDiscount(quote.discount_type, quote.discount_value),
    taxRate: Number(quote.tax_rate)
  });
  const now = new Date().toISOString();
  must(await db.from("snapquote_quotes").update({
    sent_at: now,
    status: "sent",
    ...totalsColumns(totals)
  }).eq("id", quoteId).eq("org_id", orgId));

  const response = await getQuoteResponse(db, orgId, quoteId);
  const delivery = await deliverQuoteNotification("quote_sent", response);
  await createEvent(db, quoteId, "sent", { channel: "email", ...delivery });

  return response;
}

async function followUpQuote(db: SupabaseClient, request: Request, quoteId: string) {
  parse(sendSchema, await request.json().catch(() => ({})));
  const orgId = orgIdFromRequest(request);
  const quote = await single(db.from("snapquote_quotes").select("*").eq("id", quoteId).eq("org_id", orgId)) as QuoteRow;

  if (quote.status !== "sent" && quote.status !== "viewed") {
    throw new HttpError(409, "Only sent quotes awaiting a response can be followed up");
  }

  if (!isQuoteStale({ sentAt: quote.sent_at, firstViewedAt: quote.first_viewed_at, respondedAt: quote.responded_at, now: new Date() })) {
    throw new HttpError(409, "Quote is not stale yet");
  }

  const response = await getQuoteResponse(db, orgId, quoteId);
  const delivery = await deliverQuoteNotification("quote_follow_up", response);
  await createEvent(db, quoteId, "followed_up", { channel: "email", ...delivery });

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
  return await single(db.from("snapquote_customers").insert({
    org_id: orgId,
    name: input.name,
    email: input.email ?? null,
    phone: input.phone ?? null,
    address: input.address
  }).select("*"));
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

async function deliverQuoteNotification(kind: "quote_sent" | "quote_follow_up", quote: Record<string, any>) {
  const webhookUrl = Deno.env.get("SNAPQUOTE_EMAIL_WEBHOOK_URL");
  const publicUrl = publicQuoteUrl(String(quote.publicToken));
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

function publicQuoteUrl(token: string) {
  const baseUrl = Deno.env.get("SNAPQUOTE_PUBLIC_BASE_URL");

  if (!baseUrl) {
    return `/public/quotes/${token}`;
  }

  return `${baseUrl.replace(/\/$/, "")}/public/quotes/${token}`;
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

async function resolveOrgId(db: SupabaseClient, request: Request) {
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (bearerToken) {
    const { data, error } = await db.auth.getUser(bearerToken);

    if (!error && data.user) {
      const { data: member, error: memberError } = await db
        .from("snapquote_org_members")
        .select("org_id")
        .eq("auth_user_id", data.user.id)
        .maybeSingle();

      if (memberError) {
        throw memberError;
      }

      if (member?.org_id) {
        return String(member.org_id);
      }
    }

    const payload = await verifyAppToken(bearerToken, "access").catch(() => null);

    if (payload?.org) {
      return payload.org;
    }
  }

  return request.headers.get("x-snapquote-org-id") ?? defaultOrgId;
}

function orgIdFromRequest(request: Request) {
  return requestOrgIds.get(request) ?? request.headers.get("x-snapquote-org-id") ?? defaultOrgId;
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
    plan: row.plan
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

function customerResponse(row: Record<string, unknown>) {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    address: row.address,
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

  if (message.includes("permission denied") || message.includes("relation ") || message.includes("schema ")) {
    return "SnapQuote is still finishing setup. Try again in a moment.";
  }

  return "SnapQuote hit a server problem. Try again in a moment.";
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
