import { useAuthStore } from "../../state/authStore";
import { AppLoadingScreen } from "../../shared-ui/ProgressExperience";

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

  if (status === "signed_out" && error) {
    return (
      <AppLoadingScreen
        helper={error}
        label="Sign in did not finish"
        delayMs={0}
        branded={false}
      />
    );
  }

  return (
    <AppLoadingScreen
      label="Getting things ready..."
    />
  );
}
