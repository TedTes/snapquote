import { useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { snapquoteApi, userFacingErrorMessage } from "../api/client";
import { useAuthStore } from "../state/authStore";
import { useRequestStore } from "../state/requestStore";

export function useRemoteRequestRefresh(options: { pollMs?: number } = {}) {
  const status = useAuthStore((state) => state.status);
  const setRequests = useRequestStore((state) => state.setRequests);
  const setLoading = useRequestStore((state) => state.setLoading);
  const setError = useRequestStore((state) => state.setError);

  useFocusEffect(
    useCallback(() => {
      if (status !== "signed_in") return;

      let active = true;

      async function refresh(showLoading = false) {
        if (showLoading) setLoading(true);

        try {
          const response = await snapquoteApi.listRequests();
          if (active) setRequests(response.requests);
        } catch (error) {
          if (active) {
            setLoading(false);
            setError(userFacingErrorMessage(error));
          }
        }
      }

      void refresh(true);
      const interval = options.pollMs && options.pollMs > 0
        ? setInterval(() => void refresh(), options.pollMs)
        : null;

      return () => {
        active = false;
        if (interval) clearInterval(interval);
      };
    }, [options.pollMs, setError, setLoading, setRequests, status])
  );
}
