import { useState } from "react";
import { AlertCircle, ArrowRight, ChevronLeft, Mail } from "lucide-react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View
} from "react-native";
import Animated from "react-native-reanimated";
import Svg, { Circle, Defs, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Screen } from "../src/ui/components";
import { QuoteMark } from "../src/ui/QuoteMark";
import { fadeEnter, useMotionEnabled } from "../src/ui/motion";
import { colors } from "../src/ui/theme";
import { useAuthStore } from "../src/state/auth";

function AuthBackground() {
  const { width, height } = useWindowDimensions();

  return (
    <Svg height={height} style={StyleSheet.absoluteFillObject} width={width}>
      <Defs>
        <RadialGradient
          cx={width * 0.5}
          cy={height * 0.16}
          gradientUnits="userSpaceOnUse"
          id="glow"
          r={height * 0.42}
        >
          <Stop offset="0%" stopColor={colors.surface} stopOpacity={1} />
          <Stop offset="100%" stopColor={colors.bg} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect fill={colors.bg} height={height} width={width} />
      <Rect fill="url(#glow)" height={height} width={width} />
      <Circle cx={width * 0.86} cy={height * 0.1} fill="none" opacity={0.5} r={130} stroke={colors.border} strokeWidth={1} />
      <Circle cx={width * 0.86} cy={height * 0.1} fill="none" opacity={0.35} r={190} stroke={colors.border} strokeWidth={1} />
      <Circle cx={width * -0.06} cy={height * 0.82} fill="none" opacity={0.4} r={150} stroke={colors.greenBorder} strokeWidth={1} />
    </Svg>
  );
}

