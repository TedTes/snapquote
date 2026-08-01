import { File, Paths } from "expo-file-system";
import * as Linking from "expo-linking";
import { deriveCustomerCity } from "@snapquote/shared";
import type {
  Customer,
  PriceBookItem,
  QuoteLineItem,
} from "@snapquote/shared";
import { create } from "zustand";
import {
  setApiAuthToken,
  setApiAuthTokenProvider,
  snapquoteApi,
  userFacingErrorMessage,
  type ApiCustomer,
  type ApiQuote,
  type AuthResponse,
  type OAuthProvider,
  type AuthSession,
  type MeResponse
} from "../api/client";
import {
  corePricesFromPriceBook,
  useQuoteStore,
  type QuoteRecord,
} from "./quoteStore";
import { quoteCustomerIdForSync } from "../sync/quoteSync";

type AuthStatus = "loading" | "signed_out" | "signed_in";

type AuthState = {
  status: AuthStatus;
  session: AuthSession | null;
  me: MeResponse | null;
  error: string | null;
  initialize: () => Promise<void>;
  completeOAuthRedirect: (url: string) => Promise<boolean>;
  setMe: (me: MeResponse) => void;
  signInWithNativeApple: (input: {
    identityToken: string;
    authorizationCode?: string | undefined;
    email?: string | undefined;
    name?: string | undefined;
    businessName?: string | undefined;
    nonce?: string | undefined;
  }) => Promise<void>;
  startOAuth: (provider: OAuthProvider, input?: { businessName?: string | undefined; name?: string | undefined }) => Promise<void>;
  signOut: () => void;
};

const sessionFileName = "snapquote-session.json";
let initializePromise: Promise<void> | null = null;
let authSessionRefreshPromise: Promise<AuthSession | null> | null = null;
let pendingOAuthInput: { businessName?: string | undefined; name?: string | undefined } = {};

export const useAuthStore = create<AuthState>((set) => ({
  status: "loading",
  session: null,
  me: null,
  error: null,

  initialize: async () => {
    if (initializePromise) {
      return initializePromise;
    }

    initializePromise = (async () => {
      const storedSession = await readStoredSession();

      if (!storedSession) {
        setApiAuthToken(null);
        set({ status: "signed_out", session: null, me: null, error: null });
        return;
      }

      try {
        const session =
          shouldRefresh(storedSession)
            ? (await snapquoteApi.refreshSession({ refreshToken: storedSession.refreshToken })).session
            : storedSession;

        setApiAuthToken(session.accessToken);
        writeStoredSession(session);
        const me = await bootstrapRemoteData();
        set({ status: "signed_in", session, me, error: null });
      } catch (error) {
        clearStoredSession();
        setApiAuthToken(null);
        set({ status: "signed_out", session: null, me: null, error: userFacingErrorMessage(error) });
      }
    })();

    try {
      await initializePromise;
    } finally {
      initializePromise = null;
    }
  },

  completeOAuthRedirect: async (url) => {
    const result = oauthSessionFromUrl(url);
    authDiag("callback url:", redactCallbackUrl(url), "parsed as:", result.type);

    if (result.type === "ignore") {
      return false;
    }

    if (result.type === "error") {
      authDiag("callback rejected:", result.message);
      set({ status: "signed_out", session: null, me: null, error: result.message });
      return true;
    }

    set({ status: "loading", error: null });

    try {
      const response = await snapquoteApi.completeOAuth({
        ...result.session,
        ...pendingOAuthInput
      });
      pendingOAuthInput = {};
      await applyAuthResponse(response, set);
      authDiag("completeOAuth succeeded");
    } catch (error) {
      const message = userFacingErrorMessage(error);
      authDiag("completeOAuth failed:", message);
      set({ status: "signed_out", session: null, me: null, error: message });
      throw new Error(message);
    }

    return true;
  },

  setMe: (me) => {
    set({ me });
  },

  signInWithNativeApple: async (input) => {
    set({ status: "loading", error: null });

    try {
      const response = await snapquoteApi.completeNativeOAuth({
        provider: "apple",
        ...input
      });
      await applyAuthResponse(response, set);
    } catch (error) {
      const message = userFacingErrorMessage(error);
      console.warn("SnapQuote native Apple sign-in failed", error);
      set({ status: "signed_out", session: null, me: null, error: message });
      throw new Error(message);
    }
  },

  startOAuth: async (provider, input = {}) => {
    set({ status: "loading", error: null });

    try {
      pendingOAuthInput = input;
      const redirectTo = Linking.createURL("auth/callback");
      authDiag("redirectTo:", redirectTo);
      const response = await snapquoteApi.startOAuth({ provider, redirectTo });
      await Linking.openURL(response.url);
      set({ status: "signed_out", session: null, me: null, error: null });
    } catch (error) {
      pendingOAuthInput = {};
      const message = userFacingErrorMessage(error);
      set({ status: "signed_out", session: null, me: null, error: message });
      throw new Error(message);
    }
  },

  signOut: () => {
    clearStoredSession();
    setApiAuthToken(null);
    set({ status: "signed_out", session: null, me: null, error: null });
  }
}));

