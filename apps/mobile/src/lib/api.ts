import type {
  PainterChecklist,
  PainterCorePriceInput,
  PriceBookItem,
  PriceBookPricing,
  QuoteDiscount,
  QuoteLineItem,
  QuoteStatus
} from "@snapquote/shared";

type ExpoRuntimeProcess = {
  env?: Record<string, string | undefined>;
};

const runtimeProcess = globalThis as unknown as { process?: ExpoRuntimeProcess };
const rawApiBaseUrl = envValue("EXPO_PUBLIC_API_URL") ?? "https://dctmpfrbkgntiuhjbblu.functions.supabase.co/snapquote";
const snapquoteOrgId = envValue("EXPO_PUBLIC_SNAPQUOTE_ORG_ID");
let authAccessToken: string | null = null;

export const apiBaseUrl = rawApiBaseUrl.replace(/\/$/, "");

function envValue(key: string): string | undefined {
  const value = runtimeProcess.process?.env?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

type RequestOptions = {
  body?: unknown;
  method?: "GET" | "POST" | "PATCH";
  skipAuth?: boolean | undefined;
};

export type ApiCustomer = {
  id: string;
  orgId: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string;
  createdAt: string;
};

export type ApiQuote = {
  id: string;
  orgId: string;
  customerId: string;
  customer: ApiCustomer | null;
  address: string;
  jobTitle: string;
  status: QuoteStatus;
  publicToken: string;
  validUntil: string;
  lineItems: (QuoteLineItem & { id: string })[];
  discount: QuoteDiscount;
  taxRate: number;
  totals: {
    subtotalCents: number;
    discountCents: number;
    taxCents: number;
    totalCents: number;
  } | null;
  notes: string;
  terms: string;
  scopeSummary: string;
  scopeNotes: string[];
  conflicts: {
    field: string;
    checklistValue: string;
    transcriptValue: string;
    message: string;
  }[];
  checklist: PainterChecklist;
  transcript: string;
  sentAt: string | null;
  firstViewedAt: string | null;
  respondedAt: string | null;
  supersededByQuoteId: string | null;
  createdAt: string;
  updatedAt: string;
  sendBlockers: {
    redCount: number;
    yellowCount: number;
    reasons: string[];
  };
  isStale: boolean;
};

export type MeResponse = {
  user: {
    id: string;
    orgId: string;
    email: string;
    name: string;
    role: "owner";
  };
  org: {
    id: string;
    name: string;
    trade: "painting";
    logoUrl: string | null;
    contactPhone: string | null;
    website: string | null;
    defaultTaxRate: number;
    defaultTerms: string;
    quoteValidDays: number;
    setupCompletedAt: string | null;
    plan: "trial" | "solo" | "crew" | "expired";
  };
  entitlements: {
    canSendQuotes: boolean;
    trialEndsAt: string | null;
  };
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

export type AuthResponse = {
  session: AuthSession;
  me: MeResponse;
};

export type OAuthProvider = "apple" | "google";

export type CreateCustomerInput = {
  name: string;
  email?: string | null | undefined;
  phone?: string | null | undefined;
  address: string;
};

export type CreateQuoteInput = {
  customerId?: string | undefined;
  customer?: CreateCustomerInput | undefined;
  address: string;
  jobTitle?: string | undefined;
  checklist: PainterChecklist;
  transcript: string;
  typedNotes?: string | undefined;
};

export type ScopeExtraction = {
  scope_summary: string;
  tasks: {
    description: string;
    quantity: number | null;
    unit: string | null;
    kind: "labour" | "material";
    assumptions: string[];
    confidence: number;
  }[];
  site_conditions: string[];
  questions_for_contractor: string[];
};

export const snapquoteApi = {
  health: () => request<unknown>("/health"),

  refreshSession: (input: { refreshToken: string }) =>
    request<AuthResponse>("/v1/auth/refresh", {
      method: "POST",
      body: input,
      skipAuth: true
    }),

  startOAuth: (input: { provider: OAuthProvider; redirectTo: string }) =>
    request<{ provider: OAuthProvider; redirectTo: string; url: string }>("/v1/auth/oauth/start", {
      method: "POST",
      body: input,
      skipAuth: true
    }),

  completeOAuth: (input: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    provider?: OAuthProvider | undefined;
    businessName?: string | undefined;
    name?: string | undefined;
  }) =>
    request<AuthResponse>("/v1/auth/oauth/complete", {
      method: "POST",
      body: input,
      skipAuth: true
    }),

  completeNativeOAuth: (input: {
    provider: "apple";
    identityToken: string;
    authorizationCode?: string | undefined;
    email?: string | undefined;
    name?: string | undefined;
    businessName?: string | undefined;
    nonce?: string | undefined;
  }) =>
    request<AuthResponse>("/v1/auth/oauth/native", {
      method: "POST",
      body: input,
      skipAuth: true
    }),

  me: () => request<MeResponse>("/v1/me"),

  updateMe: (input: {
    businessName?: string | undefined;
    defaultTaxRate?: number | undefined;
    defaultTerms?: string | undefined;
    quoteValidDays?: number | undefined;
    contactPhone?: string | null | undefined;
    website?: string | null | undefined;
    logoUrl?: string | null | undefined;
  }) =>
    request<MeResponse>("/v1/me", {
      method: "PATCH",
      body: input
    }),

  uploadAvatar: (input: { fileName: string; contentType: "image/jpeg" | "image/png" | "image/webp"; base64: string }) =>
    request<{ org: MeResponse["org"] }>("/v1/profile/avatar", {
      method: "POST",
      body: input
    }),

  billingPortal: () => request<{ url: string | null }>("/v1/billing/portal"),

  deleteAccount: () =>
    request<{ deleted: boolean }>("/v1/account/delete", {
      method: "POST"
    }),

  onboardPainter: (input: {
    businessName: string;
    defaultTaxRate: number;
    defaultTerms: string;
    quoteValidDays: number;
    corePrices: PainterCorePriceInput;
  }) =>
    request<{ org: MeResponse["org"]; priceBookItems: PriceBookItem[] }>("/v1/onboarding/painter", {
      method: "POST",
      body: input
    }),

  listPriceBook: () => request<{ items: PriceBookItem[] }>("/v1/price-book"),

  createPriceBookItem: (input: {
    name: string;
    description: string;
    unit: PriceBookItem["unit"];
    kind: PriceBookItem["kind"];
    pricing: PriceBookPricing;
    confirmed?: boolean | undefined;
  }) =>
    request<PriceBookItem>("/v1/price-book", {
      method: "POST",
      body: input
    }),

  updatePriceBookItem: (
    id: string,
    input: {
      name?: string | undefined;
      description?: string | undefined;
      pricing?: PriceBookPricing | undefined;
      confirmed?: boolean | undefined;
    }
  ) => request<PriceBookItem>(`/v1/price-book/${id}`, { method: "PATCH", body: input }),

  archivePriceBookItem: (id: string) =>
    request<{ id: string; archived: boolean }>(`/v1/price-book/${id}/archive`, {
      method: "POST"
    }),

  listCustomers: () => request<{ customers: ApiCustomer[] }>("/v1/customers"),

  createCustomer: (input: CreateCustomerInput) =>
    request<ApiCustomer>("/v1/customers", {
      method: "POST",
      body: input
    }),

  listQuotes: () => request<{ quotes: ApiQuote[] }>("/v1/quotes"),

  createQuote: (input: CreateQuoteInput) =>
    request<ApiQuote>("/v1/quotes", {
      method: "POST",
      body: input
    }),

  extractScope: (input: {
    transcript: string;
    typedNotes?: string | undefined;
    checklist: PainterChecklist;
  }) =>
    request<{ source: "openai" | "fallback"; model?: string | undefined; extraction: ScopeExtraction }>(
      "/v1/ai/extract",
      {
        method: "POST",
        body: input
      }
    ),

  getQuote: (id: string) => request<ApiQuote>(`/v1/quotes/${id}`),

  patchQuote: (
    id: string,
    input: {
      lineItems?: QuoteLineItem[] | undefined;
      discount?: QuoteDiscount | undefined;
      taxRate?: number | undefined;
      notes?: string | undefined;
      terms?: string | undefined;
      validUntil?: string | undefined;
    }
  ) => request<ApiQuote>(`/v1/quotes/${id}`, { method: "PATCH", body: input }),

  confirmLine: (quoteId: string, lineId: string) =>
    request<{ item: PriceBookItem; quote: ApiQuote }>(`/v1/quotes/${quoteId}/lines/${lineId}/confirm`, {
      method: "POST"
    }),

  saveLineToPriceBook: (quoteId: string, lineId: string) =>
    request<{ item: PriceBookItem; quote: ApiQuote }>(`/v1/quotes/${quoteId}/lines/${lineId}/save-price-book`, {
      method: "POST"
    }),

  sendQuote: (id: string) =>
    request<ApiQuote>(`/v1/quotes/${id}/send`, {
      method: "POST",
      body: { channels: ["email"] }
    }),

  followUpQuote: (id: string) =>
    request<ApiQuote>(`/v1/quotes/${id}/follow-up`, {
      method: "POST",
      body: { channels: ["email"] }
    }),

  deleteDraftQuote: (id: string) =>
    request<{ id: string; deleted: boolean }>(`/v1/quotes/${id}/delete-draft`, {
      method: "POST"
    }),

  duplicateQuote: (id: string) =>
    request<ApiQuote>(`/v1/quotes/${id}/duplicate`, {
      method: "POST"
    }),

  reviseQuote: (id: string) =>
    request<{ quote: ApiQuote; supersededQuote: ApiQuote; revisedAt: string }>(`/v1/quotes/${id}/revise`, {
      method: "POST"
    }),

  getPublicQuote: (token: string) => request<ApiQuote>(`/public/quotes/${token}`),

  respondToPublicQuote: (token: string, action: "accept" | "decline") =>
    request<ApiQuote>(`/public/quotes/${token}/respond`, {
      method: "POST",
      body: { action }
    })
};

export function setApiAuthToken(token: string | null) {
  authAccessToken = token;
}

export function userFacingErrorMessage(error: unknown): string {
  const fallback = "Something went wrong. Try again.";

  if (!(error instanceof Error)) {
    return fallback;
  }

  const message = error.message.trim();
  const lower = message.toLowerCase();
  const validationMessage = validationErrorMessage(message);

  if (validationMessage) {
    return validationMessage;
  }

  if (
    lower.includes("permission denied") ||
    lower.includes("relation ") ||
    lower.includes("schema ") ||
    lower.includes("column ") ||
    lower.includes("postgres") ||
    lower.includes("supabase")
  ) {
    return "SnapQuote is still finishing setup. Try again in a moment.";
  }

  if (lower.includes("network request failed") || lower.includes("failed to fetch")) {
    return "Could not connect. Check your internet and try again.";
  }

  return message.length > 0 ? message : fallback;
}

function validationErrorMessage(message: string): string | null {
  if (!message.startsWith("{")) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(message);

    if (!isRecord(parsed) || !isRecord(parsed["fieldErrors"])) {
      return null;
    }

    const fields = Object.keys(parsed["fieldErrors"]);

    if (fields.includes("customer")) {
      return "Check the customer details before continuing.";
    }

    if (fields.includes("address")) {
      return "Add a job address before continuing.";
    }

    if (fields.includes("transcript") || fields.includes("typedNotes")) {
      return "Check the job notes before continuing.";
    }

    return "Check the highlighted fields before continuing.";
  } catch {
    return null;
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const requestInit: RequestInit = {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(!options.skipAuth && authAccessToken ? { Authorization: `Bearer ${authAccessToken}` } : {}),
      ...(snapquoteOrgId ? { "x-snapquote-org-id": snapquoteOrgId } : {})
    }
  };

  if (options.body !== undefined) {
    requestInit.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${apiBaseUrl}${path}`, requestInit);

  const text = await response.text();
  const data: unknown = text.length > 0 ? JSON.parse(text) : null;

  if (!response.ok) {
    const message =
      isRecord(data) && "message" in data
        ? String(data["message"])
        : `Request failed with ${response.status}`;
    throw new Error(message);
  }

  return data as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
