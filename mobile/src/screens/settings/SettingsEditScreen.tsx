import { useState, type ReactNode } from "react";
import { File } from "expo-file-system";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import {
  Building2,
  Camera,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  CreditCard,
  EllipsisVertical,
  LogIn,
  LogOut,
  Mail,
  Phone,
  Pencil,
  Shield,
  User
} from "lucide-react-native";
import { Alert, Image, NativeModules, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { formatMonthlyPlanPrice, getTradeConfig, quoteVanPlan } from "@snapquote/shared";
import { snapquoteApi, userFacingErrorMessage } from "../../api/client";
import { useAuthStore } from "../../state/authStore";
import { getQuoteStatus, useQuoteStore } from "../../state/quoteStore";
import { displayBusinessName } from "../../utils/format";
import { QuoteMark } from "../../shared-ui/QuoteMark";
import { Screen } from "../../shared-ui/base";
import { colors, radius } from "../../shared-ui/theme";
import { contactEmails, mailtoUrl } from "../../config/contact";

type ImagePickerModule = typeof import("expo-image-picker");
type ExpoNativeGlobal = typeof globalThis & {
  expo?: {
    modules?: Record<string, unknown>;
  };
};
type LegacyNativeProxy = {
  exportedMethods?: Record<string, unknown>;
  modulesConstants?: Record<string, unknown>;
};

export default function ProfileScreen() {
  const businessName = useQuoteStore((state) => state.businessName);
  const activeTrade = useQuoteStore((state) => state.activeTrade);
  const quotes = useQuoteStore((state) => state.quotes);
  const events = useQuoteStore((state) => state.events);
  const me = useAuthStore((state) => state.me);
  const authStatus = useAuthStore((state) => state.status);
  const setMe = useAuthStore((state) => state.setMe);
  const signOut = useAuthStore((state) => state.signOut);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const statuses = quotes.map((quote) => getQuoteStatus(quote, events));
  const sentCount = statuses.filter((status) => status === "sent" || status === "viewed" || status === "accepted").length;
  const acceptedCount = statuses.filter((status) => status === "accepted").length;
  const winRate = sentCount > 0 ? Math.round((acceptedCount / sentCount) * 100) : 0;
  const userName = me?.user.name ?? "Guest";
  const email = me?.user.email ?? "Not signed in";
  const logoUrl = me?.org.logoUrl ?? null;
  const contactDetail = contactSummary(me?.org.contactPhone ?? null, me?.org.website ?? null);
  const tradeConfig = getTradeConfig(activeTrade);
  const plan = me?.billing?.plan ?? quoteVanPlan(me?.org.plan);
  const planDetail = authStatus === "signed_in"
    ? plan.detail
    : "Sign in to start the 14-day trial";
  const subscriptionDetail = authStatus === "signed_in"
    ? `${plan.name} · ${formatMonthlyPlanPrice(plan.monthlyPriceCents)}`
    : "Free trial, then Solo early access";

  async function uploadLogo() {
    if (authStatus !== "signed_in") {
      router.push({ pathname: "/auth", params: { from: "app" } });
      return;
    }

    if (uploadingLogo) {
      return;
    }

    try {
      const ImagePicker = await loadImagePicker();

      if (!ImagePicker) {
        Alert.alert(
          "Logo upload unavailable",
          "This app build does not include photo picking yet. Rebuild the app after installing expo-image-picker."
        );
        return;
      }

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert("Photo access needed", "Allow photo access to upload a business logo.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        mediaTypes: ["images"],
        quality: 0.8
      });

      if (result.canceled || !result.assets[0]) {
        return;
      }

      setUploadingLogo(true);
      const asset = result.assets[0];
      const file = new File(asset.uri);
      const base64 = await file.base64();
      const contentType = normalizeImageContentType(asset.mimeType);
      const response = await snapquoteApi.uploadAvatar({
        fileName: asset.fileName ?? "business-logo.jpg",
        contentType,
        base64
      });

      if (me) {
        setMe({ ...me, org: response.org });
      }
    } catch (error) {
      Alert.alert("Could not upload logo", userFacingErrorMessage(error));
    } finally {
      setUploadingLogo(false);
    }
  }

  async function openFeedback() {
    const url = mailtoUrl(contactEmails.support, {
      subject: "QuoteVan feedback",
      body: `Account: ${email}\n\n`
    });
    const canOpen = await Linking.canOpenURL(url);

    if (canOpen) {
      await Linking.openURL(url);
      return;
    }

    Alert.alert("Help & feedback", `Email feedback to ${contactEmails.support}.`);
  }

  function confirmDeleteAccount() {
    if (authStatus !== "signed_in") {
      router.push({ pathname: "/auth", params: { from: "app" } });
      return;
    }

    Alert.alert(
      "Delete account?",
      "This deletes your QuoteVan account, business profile, price book, customers, and quotes.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void deleteAccount();
          }
        }
      ]
    );
  }

  async function deleteAccount() {
    if (deletingAccount) {
      return;
    }

    setDeletingAccount(true);

    try {
      await snapquoteApi.deleteAccount();
      signOut();
      router.replace("/");
    } catch (error) {
      Alert.alert("Could not delete account", userFacingErrorMessage(error));
    } finally {
      setDeletingAccount(false);
    }
  }

  function openProfileMenu() {
    const actions = authStatus === "signed_in"
      ? [
          { text: "Change logo", onPress: () => void uploadLogo() },
          { text: "Contact details", onPress: () => router.push("/settings/contact") },
          { text: "Manage subscription", onPress: () => router.push("/settings/billing") },
          { text: "Delete account", style: "destructive" as const, onPress: confirmDeleteAccount },
          { text: "Cancel", style: "cancel" as const }
        ]
      : [
          { text: "Sign in", onPress: () => router.push({ pathname: "/auth", params: { from: "app" } }) },
          { text: "Cancel", style: "cancel" as const }
        ];

    Alert.alert("Profile actions", undefined, actions);
  }

  return (
    <Screen edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.nav}>
          <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.back()} style={styles.navButton}>
            <ChevronLeft color={colors.ink} size={20} strokeWidth={2.4} />
          </Pressable>
          <Text style={styles.navTitle}>Profile</Text>
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={openProfileMenu}
            style={styles.navButton}
          >
            <EllipsisVertical color={colors.ink} size={20} strokeWidth={2.6} />
          </Pressable>
        </View>

        <View style={styles.hero}>
          <View style={styles.logoWrap}>
            {logoUrl ? (
              <Image source={{ uri: logoUrl }} style={styles.logoImage} />
            ) : (
              <QuoteMark boxed size={78} />
            )}
            <Pressable
              accessibilityLabel="Change business logo"
              accessibilityRole="button"
              disabled={uploadingLogo}
              onPress={() => void uploadLogo()}
              style={styles.cameraBadge}
            >
              <Camera color={colors.ink2} size={14} strokeWidth={2.2} />
            </Pressable>
          </View>
          <Text style={styles.businessName}>{displayBusinessName(businessName, "Add business name")}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.businessMeta}>{tradeConfig.businessCategory} · {tradeConfig.label}</Text>
            <Pressable
              accessibilityLabel="Edit business info"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => router.push("/settings/business")}
              style={styles.editIconButton}
            >
              <Pencil color={colors.ink2} size={13} strokeWidth={2.3} />
            </Pressable>
          </View>
        </View>

        <View style={styles.statsRow}>
          <StatCard label="Sent" value={sentCount} />
          <StatCard label="Accepted" tone="green" value={acceptedCount} />
          <StatCard label="Win rate" value={`${winRate}%`} />
        </View>

        <ProfileSection label="Business identity">
          <ProfileRow
            detail="Shown on every quote"
            icon={<Building2 color={colors.ink2} size={15} strokeWidth={2.1} />}
            label="Business name & logo"
            onPress={() => router.push("/settings/business")}
          />
          <ProfileRow
            detail={contactDetail}
            icon={<Phone color={colors.ink2} size={15} strokeWidth={2.1} />}
            label="Contact details"
            last
            onPress={() => router.push("/settings/contact")}
          />
        </ProfileSection>

        <ProfileSection label="Account">
          <ProfileRow
            customValue={<PlanBadge label={authStatus === "signed_in" ? plan.badge : "Free"} />}
            detail={planDetail}
            icon={<Shield color={colors.ink2} size={15} strokeWidth={2.1} />}
            label="Plan"
            onPress={() => router.push("/settings/billing")}
          />
          <ProfileRow
            detail={subscriptionDetail}
            icon={<CreditCard color={colors.ink2} size={15} strokeWidth={2.1} />}
            label="Manage subscription"
            last
            onPress={() => router.push("/settings/billing")}
          />
        </ProfileSection>

        <ProfileSection label="Personal & security">
          <ProfileRow
            customValue={<Text style={styles.rowValue}>{userName}</Text>}
            icon={<User color={colors.ink2} size={15} strokeWidth={2.1} />}
            label="Your name"
            onPress={() => Alert.alert("Your name", "Profile editing is coming next.")}
          />
          <ProfileRow
            customValue={authStatus === "signed_in" ? <VerifiedBadge /> : undefined}
            detail={email}
            icon={<Mail color={colors.ink2} size={15} strokeWidth={2.1} />}
            label="Login email"
            last
            onPress={() =>
              authStatus === "signed_in"
                ? Alert.alert("Login email", "Email changes are coming next.")
                : router.push({ pathname: "/auth", params: { from: "app" } })
            }
          />
        </ProfileSection>

        <ProfileSection label="More">
          <ProfileRow
            icon={<CircleHelp color={colors.ink2} size={15} strokeWidth={2.1} />}
            label="Help & feedback"
            onPress={() => void openFeedback()}
          />
          {authStatus === "signed_in" ? (
            <ProfileRow
              icon={<LogOut color={colors.ink2} size={15} strokeWidth={2.1} />}
              label="Sign out"
              last
              onPress={() => {
                Alert.alert("Sign out", "You will need to sign in again on this phone.", [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Sign out",
                    style: "destructive",
                    onPress: () => {
                      signOut();
                      router.replace("/");
                    }
                  }
                ]);
              }}
              showChevron={false}
            />
          ) : (
            <ProfileRow
              icon={<LogIn color={colors.ink2} size={15} strokeWidth={2.1} />}
              label="Sign in"
              last
              onPress={() => router.push({ pathname: "/auth", params: { from: "app" } })}
            />
          )}
        </ProfileSection>

        <Text style={styles.version}>QuoteVan · v0.4.1</Text>
      </ScrollView>
    </Screen>
  );
}