setApiAuthTokenProvider(provideApiAuthToken);

async function applyAuthResponse(
  response: AuthResponse,
  set: (patch: Pick<AuthState, "status" | "session" | "me" | "error">) => void
) {
  setApiAuthToken(response.session.accessToken);
  writeStoredSession(response.session);
  const me = await bootstrapRemoteData(response.me);
  set({ status: "signed_in", session: response.session, me, error: null });
}

async function bootstrapRemoteData(meOverride?: MeResponse) {
  const syncedMe = await syncLocalSetupIfNeeded(meOverride ?? await snapquoteApi.me());
  let [priceBook, customers, quotes] = await fetchRemoteSnapshot();

  const didSyncLocalData = await syncLocalDataAfterLogin({
    priceBookItems: priceBook.items,
    customers: customers.customers,
    quotes: quotes.quotes,
  });

  if (didSyncLocalData) {
    [priceBook, customers, quotes] = await fetchRemoteSnapshot();
  }

  useQuoteStore.getState().hydrateRemoteState({
    me: syncedMe,
    priceBookItems: priceBook.items,
    customers: customers.customers,
    quotes: quotes.quotes
  });

  return syncedMe;
}

async function fetchRemoteSnapshot() {
  return Promise.all([
    snapquoteApi.listPriceBook(),
    snapquoteApi.listCustomers(),
    snapquoteApi.listQuotes()
  ]);
}

async function syncLocalSetupIfNeeded(me: MeResponse): Promise<MeResponse> {
  if (me.org.setupCompletedAt) {
    return me;
  }

  const local = useQuoteStore.getState();

  if (!local.onboarded) {
    return me;
  }

  const response = await snapquoteApi.onboardPainter({
    businessName: local.businessName.trim(),
    defaultTaxRate: local.defaultTaxRate,
    defaultTerms: local.defaultTerms,
    quoteValidDays: local.quoteValidDays,
    corePrices: corePricesFromPriceBook(local.priceBookItems)
  });

  return {
    ...me,
    org: {
      ...response.org,
      setupCompletedAt: response.org.setupCompletedAt ?? new Date().toISOString()
    }
  };
}

