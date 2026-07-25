import { useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { snapquoteApi } from "../api/client";
import { useAuthStore } from "../auth/authStore";
import { useQuoteStore } from "../state/quoteStore";

export function useRemoteQuoteRefresh(options: { pollMs?: number } = {}) {
  const status = useAuthStore((state) => state.status);
  const upsertRemoteQuote = useQuoteStore((state) => state.upsertRemoteQuote);

  useFocusEffect(
    useCallback(() => {
      if (status !== "signed_in") {
        return;
      }

      let active = true;

      async function refresh() {
        try {
          const response = await snapquoteApi.listQuotes();

          if (!active) {
            return;
          }

          for (const quote of response.quotes) {
            upsertRemoteQuote(quote);
          }
        } catch (error) {
          console.warn("QuoteVan remote quote refresh failed", error);
        }
      }

      void refresh();

      const interval =
        options.pollMs && options.pollMs > 0
          ? setInterval(() => {
              void refresh();
            }, options.pollMs)
          : null;

      return () => {
        active = false;
        if (interval) {
          clearInterval(interval);
        }
      };
    }, [options.pollMs, status, upsertRemoteQuote])
  );
}