function StatCard(props: { label: string; value: number | string; tone?: "green" | undefined }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, props.tone === "green" ? styles.statValueGreen : null]}>
        {props.value}
      </Text>
      <Text style={styles.statLabel}>{props.label}</Text>
    </View>
  );
}

function ProfileSection(props: { label: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{props.label}</Text>
      <View style={styles.sectionCard}>{props.children}</View>
    </View>
  );
}

function ProfileRow(props: {
  icon: ReactNode;
  label: string;
  detail?: string | undefined;
  customValue?: ReactNode | undefined;
  onPress: () => void;
  showChevron?: boolean | undefined;
  last?: boolean | undefined;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={props.onPress} style={[styles.row, props.last ? styles.rowLast : null]}>
      <View style={styles.rowIcon}>{props.icon}</View>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{props.label}</Text>
        {props.detail ? (
          <Text numberOfLines={1} style={styles.rowDetail}>
            {props.detail}
          </Text>
        ) : null}
      </View>
      {props.customValue}
      {props.showChevron === false ? null : (
        <ChevronRight color={colors.ink3} size={15} strokeWidth={2.2} />
      )}
    </Pressable>
  );
}

function PlanBadge(props: { label: string }) {
  return (
    <View style={styles.planBadge}>
      <Text style={styles.planBadgeText}>{props.label}</Text>
    </View>
  );
}

