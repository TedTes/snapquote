import { useEffect, type ReactNode } from "react";
import * as Linking from "expo-linking";
import { router, usePathname } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { colors } from "../components/theme";
import { useAuthStore } from "./authStore";

export function AuthGate(props: { children: ReactNode }) {
  const pathname = usePathname();
  const status = useAuthStore((state) => state.status);
  const me = useAuthStore((state) => state.me);
  const initialize = useAuthStore((state) => state.initialize);
  const completeOAuthRedirect = useAuthStore((state) => state.completeOAuthRedirect);
  const isAuthRoute = pathname === "/auth";
  const isOnboardingRoute = pathname === "/onboarding";
  const isCallbackRoute = pathname === "/auth/callback";

  // This listener must live here, mounted once at the app root, rather than in the
  // callback screen itself. The OAuth redirect's "url" event fires the moment the
  // app resumes from the browser -- before Expo Router has finished navigating to
  // (and mounting) the callback screen. A listener registered inside that screen's
  // own effect subscribes too late to catch it, so the URL (and the session tokens
  // in it) is silently lost and the app falls back to /auth.
  useEffect(() => {
    let mounted = true;

    void Linking.getInitialURL().then(async (url) => {
      if (!mounted) {
        return;
      }

      if (url && (await completeOAuthRedirect(url))) {
        return;
      }

      await initialize();
    });

    const subscription = Linking.addEventListener("url", ({ url }) => {
      void completeOAuthRedirect(url).catch(() => {
        // completeOAuthRedirect already records a user-safe error in the store.
      });
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [completeOAuthRedirect, initialize]);

  useEffect(() => {
    if (status === "signed_out" && isCallbackRoute) {
      router.replace("/auth");
      return;
    }

    if (status !== "signed_in") {
      return;
    }

    if (!me?.org.setupCompletedAt && !isOnboardingRoute) {
      router.replace("/onboarding");
      return;
    }

    if (isAuthRoute || isCallbackRoute) {
      router.replace("/");
    }
  }, [isAuthRoute, isCallbackRoute, isOnboardingRoute, me?.org.setupCompletedAt, status]);

  if (status === "loading") {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.ink} />
      </View>
    );
  }

  return props.children;
}

const styles = StyleSheet.create({
  loading: {
    alignItems: "center",
    backgroundColor: colors.bg,
    flex: 1,
    justifyContent: "center",
  },
});