async function syncLocalDataAfterLogin(input: {
  priceBookItems: PriceBookItem[];
  customers: ApiCustomer[];
  quotes: ApiQuote[];
}) {
  const local = useQuoteStore.getState();
  const localPriceBookItems = local.priceBookItems.filter((item) =>
    isLocalPriceBookItem(item),
  );
  const localCustomers = local.customers.filter((customer) =>
    isLocalCustomer(customer),
  );
  const localQuotes = local.quotes.filter((quote) => isLocalQuote(quote));

  if (
    localPriceBookItems.length === 0 &&
    localCustomers.length === 0 &&
    localQuotes.length === 0
  ) {
    return false;
  }

  const syncedPriceBookItemIds: string[] = [];
  const syncedCustomerIds: string[] = [];
  const syncedQuoteIds: string[] = [];
  const customerIdMap = new Map<string, string>();
  const priceBookByKey = new Map(
    input.priceBookItems
      .filter((item) => item.key !== null)
      .map((item) => [item.key as string, item]),
  );

  for (const item of localPriceBookItems) {
    try {
      const remoteItem = item.key !== null ? priceBookByKey.get(item.key) : undefined;

      if (remoteItem) {
        await snapquoteApi.updatePriceBookItem(remoteItem.id, {
          name: item.name,
          description: item.description,
          pricing: item.pricing,
          confirmed: item.confirmedAt !== null,
        });
      } else {
        await snapquoteApi.createPriceBookItem({
          name: item.name,
          description: item.description,
          unit: item.unit,
          kind: item.kind,
          pricing: item.pricing,
          confirmed: item.confirmedAt !== null,
        });
      }

      syncedPriceBookItemIds.push(item.id);
    } catch (error) {
      console.warn("QuoteVan local price book sync skipped", userFacingErrorMessage(error));
    }
  }

  for (const customer of localCustomers) {
    try {
      const remoteCustomer = await snapquoteApi.createCustomer({
        name: customer.name,
        email: customer.email ?? undefined,
        phone: customer.phone,
        address: customer.address,
        city: customer.city || deriveCustomerCity(customer.address),
      });
      customerIdMap.set(customer.id, remoteCustomer.id);
      syncedCustomerIds.push(customer.id);
    } catch (error) {
      console.warn("QuoteVan local customer sync skipped", userFacingErrorMessage(error));
    }
  }

  for (const quote of localQuotes) {
    const customerId = quoteCustomerIdForSync({
      quoteCustomerId: quote.customerId,
      customerIdMap,
    });

    if (customerId === null) {
      continue;
    }

    try {
      const created = await snapquoteApi.createQuote({
        customerId,
        address: quote.address,
        workType: quote.workType,
        jobTitle: quote.jobTitle,
        checklist: quote.checklist,
        transcript: quote.transcript,
        typedNotes: quote.notes,
        audioStoragePath: quote.audioStoragePath,
        audioContentType: quote.audioContentType,
        audioDurationSeconds: quote.audioDurationSeconds,
      });

      await snapquoteApi.patchQuote(created.id, {
        lineItems: quote.lineItems.map(lineItemForSync),
        discount: quote.discount,
        taxRate: quote.taxRate,
        notes: quote.notes,
        terms: quote.terms,
        validUntil: quote.validUntil,
      });

      syncedQuoteIds.push(quote.id);
    } catch (error) {
      console.warn("QuoteVan local quote sync skipped", userFacingErrorMessage(error));
    }
  }

  useQuoteStore.getState().removeLocalSyncArtifacts({
    customerIds: syncedCustomerIds,
    priceBookItemIds: syncedPriceBookItemIds,
    quoteIds: syncedQuoteIds,
  });

  return (
    syncedPriceBookItemIds.length > 0 ||
    syncedCustomerIds.length > 0 ||
    syncedQuoteIds.length > 0
  );
}

function isLocalCustomer(customer: Customer) {
  return isLocalCustomerId(customer.id);
}

function isLocalCustomerId(id: string) {
  return id.startsWith("cust-");
}

function isLocalQuote(quote: QuoteRecord) {
  return quote.id.startsWith("quote-");
}

function isLocalPriceBookItem(item: PriceBookItem) {
  return item.id.startsWith("pbi-") && !item.starter;
}

function lineItemForSync(line: QuoteRecord["lineItems"][number]): QuoteLineItem {
  const { id: _id, ...lineItem } = line;
  return lineItem;
}

function shouldRefresh(session: AuthSession) {
  const expiresAtMs = session.expiresAt * 1000;
  return expiresAtMs - Date.now() < 5 * 60 * 1000;
}

async function provideApiAuthToken() {
  const state = useAuthStore.getState();
  const session = state.session ?? await readStoredSession();

  if (!session) {
    setApiAuthToken(null);
    return null;
  }

  if (!shouldRefresh(session)) {
    setApiAuthToken(session.accessToken);

    if (!state.session && state.status !== "loading") {
      useAuthStore.setState({ status: "signed_in", session, error: null });
    }

    return session.accessToken;
  }

  authSessionRefreshPromise ??= refreshStoredSession(session);
  const refreshedSession = await authSessionRefreshPromise;
  return refreshedSession?.accessToken ?? null;
}

async function refreshStoredSession(session: AuthSession) {
  try {
    const response = await snapquoteApi.refreshSession({
      refreshToken: session.refreshToken,
    });

    setApiAuthToken(response.session.accessToken);
    writeStoredSession(response.session);
    useAuthStore.setState({
      status: "signed_in",
      session: response.session,
      error: null,
    });

    return response.session;
  } catch {
    clearStoredSession();
    setApiAuthToken(null);
    useAuthStore.setState({
      status: "signed_out",
      session: null,
      me: null,
      error: "Your session expired. Sign in again.",
    });

    return null;
  } finally {
    authSessionRefreshPromise = null;
  }
}