function VerifiedBadge() {
  return (
    <View style={styles.verifiedBadge}>
      <Text style={styles.verifiedText}>Verified</Text>
    </View>
  );
}

function contactSummary(phone: string | null, website: string | null) {
  const parts = [phone, website].map((value) => value?.trim()).filter((value): value is string => Boolean(value));
  return parts.length > 0 ? parts.join(" · ") : "Add phone and website";
}

function normalizeImageContentType(contentType: string | null | undefined): "image/jpeg" | "image/png" | "image/webp" {
  if (contentType === "image/png" || contentType === "image/webp") {
    return contentType;
  }

  return "image/jpeg";
}

async function loadImagePicker(): Promise<ImagePickerModule | null> {
  try {
    if (!hasNativeExpoModule("ExponentImagePicker")) {
      return null;
    }

    const ImagePicker = await import("expo-image-picker");

    if (
      typeof ImagePicker.requestMediaLibraryPermissionsAsync !== "function" ||
      typeof ImagePicker.launchImageLibraryAsync !== "function"
    ) {
      return null;
    }

    return ImagePicker;
  } catch (error) {
    console.warn("SnapQuote image picker unavailable", error);
    return null;
  }
}

function hasNativeExpoModule(moduleName: string) {
  const expoModules = (globalThis as ExpoNativeGlobal).expo?.modules;

  if (expoModules?.[moduleName]) {
    return true;
  }

  const nativeProxy = NativeModules.NativeUnimoduleProxy as LegacyNativeProxy | undefined;

  return Boolean(
    nativeProxy?.exportedMethods?.[moduleName] ||
    nativeProxy?.modulesConstants?.[moduleName]
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 23,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18
  },
  nav: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  navButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    width: 36
  },
  navTitle: {
    color: colors.ink3,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.8,
    textTransform: "uppercase"
  },
  hero: {
    alignItems: "center",
    gap: 6
  },
  logoWrap: {
    height: 86,
    marginBottom: 6,
    position: "relative",
    width: 86
  },
  logoImage: {
    borderRadius: 22,
    height: 78,
    width: 78
  },
  cameraBadge: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    bottom: 4,
    height: 27,
    justifyContent: "center",
    position: "absolute",
    right: 2,
    width: 27
  },
  businessName: {
    color: colors.ink,
    fontSize: 21,
    fontWeight: "900",
    lineHeight: 25,
    textAlign: "center"
  },
  businessMeta: {
    color: colors.ink3,
    fontSize: 12,
    fontWeight: "700"
  },
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: -1
  },
  editIconButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 25,
    justifyContent: "center",
    width: 25
  },
  statsRow: {
    flexDirection: "row",
    gap: 9
  },
  statCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    minHeight: 62,
    justifyContent: "center"
  },
  statValue: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: "900",
    lineHeight: 23
  },
  statValueGreen: {
    color: colors.green
  },
  statLabel: {
    color: colors.ink3,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8,
    marginTop: 3,
    textTransform: "uppercase"
  },
  section: {
    gap: 9
  },
  sectionLabel: {
    color: colors.ink3,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.6,
    paddingHorizontal: 3,
    textTransform: "uppercase"
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: "hidden"
  },
  row: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 61,
    paddingHorizontal: 14
  },
  rowLast: {
    borderBottomWidth: 0
  },
  rowIcon: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 32,
    justifyContent: "center",
    width: 32
  },
  rowText: {
    flex: 1,
    gap: 2,
    minWidth: 0
  },
  rowLabel: {
    color: colors.ink,
    fontSize: 14.5,
    fontWeight: "800"
  },
  rowDetail: {
    color: colors.ink3,
    fontSize: 11,
    fontWeight: "600"
  },
  rowValue: {
    color: colors.ink2,
    fontSize: 13,
    fontWeight: "800"
  },
  planBadge: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 7,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 4
  },
  planBadgeText: {
    color: colors.ink3,
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  verifiedBadge: {
    backgroundColor: colors.greenBg,
    borderColor: colors.greenBorder,
    borderRadius: 7,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 4
  },
  verifiedText: {
    color: colors.green,
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  version: {
    color: colors.ink3,
    fontSize: 10.5,
    fontWeight: "600",
    paddingBottom: 2,
    textAlign: "center"
  }
});
