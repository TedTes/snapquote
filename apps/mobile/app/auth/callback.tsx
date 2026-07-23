import { useEffect, useRef } from "react";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useAuthStore } from "../../src/state/auth";
import { colors } from "../../src/ui/theme";

export default function AuthCallbackScreen() {
  const currentUrl = Linking.useURL();
  const completedRef = useRef(false);
  const completeOAuthRedirect = useAuthStore((state) => state.completeOAuthRedirect);
  const status = useAuthStore((state) => state.status);
  const error = useAuthStore((state) => state.error);

  useEffect(() => {
    let mounted = true;

    async function complete() {
      if (completedRef.current) {
        return;
      }

      const url = currentUrl ?? await Linking.getInitialURL();

      if (!mounted) {
        return;
      }

      completedRef.current = true;

      if (url) {
        try {
          const handled = await completeOAuthRedirect(url);

          if (handled) {
            router.replace("/");
            return;
          }
        } catch {
          router.replace("/auth");
          return;
        }
      }

      router.replace("/auth");
    }

    void complete();

    return () => {
      mounted = false;
    };
  }, [completeOAuthRedirect, currentUrl]);

  return (
    <View style={styles.screen}>
      <ActivityIndicator color={colors.ink} />
      <Text style={styles.text}>
        {status === "signed_out" && error ? error : "Finishing sign in..."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    alignItems: "center",
    backgroundColor: colors.bg,
    flex: 1,
    gap: 12,
    justifyContent: "center",
    padding: 24,
  },
  text: {
    color: colors.ink2,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
});
