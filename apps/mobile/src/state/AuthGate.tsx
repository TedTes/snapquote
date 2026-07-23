import { useEffect, type ReactNode } from "react";
import { router, usePathname } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { colors } from "../ui/theme";
import { useAuthStore } from "./auth";

export function AuthGate(props: { children: ReactNode }) {
  const pathname = usePathname();
  const status = useAuthStore((state) => state.status);
  const me = useAuthStore((state) => state.me);
  const initialize = useAuthStore((state) => state.initialize);
  const isAuthRoute = pathname === "/auth";
  const isOnboardingRoute = pathname === "/onboarding";

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    if (status !== "signed_in") {
      return;
    }

    if (!me?.org.setupCompletedAt && !isOnboardingRoute) {
      router.replace("/onboarding");
      return;
    }

    if (isAuthRoute) {
      router.replace("/");
    }
  }, [isAuthRoute, isOnboardingRoute, me?.org.setupCompletedAt, status]);

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