function oauthSessionFromUrl(url: string):
  | { type: "ignore" }
  | { type: "error"; message: string }
  | {
      type: "session";
      session: {
        accessToken: string;
        refreshToken: string;
        expiresAt: number;
        provider?: OAuthProvider | undefined;
      };
    } {
  if (!isOAuthReturnUrl(url)) {
    return { type: "ignore" };
  }

  const params = paramsFromUrl(url);
  const errorDescription = params.get("error_description") ?? params.get("error");

  if (errorDescription) {
    return { type: "error", message: "Could not complete sign in. Try again." };
  }

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");

  if (!accessToken || !refreshToken) {
    if (params.get("code")) {
      // The edge function's Supabase client is configured with flowType: "implicit"
      // (see infra/supabase/functions/snapquote/index.ts getDb()), so this should not
      // happen. Surfaced distinctly so a future flow-type drift is diagnosable
      // instead of looking identical to a generic parse failure.
      authDiag("callback returned a PKCE code, not tokens -- unexpected with implicit flow");
    }

    return { type: "error", message: "Could not complete sign in. Try again." };
  }

  const expiresAtParam = params.get("expires_at");
  const expiresInParam = params.get("expires_in");
  const expiresAt = expiresAtParam
    ? Number.parseInt(expiresAtParam, 10)
    : Math.floor(Date.now() / 1000) + Number.parseInt(expiresInParam ?? "3600", 10);
  const providerParam = params.get("provider");
  const provider = providerParam === "apple" || providerParam === "google" ? providerParam : undefined;

  return {
    type: "session",
    session: {
      accessToken,
      refreshToken,
      expiresAt,
      provider
    }
  };
}

function isOAuthReturnUrl(url: string) {
  const lowerUrl = url.toLowerCase();
  return lowerUrl.includes("auth/callback") || lowerUrl.includes("://auth") || lowerUrl.includes("/--/auth");
}

function authDiag(...args: unknown[]) {
  if (__DEV__) {
    console.info("SnapQuote [diag]", ...args);
  }
}

/** Logs URL shape and param key names only -- never token values. */
function redactCallbackUrl(url: string): string {
  try {
    const [withoutHash = "", hash] = url.split("#");
    const [base, query] = withoutHash.split("?");
    const queryKeys = query ? Array.from(new URLSearchParams(query).keys()) : [];
    const hashKeys = hash ? Array.from(new URLSearchParams(hash).keys()) : [];
    return `${base} queryKeys=[${queryKeys.join(",")}] hashKeys=[${hashKeys.join(",")}]`;
  } catch {
    return "(unparseable url)";
  }
}

function paramsFromUrl(url: string) {
  const params = new URLSearchParams();

  for (const chunk of [url.split("?")[1]?.split("#")[0], url.split("#")[1]]) {
    if (!chunk) {
      continue;
    }

    const chunkParams = new URLSearchParams(chunk);
    chunkParams.forEach((value, key) => {
      params.set(key, value);
    });
  }

  return params;
}

async function readStoredSession() {
  try {
    const file = sessionFile();

    if (!file.exists) {
      return null;
    }

    const value = await file.text();
    const parsed = JSON.parse(value) as Partial<AuthSession>;

    if (
      typeof parsed.accessToken === "string" &&
      typeof parsed.refreshToken === "string" &&
      typeof parsed.expiresAt === "number"
    ) {
      return parsed as AuthSession;
    }
  } catch {
    clearStoredSession();
  }

  return null;
}

function writeStoredSession(session: AuthSession) {
  const file = sessionFile();

  if (!file.exists) {
    file.create({ intermediates: true, overwrite: true });
  }

  file.write(JSON.stringify(session));
}

function clearStoredSession() {
  try {
    const file = sessionFile();

    if (file.exists) {
      file.delete();
    }
  } catch {
    // Best effort cleanup; auth state is still cleared in memory.
  }
}

function sessionFile() {
  return new File(Paths.document, sessionFileName);
}
