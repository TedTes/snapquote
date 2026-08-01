import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useAuthStore } from "../../state/authStore";
import { colors } from "../../shared-ui/theme";

/**
 * Purely reactive: AuthGate (mounted at the app root) is the sole listener for the
 * OAuth redirect URL and the sole caller of completeOAuthRedirect. This screen just
 * reflects the auth store's status/error, and AuthGate handles navigating away once
 * that settles. Parsing the URL here too would race AuthGate for the same "url"
 * event and can lose it -- see the comment in AuthGate.tsx.
 */
export function AuthCallbackScreen() {
  const status = useAuthStore((state) => state.status);
  const error = useAuthStore((state) => state.error);

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
