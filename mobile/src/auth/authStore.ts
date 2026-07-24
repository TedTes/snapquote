import { File, Paths } from "expo-file-system";
import * as Linking from "expo-linking";
import { create } from "zustand";
import {
  setApiAuthToken,
  snapquoteApi,
  userFacingErrorMessage,
  type AuthResponse,
  type OAuthProvider,
  type AuthSession,
  type MeResponse
} from "../api/client";
import { corePricesFromPriceBook, useQuoteStore } from "../state/quoteStore";

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
  const [priceBook, customers, quotes] = await Promise.all([
    snapquoteApi.listPriceBook(),
    snapquoteApi.listCustomers(),
    snapquoteApi.listQuotes()
  ]);

  useQuoteStore.getState().hydrateRemoteState({
    me: syncedMe,
    priceBookItems: priceBook.items,
    customers: customers.customers,
    quotes: quotes.quotes
  });

  return syncedMe;
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

function shouldRefresh(session: AuthSession) {
  const expiresAtMs = session.expiresAt * 1000;
  return expiresAtMs - Date.now() < 5 * 60 * 1000;
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