export default function AuthScreen() {
  const params = useLocalSearchParams<{ from?: string }>();
  const [email, setEmail] = useState("");
  const [showEmail, setShowEmail] = useState(false);
  const [linkSentTo, setLinkSentTo] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const status = useAuthStore((state) => state.status);
  const authError = useAuthStore((state) => state.error);
  const sendEmailLink = useAuthStore((state) => state.sendEmailLink);
  const startOAuth = useAuthStore((state) => state.startOAuth);
  const insets = useSafeAreaInsets();
  const busy = status === "loading";
  const error = localError ?? authError;
  const canDismiss = params.from === "app";

  async function submitEmailLink() {
    const trimmedEmail = email.trim();

    if (!trimmedEmail.includes("@")) {
      setLocalError("Enter a valid email address.");
      return;
    }

    setLocalError(null);

    try {
      await sendEmailLink(trimmedEmail);
      setLinkSentTo(trimmedEmail);
    } catch {
      // Store already exposes a user-safe message.
    }
  }

  async function startProvider(provider: "apple" | "google") {
    setLocalError(null);

    try {
      await startOAuth(provider);
    } catch {
      // Store already exposes a user-safe message.
    }
  }

  const motionEnabled = useMotionEnabled();

  return (
    <Screen edges={["top", "bottom"]}>
      <AuthBackground />
      {canDismiss ? (
        <Pressable
          accessibilityLabel="Back to app"
          accessibilityRole="button"
          hitSlop={10}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/");
            }
          }}
          style={[styles.dismissButton, { top: insets.top + 20 }]}
        >
          <ChevronLeft color={colors.ink} size={23} strokeWidth={2.4} />
        </Pressable>
      ) : null}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.keyboard}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.logoBox}>
              <QuoteMark size={64} />
            </View>
            <Text style={styles.brandName}>SnapQuote</Text>
            <Text style={styles.title}>Quote the job before you leave it</Text>
            <Text style={styles.subtitle}>Every price comes from your book — never guessed.</Text>
          </View>

          <View style={styles.actionsPanel}>
            <View style={styles.socialStack}>
              <SocialButton
                brand="apple"
                disabled={busy}
                label="Continue with Apple"
                onPress={() => {
                  void startProvider("apple");
                }}
              />
              <SocialButton
                brand="google"
                disabled={busy}
                label="Continue with Google"
                onPress={() => {
                  void startProvider("google");
                }}
              />
            </View>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {showEmail ? (
              <Animated.View
                {...(motionEnabled ? { entering: fadeEnter } : {})}
                style={styles.emailPanel}
              >
                <View style={styles.emailPanelHeader}>
                  <Text style={styles.emailPanelTitle}>Sign in with email</Text>
                  <Pressable accessibilityRole="button" hitSlop={10} onPress={() => setShowEmail(false)}>
                    <Text style={styles.emailPanelClose}>Cancel</Text>
                  </Pressable>
                </View>

                <AuthField
                  autoCapitalize="none"
                  autoComplete="email"
                  icon={<Mail color={colors.ink3} size={15} strokeWidth={2.1} />}
                  keyboardType="email-address"
                  label="Email address"
                  onChangeText={(value) => {
                    setEmail(value);
                    setLinkSentTo(null);
                  }}
                  placeholder="name@email.com"
                  textContentType="emailAddress"
                  value={email}
                />

                {error ? (
                  <View style={styles.errorRow}>
                    <AlertCircle color={colors.red} size={14} strokeWidth={2.2} />
                    <Text style={styles.error}>{error}</Text>
                  </View>
                ) : null}

                {linkSentTo ? (
                  <View style={styles.sentCard}>
                    <Mail color={colors.green} size={17} strokeWidth={2.2} />
                    <View style={styles.sentTextWrap}>
                      <Text style={styles.sentTitle}>Check your email</Text>
                      <Text style={styles.sentText}>We sent a sign-in link to {linkSentTo}.</Text>
                    </View>
                  </View>
                ) : null}

                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => {
                    void submitEmailLink();
                  }}
                  style={[styles.emailSubmit, busy ? styles.submitDisabled : null]}
                >
                  <Text style={styles.emailSubmitText}>{busy ? "Sending..." : "Send sign-in link"}</Text>
                  <ArrowRight color={colors.onDark} size={15} strokeWidth={2.5} />
                </Pressable>
              </Animated.View>
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={() => setShowEmail(true)}
                style={styles.emailToggle}
              >
                <Mail color={colors.ink2} size={16} strokeWidth={2.2} />
                <Text style={styles.emailToggleText}>Continue with email</Text>
              </Pressable>
            )}

            <Text style={styles.legal}>
              By continuing you agree to our <Text style={styles.legalLink}>Terms</Text> &amp;{" "}
              <Text style={styles.legalLink}>Privacy Policy</Text>.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function AuthField(props: {
  autoCapitalize?: "none" | "sentences" | "words" | "characters" | undefined;
  autoComplete?: "email" | undefined;
  icon: React.ReactNode;
  keyboardType?: "default" | "email-address" | undefined;
  label: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  textContentType?: "emailAddress" | undefined;
  value: string;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{props.label}</Text>
      <View style={styles.inputWrap}>
        {props.icon}
        <TextInput
          autoCapitalize={props.autoCapitalize ?? "words"}
          autoComplete={props.autoComplete}
          keyboardType={props.keyboardType ?? "default"}
          onChangeText={props.onChangeText}
          placeholder={props.placeholder}
          placeholderTextColor={colors.ink3}
          style={styles.input}
          textContentType={props.textContentType}
          value={props.value}
        />
      </View>
    </View>
  );
}

function SocialButton(props: {
  brand: "apple" | "google";
  disabled?: boolean | undefined;
  label: string;
  onPress: () => void;
}) {
  const apple = props.brand === "apple";

  return (
    <Pressable
      accessibilityRole="button"
      disabled={props.disabled}
      onPress={props.onPress}
      style={[styles.socialButton, apple ? styles.socialButtonDark : styles.socialButtonLight, props.disabled ? styles.disabled : null]}
    >
      {apple ? <AppleMark /> : <GoogleMark />}
      <Text style={[styles.socialText, apple ? styles.socialTextDark : styles.socialTextLight]}>{props.label}</Text>
    </Pressable>
  );
}

