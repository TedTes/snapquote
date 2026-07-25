import { useEffect, useState } from "react";
import * as AppleAuthentication from "expo-apple-authentication";
import { AlertCircle, ChevronLeft } from "lucide-react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from "react-native";
import Svg, { Circle, Defs, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Screen } from "../components/base";
import { QuoteMark } from "../components/QuoteMark";
import { colors } from "../components/theme";
import { useAuthStore } from "./authStore";

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

export default function LoginScreen() {
  const params = useLocalSearchParams<{ from?: string }>();
  const [localError, setLocalError] = useState<string | null>(null);
  const status = useAuthStore((state) => state.status);
  const authError = useAuthStore((state) => state.error);
  const signInWithNativeApple = useAuthStore((state) => state.signInWithNativeApple);
  const startOAuth = useAuthStore((state) => state.startOAuth);
  const insets = useSafeAreaInsets();
  const [appleAvailable, setAppleAvailable] = useState(Platform.OS === "ios");
  const busy = status === "loading";
  const error = localError ?? authError;
  const canDismiss = params.from === "app";

  useEffect(() => {
    if (Platform.OS !== "ios") {
      setAppleAvailable(false);
      return;
    }

    let mounted = true;

    void AppleAuthentication.isAvailableAsync().then((available) => {
      if (mounted) {
        setAppleAvailable(available);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  async function startProvider(provider: "apple" | "google") {
    setLocalError(null);

    try {
      if (provider === "apple" && Platform.OS === "ios") {
        const nonce = createAppleNonce();
        const hashedNonce = sha256Hex(nonce);
        const credential = await AppleAuthentication.signInAsync({
          nonce: hashedNonce,
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL
          ]
        });

        if (!credential.identityToken) {
          setLocalError("Could not complete sign in. Try again.");
          return;
        }

        await signInWithNativeApple({
          authorizationCode: credential.authorizationCode ?? undefined,
          email: credential.email ?? undefined,
          identityToken: credential.identityToken,
          name: appleFullName(credential.fullName),
          nonce
        });
        return;
      }

      await startOAuth(provider);
    } catch (error) {
      if (isAppleCancel(error)) {
        return;
      }
      setLocalError(error instanceof Error ? error.message : "Could not complete sign in. Try again.");
    }
  }

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
            <Text style={styles.brandName}>QuoteVan</Text>
            <Text style={styles.title}>Quote the job before you leave it</Text>
            <Text style={styles.subtitle}>Every price comes from your book — never guessed.</Text>
          </View>

          <View style={styles.actionsPanel}>
            <View style={styles.socialStack}>
              {appleAvailable ? (
                <SocialButton
                  brand="apple"
                  disabled={busy}
                  label="Continue with Apple"
                  onPress={() => {
                    void startProvider("apple");
                  }}
                />
              ) : null}
              <SocialButton
                brand="google"
                disabled={busy}
                label="Continue with Google"
                onPress={() => {
                  void startProvider("google");
                }}
              />
            </View>

            {error ? (
              <View style={styles.errorRow}>
                <AlertCircle color={colors.red} size={14} strokeWidth={2.2} />
                <Text style={styles.error}>{error}</Text>
              </View>
            ) : null}

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

function appleFullName(fullName: AppleAuthentication.AppleAuthenticationFullName | null): string | undefined {
  if (!fullName) {
    return undefined;
  }

  const name = [fullName.givenName, fullName.middleName, fullName.familyName]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join(" ")
    .trim();

  return name.length > 0 ? name : undefined;
}

function createAppleNonce(length = 32): string {
  const charset = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._";
  const bytes = randomBytes(length);

  return Array.from(bytes, (byte) => charset[byte % charset.length]).join("");
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  const maybeCrypto = (globalThis as typeof globalThis & {
    crypto?: { getRandomValues?: <T extends Uint8Array>(array: T) => T };
  }).crypto;

  if (maybeCrypto?.getRandomValues) {
    return maybeCrypto.getRandomValues(bytes);
  }

  for (let index = 0; index < length; index += 1) {
    bytes[index] = Math.floor(Math.random() * 256);
  }

  return bytes;
}

function sha256Hex(value: string): string {
  const bytes = utf8Bytes(value);
  const bitLength = bytes.length * 8;
  const paddedLength = (((bytes.length + 9 + 63) >> 6) << 6);
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;

  for (let index = 0; index < 8; index += 1) {
    padded[paddedLength - 1 - index] = (bitLength / 2 ** (index * 8)) & 0xff;
  }

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;
  const words = new Array<number>(64);

  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      const start = offset + index * 4;
      words[index] =
        ((padded[start] ?? 0) << 24) |
        ((padded[start + 1] ?? 0) << 16) |
        ((padded[start + 2] ?? 0) << 8) |
        (padded[start + 3] ?? 0);
    }

    for (let index = 16; index < 64; index += 1) {
      const word15 = words[index - 15] ?? 0;
      const word2 = words[index - 2] ?? 0;
      const s0 = rotateRight(word15, 7) ^ rotateRight(word15, 18) ^ (word15 >>> 3);
      const s1 = rotateRight(word2, 17) ^ rotateRight(word2, 19) ^ (word2 >>> 10);
      words[index] = ((words[index - 16] ?? 0) + s0 + (words[index - 7] ?? 0) + s1) | 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let index = 0; index < 64; index += 1) {
      const s1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + (sha256Constants[index] ?? 0) + (words[index] ?? 0)) | 0;
      const s0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
    h5 = (h5 + f) | 0;
    h6 = (h6 + g) | 0;
    h7 = (h7 + h) | 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((part) => (part >>> 0).toString(16).padStart(8, "0"))
    .join("");
}

function utf8Bytes(value: string): Uint8Array {
  const bytes: number[] = [];

  for (let index = 0; index < value.length; index += 1) {
    const codePoint = value.charCodeAt(index);

    if (codePoint < 0x80) {
      bytes.push(codePoint);
    } else if (codePoint < 0x800) {
      bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
    } else {
      bytes.push(0xe0 | (codePoint >> 12), 0x80 | ((codePoint >> 6) & 0x3f), 0x80 | (codePoint & 0x3f));
    }
  }

  return new Uint8Array(bytes);
}

function rotateRight(value: number, amount: number): number {
  return (value >>> amount) | (value << (32 - amount));
}

const sha256Constants = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];

function isAppleCancel(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ERR_REQUEST_CANCELED";
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
  errorRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 7,
    marginTop: 14
  },
  error: {
    color: colors.red,
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17
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
