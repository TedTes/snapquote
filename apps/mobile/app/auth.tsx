import { useState } from "react";
import { AlertCircle, ArrowRight, Building2, Eye, EyeOff, Lock, Mail } from "lucide-react-native";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { Screen } from "../src/ui/components";
import { QuoteMark } from "../src/ui/QuoteMark";
import { colors } from "../src/ui/theme";
import { useAuthStore } from "../src/state/auth";

type AuthMode = "sign_in" | "sign_up";

export default function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>("sign_in");
  const [businessName, setBusinessName] = useState("Sharp Edge Painting");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const status = useAuthStore((state) => state.status);
  const authError = useAuthStore((state) => state.error);
  const signIn = useAuthStore((state) => state.signIn);
  const signUp = useAuthStore((state) => state.signUp);
  const startOAuth = useAuthStore((state) => state.startOAuth);
  const busy = status === "loading";
  const error = localError ?? authError;
  const isRegister = mode === "sign_up";

  async function submit() {
    const trimmedEmail = email.trim();
    const trimmedBusiness = businessName.trim();

    if (isRegister && trimmedBusiness.length === 0) {
      setLocalError("Enter your business name.");
      return;
    }

    if (!trimmedEmail.includes("@")) {
      setLocalError("Enter a valid email address.");
      return;
    }

    if (password.length < 8) {
      setLocalError("Password must be at least 8 characters.");
      return;
    }

    setLocalError(null);

    try {
      if (isRegister) {
        await signUp({
          email: trimmedEmail,
          password,
          name: trimmedBusiness,
          businessName: trimmedBusiness
        });
      } else {
        await signIn(trimmedEmail, password);
      }
    } catch {
      // Store already exposes a user-safe message.
    }
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setLocalError(null);
  }

  async function startProvider(provider: "apple" | "google") {
    setLocalError(null);

    try {
      await startOAuth(provider, {
        businessName: isRegister ? businessName.trim() : undefined,
        name: isRegister ? businessName.trim() : undefined
      });
    } catch {
      // Store already exposes a user-safe message.
    }
  }

  return (
    <Screen edges={["top", "bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.keyboard}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.brandBlock}>
            <View style={styles.logoBox}>
              <QuoteMark boxed size={54} />
            </View>
            <Text style={styles.brandName}>SnapQuote</Text>
          </View>

          <View style={styles.hero}>
            <Text style={styles.title}>{isRegister ? "Create your account" : "Welcome back"}</Text>
            <Text style={styles.subtitle}>
              {isRegister ? "Start sending quotes today." : "Same-day quotes, priced from your book."}
            </Text>
          </View>

          <View style={styles.socialStack}>
            <SocialButton
              brand="apple"
              label={isRegister ? "Sign up with Apple" : "Continue with Apple"}
              onPress={() => {
                void startProvider("apple");
              }}
            />
            <SocialButton
              brand="google"
              label={isRegister ? "Sign up with Google" : "Continue with Google"}
              onPress={() => {
                void startProvider("google");
              }}
            />
          </View>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or use email</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.form}>
            {isRegister ? (
              <AuthField
                autoComplete="organization"
                icon={<Building2 color={colors.ink3} size={15} strokeWidth={2.1} />}
                label="Business name"
                onChangeText={setBusinessName}
                placeholder="Sharp Edge Painting"
                value={businessName}
              />
            ) : null}

            <AuthField
              autoCapitalize="none"
              autoComplete="email"
              icon={<Mail color={colors.ink3} size={15} strokeWidth={2.1} />}
              keyboardType="email-address"
              label="Email"
              onChangeText={setEmail}
              placeholder="name@email.com"
              textContentType="emailAddress"
              value={email}
            />

            <AuthField
              autoCapitalize="none"
              autoComplete={isRegister ? "new-password" : "current-password"}
              icon={<Lock color={colors.ink3} size={15} strokeWidth={2.1} />}
              label="Password"
              onChangeText={setPassword}
              placeholder={isRegister ? "8+ characters" : "••••••••"}
              right={
                <Pressable
                  accessibilityLabel={passwordVisible ? "Hide password" : "Show password"}
                  accessibilityRole="button"
                  hitSlop={10}
                  onPress={() => setPasswordVisible((value) => !value)}
                >
                  {passwordVisible ? (
                    <EyeOff color={colors.ink3} size={15} strokeWidth={2} />
                  ) : (
                    <Eye color={colors.ink3} size={15} strokeWidth={2} />
                  )}
                </Pressable>
              }
              secureTextEntry={!passwordVisible}
              textContentType={isRegister ? "newPassword" : "password"}
              value={password}
            />

            {!isRegister ? (
              <Pressable accessibilityRole="button" onPress={() => Alert.alert("Forgot password", "Password reset is coming next.")}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </Pressable>
            ) : null}

            {error ? (
              <View style={styles.errorRow}>
                <AlertCircle color={colors.red} size={14} strokeWidth={2.2} />
                <Text style={styles.error}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => {
                void submit();
              }}
              style={[styles.submit, busy ? styles.submitDisabled : null]}
            >
              <Text style={styles.submitText}>{busy ? "Working..." : isRegister ? "Create account" : "Sign in"}</Text>
              <ArrowRight color={colors.onDark} size={16} strokeWidth={2.5} />
            </Pressable>
          </View>

          {isRegister ? (
            <>
              <Text style={styles.legal}>
                By continuing you agree to the <Text style={styles.legalStrong}>Terms</Text> and{" "}
                <Text style={styles.legalStrong}>Privacy Policy</Text>.
              </Text>
              <Text style={styles.lockCopy}>No guessed prices — ever</Text>
            </>
          ) : null}

          <View style={styles.bottomSwitch}>
            <Text style={styles.switchMuted}>{isRegister ? "Already have an account?" : "New here?"}</Text>
            <Pressable accessibilityRole="button" onPress={() => switchMode(isRegister ? "sign_in" : "sign_up")}>
              <Text style={styles.switchLink}>{isRegister ? "Sign in" : "Create account"}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function AuthField(props: {
  autoCapitalize?: "none" | "sentences" | "words" | "characters" | undefined;
  autoComplete?: "email" | "organization" | "new-password" | "current-password" | undefined;
  icon: React.ReactNode;
  keyboardType?: "default" | "email-address" | undefined;
  label: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  right?: React.ReactNode;
  secureTextEntry?: boolean | undefined;
  textContentType?: "emailAddress" | "password" | "newPassword" | undefined;
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
          secureTextEntry={props.secureTextEntry ?? false}
          style={styles.input}
          textContentType={props.textContentType}
          value={props.value}
        />
        {props.right}
      </View>
    </View>
  );
}

function SocialButton(props: { brand: "apple" | "google"; label: string; onPress: () => void }) {
  const apple = props.brand === "apple";

  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onPress}
      style={[styles.socialButton, apple ? styles.socialButtonDark : styles.socialButtonLight]}
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
  keyboard: {
    flex: 1
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 26,
    paddingTop: 58,
    paddingBottom: 10
  },
  brandBlock: {
    alignItems: "center",
    gap: 12,
    marginBottom: 27
  },
  logoBox: {
    alignItems: "center",
    borderRadius: 13,
    overflow: "hidden",
    height: 54,
    justifyContent: "center",
    width: 54
  },
  brandName: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "900"
  },
  hero: {
    alignItems: "center",
    gap: 8,
    marginBottom: 26
  },
  title: {
    color: colors.ink,
    fontSize: 23,
    fontWeight: "900",
    letterSpacing: 0,
    textAlign: "center"
  },
  subtitle: {
    color: colors.ink2,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center"
  },
  socialStack: {
    gap: 11
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
    gap: 12,
    marginVertical: 23
  },
  dividerLine: {
    backgroundColor: colors.border,
    flex: 1,
    height: 1
  },
  dividerText: {
    color: colors.ink3,
    fontSize: 11,
    fontWeight: "700"
  },
  form: {
    gap: 13
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
    paddingHorizontal: 13
  },
  input: {
    color: colors.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    minWidth: 0
  },
  forgotText: {
    alignSelf: "flex-end",
    color: colors.ink2,
    fontSize: 12,
    fontWeight: "800",
    marginTop: -2
  },
  errorRow: {
    alignItems: "center",
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
  submit: {
    alignItems: "center",
    backgroundColor: colors.dark,
    borderRadius: 10,
    flexDirection: "row",
    gap: 10,
    height: 48,
    justifyContent: "center",
    marginTop: 8
  },
  submitDisabled: {
    opacity: 0.65
  },
  submitText: {
    color: colors.onDark,
    fontSize: 15,
    fontWeight: "900"
  },
  legal: {
    color: colors.ink3,
    fontSize: 10,
    fontWeight: "600",
    lineHeight: 15,
    marginTop: 14,
    textAlign: "center"
  },
  legalStrong: {
    color: colors.ink2,
    fontWeight: "900"
  },
  lockCopy: {
    color: colors.ink3,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 18,
    textAlign: "center"
  },
  bottomSwitch: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
    justifyContent: "center",
    marginTop: "auto",
    paddingTop: 28
  },
  switchMuted: {
    color: colors.ink2,
    fontSize: 13,
    fontWeight: "600"
  },
  switchLink: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900"
  }
});