function AppleMark() {
  return (
    <Text style={styles.appleMark} allowFontScaling={false}>
      
    </Text>
  );
}

function GoogleMark() {
  return (
    <Svg height={17} viewBox="0 0 24 24" width={17}>
      <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z" fill="#4285F4" />
      <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z" fill="#34A853" />
      <Path d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.12-1.43.34-2.1V7.06H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.94l3.66-2.84Z" fill="#FBBC05" />
      <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.31 9.14 5.38 12 5.38Z" fill="#EA4335" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  dismissButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    left: 20,
    position: "absolute",
    width: 42,
    zIndex: 10
  },
  keyboard: {
    flex: 1
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 26,
    paddingVertical: 28
  },
  header: {
    alignItems: "center"
  },
  logoBox: {
    alignItems: "center",
    borderRadius: 17,
    height: 64,
    justifyContent: "center",
    overflow: "hidden",
    width: 64
  },
  brandName: {
    color: colors.ink2,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginTop: 12,
    textTransform: "uppercase"
  },
  title: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "700",
    marginTop: 14,
    textAlign: "center"
  },
  subtitle: {
    color: colors.ink2,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
    marginTop: 8,
    maxWidth: 300,
    textAlign: "center"
  },
  actionsPanel: {
    paddingTop: 32
  },
  socialStack: {
    gap: 11,
    marginBottom: 18
  },
  socialButton: {
    alignItems: "center",
    borderRadius: 10,
    flexDirection: "row",
    gap: 11,
    height: 48,
    justifyContent: "center"
  },
  socialButtonDark: {
    backgroundColor: colors.dark
  },
  socialButtonLight: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1
  },
  disabled: {
    opacity: 0.65
  },
  socialText: {
    fontSize: 15,
    fontWeight: "900"
  },
  socialTextDark: {
    color: colors.onDark
  },
  socialTextLight: {
    color: colors.ink
  },
  appleMark: {
    color: colors.onDark,
    fontSize: 19,
    fontWeight: "800",
    lineHeight: 20
  },
  dividerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginBottom: 16
  },
  dividerLine: {
    backgroundColor: colors.border,
    flex: 1,
    height: 1
  },
  dividerText: {
    color: colors.ink3,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  emailToggle: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    height: 48,
    justifyContent: "center"
  },
  emailToggleText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800"
  },
  emailPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
    padding: 16
  },
  emailPanelHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  emailPanelTitle: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  emailPanelClose: {
    color: colors.ink3,
    fontSize: 12,
    fontWeight: "800"
  },
  fieldWrap: {
    gap: 8
  },
  label: {
    color: colors.ink3,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.35,
    textTransform: "uppercase"
  },
  inputWrap: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 45,
    paddingHorizontal: 14
  },
  input: {
    color: colors.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    minHeight: 45,
    padding: 0
  },
  errorRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 7
  },
  error: {
    color: colors.red,
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17
  },
  sentCard: {
    alignItems: "flex-start",
    backgroundColor: colors.greenBg,
    borderColor: colors.greenBorder,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 12
  },
  sentTextWrap: {
    flex: 1,
    gap: 2
  },
  sentTitle: {
    color: colors.green,
    fontSize: 13,
    fontWeight: "900"
  },
  sentText: {
    color: colors.ink2,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17
  },
  emailSubmit: {
    alignItems: "center",
    backgroundColor: colors.dark,
    borderRadius: 10,
    flexDirection: "row",
    gap: 9,
    height: 48,
    justifyContent: "center",
    marginTop: 2
  },
  submitDisabled: {
    opacity: 0.65
  },
  emailSubmitText: {
    color: colors.onDark,
    fontSize: 14,
    fontWeight: "900"
  },
  legal: {
    color: colors.ink3,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
    marginTop: 18,
    textAlign: "center"
  },
  legalLink: {
    color: colors.ink2,
    fontWeight: "800"
  }
});
