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
} from "../lib/api";
import { useMvpStore } from "./mvp";

type AuthStatus = "loading" | "signed_out" | "signed_in";

type SignUpInput = {
  email: string;
  password: string;
  name: string;
  businessName: string;
};

type AuthState = {
  status: AuthStatus;
  session: AuthSession | null;
  me: MeResponse | null;
  error: string | null;
  initialize: () => Promise<void>;
  completeOAuthRedirect: (url: string) => Promise<boolean>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
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

    if (result.type === "ignore") {
      return false;
    }

    if (result.type === "error") {
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
    } catch (error) {
      const message = userFacingErrorMessage(error);
      set({ status: "signed_out", session: null, me: null, error: message });
      throw new Error(message);
    }

    return true;
  },

  signIn: async (email, password) => {
    set({ status: "loading", error: null });

    try {
      const response = await snapquoteApi.signIn({ email: email.trim(), password });
      await applyAuthResponse(response, set);
    } catch (error) {
      const message = userFacingErrorMessage(error);
      set({ status: "signed_out", session: null, me: null, error: message });
      throw new Error(message);
    }
  },

  signUp: async (input) => {
    set({ status: "loading", error: null });

    try {
      const response = await snapquoteApi.signUp({
        email: input.email.trim(),
        password: input.password,
        name: input.name.trim(),
        businessName: input.businessName.trim()
      });
      await applyAuthResponse(response, set);
    } catch (error) {
      const message = userFacingErrorMessage(error);
      set({ status: "signed_out", session: null, me: null, error: message });
      throw new Error(message);
    }
  },

  startOAuth: async (provider, input = {}) => {
    set({ status: "loading", error: null });

    try {
      pendingOAuthInput = input;
      const redirectTo = Linking.createURL("auth/callback");
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
  const [me, priceBook, customers, quotes] = await Promise.all([
    meOverride ? Promise.resolve(meOverride) : snapquoteApi.me(),
    snapquoteApi.listPriceBook(),
    snapquoteApi.listCustomers(),
    snapquoteApi.listQuotes()
  ]);

  useMvpStore.getState().hydrateRemoteState({
    me,
    priceBookItems: priceBook.items,
    customers: customers.customers,
    quotes: quotes.quotes
  });

  return me;
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
  if (!url.includes("auth/callback")) {
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
