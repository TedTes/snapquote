import { useEffect, type ReactNode } from "react";
import * as Linking from "expo-linking";
import { Redirect, router, usePathname } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { colors } from "../ui/theme";
import { useAuthStore } from "./auth";

export function AuthGate(props: { children: ReactNode }) {
  const pathname = usePathname();
  const status = useAuthStore((state) => state.status);
  const initialize = useAuthStore((state) => state.initialize);
  const completeOAuthRedirect = useAuthStore((state) => state.completeOAuthRedirect);
  const isAuthRoute = pathname === "/auth";
  const isPublicRoute = pathname.startsWith("/public-quote");

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
      void completeOAuthRedirect(url);
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [completeOAuthRedirect, initialize]);

  useEffect(() => {
    if (status === "signed_out" && !isAuthRoute && !isPublicRoute) {
      router.replace("/auth");
    }

    if (status === "signed_in" && isAuthRoute) {
      router.replace("/");
    }
  }, [isAuthRoute, isPublicRoute, status]);

  if (status === "loading") {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.ink} />
      </View>
    );
  }

  if (status === "signed_out" && !isAuthRoute && !isPublicRoute) {
    return <Redirect href="/auth" />;
  }

  return props.children;
}

const styles = StyleSheet.create({
  loading: {
    alignItems: "center",
    backgroundColor: colors.bg,
    flex: 1,
    justifyContent: "center"
  }
});
