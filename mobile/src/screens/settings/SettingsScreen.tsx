import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { router, useFocusEffect } from "expo-router";
import {
  Book,
  CalendarDays,
  ChevronRight,
  CreditCard,
  FileText,
  Lock,
  Mail,
  MessageSquare,
  Percent,
  RotateCcw,
  Type,
  Users
} from "lucide-react-native";
import { Alert, Animated, AppState, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { getTradeConfig } from "@snapquote/shared";
import { BusinessAvatar } from "../../shared-ui/BusinessAvatar";
import { BottomTabBar } from "../../shared-ui/BottomTabBar";
import { Screen } from "../../shared-ui/base";
import { SectionHeader } from "../../shared-ui/layout";
import { AppText } from "../../shared-ui/text";
import { colors, fontStyles, radius, typography } from "../../shared-ui/theme";
import { useQuoteStore } from "../../state/quoteStore";
import { useAuthStore } from "../../state/authStore";
import { snapquoteApi, userFacingErrorMessage } from "../../api/client";
import { contactEmails } from "../../config/contact";
import { legalUrls } from "../../config/legal";

type PaymentConnectionState = {
  accountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  connected: boolean;
};
type PaymentSetupPhase = "idle" | "checking" | "preparing" | "opening";

export default function SettingsScreen() {
  const businessName = useQuoteStore((state) => state.businessName);
  const defaultTaxRate = useQuoteStore((state) => state.defaultTaxRate);
  const defaultTerms = useQuoteStore((state) => state.defaultTerms);
  const quoteValidDays = useQuoteStore((state) => state.quoteValidDays);
  const defaultDepositPercent = useQuoteStore((state) => state.defaultDepositPercent);
  const priceBookItems = useQuoteStore((state) => state.priceBookItems);
  const customers = useQuoteStore((state) => state.customers);
  const activeTrade = useQuoteStore((state) => state.activeTrade);
  const me = useAuthStore((state) => state.me);
  const logoUrl = me?.org.logoUrl ?? null;
  const authStatus = useAuthStore((state) => state.status);
  const setMe = useAuthStore((state) => state.setMe);
  const [paymentRefreshing, setPaymentRefreshing] = useState(false);
  const [paymentSetupPhase, setPaymentSetupPhase] = useState<PaymentSetupPhase>("idle");
  const [paymentStatusKnown, setPaymentStatusKnown] = useState(false);
  const [paymentConnection, setPaymentConnection] = useState<PaymentConnectionState | null>(null);
  const tradeConfig = getTradeConfig(activeTrade);
  const paymentsConnected = Boolean(me?.org.paymentsConnected);
  const paymentState = paymentConnection ?? {
    accountId: null,
    chargesEnabled: paymentsConnected,
    payoutsEnabled: paymentsConnected,
    connected: paymentsConnected
  };
  const paymentStatus = paymentState.connected ? "connected" : paymentState.accountId ? "pending" : "setup";
  const isCheckingPaymentStatus = authStatus === "signed_in" && (!paymentStatusKnown || paymentRefreshing);
  const isOpeningPaymentSetup = paymentSetupPhase !== "idle";

  const confirmedCount = priceBookItems.filter((item) => item.confirmedAt !== null).length;
  const totalCount = priceBookItems.length;
  const senderEmail = contactEmails.quotes;
  const displayBusinessName = businessName.trim().length > 0 ? businessName.trim() : "Add business name";
  const depositBadgeLabel =
    paymentStatus === "connected" ? "Deposits on" : paymentStatus === "pending" ? "Deposits pending" : "Set up deposits";
  const priceReadinessLabel = totalCount > 0 ? `${confirmedCount}/${totalCount} prices ready` : "Add prices";

  const refreshPaymentStatus = useCallback(async () => {
    if (authStatus !== "signed_in") return;

    try {
      setPaymentRefreshing(true);
      const status = await snapquoteApi.paymentConnectStatus();
      setPaymentConnection({
        accountId: status.accountId,
        chargesEnabled: status.chargesEnabled,
        payoutsEnabled: status.payoutsEnabled,
        connected: status.connected
      });
      setPaymentStatusKnown(true);
      const nextMe = await snapquoteApi.me();
      setMe(nextMe);
    } catch (error) {
      console.warn("QuoteVan payment status refresh skipped", error);
    } finally {
      setPaymentRefreshing(false);
    }
  }, [authStatus, setMe]);

  useFocusEffect(
    useCallback(() => {
      void refreshPaymentStatus();
    }, [refreshPaymentStatus])
  );

  useEffect(() => {
    if (authStatus !== "signed_in") return undefined;

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void refreshPaymentStatus();
      }
    });

    return () => subscription.remove();
  }, [authStatus, refreshPaymentStatus]);

  async function openPaymentSetup() {
    if (paymentStatus === "connected" || paymentsConnected) {
      Alert.alert("Online deposits connected", "Customers can pay quote deposits from the quote link.");
      return;
    }

    if (authStatus !== "signed_in") {
      Alert.alert("Sign in required", "Sign in to manage online deposits.", [
        { text: "Cancel", style: "cancel" },
        { text: "Sign in", onPress: () => router.push({ pathname: "/auth", params: { from: "app" } }) }
      ]);
      return;
    }

    try {
      setPaymentSetupPhase("checking");
      const status = await snapquoteApi.paymentConnectStatus();
      setPaymentConnection({
        accountId: status.accountId,
        chargesEnabled: status.chargesEnabled,
        payoutsEnabled: status.payoutsEnabled,
        connected: status.connected
      });
      setPaymentStatusKnown(true);
      const nextMe = await snapquoteApi.me();
      setMe(nextMe);

      if (status.connected) {
        Alert.alert("Online deposits connected", "Customers can pay quote deposits from the quote link.");
        return;
      }

      setPaymentSetupPhase("preparing");
      const onboarding = await snapquoteApi.startPaymentConnectOnboarding();
      if (!onboarding.url.startsWith("https://") && !onboarding.url.startsWith("http://")) {
        throw new Error("Payment setup link is not ready yet.");
      }
      setPaymentSetupPhase("opening");
      await Linking.openURL(onboarding.url);
    } catch (error) {
      Alert.alert("Could not open payment setup", userFacingErrorMessage(error));
    } finally {
      setPaymentSetupPhase("idle");
    }
  }

  return (
    <Screen edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable
          accessibilityLabel="Open profile"
          accessibilityRole="button"
          onPress={() => router.push("/settings/edit")}
          style={styles.businessHeader}
        >
          <View style={styles.businessAvatar}>
            <BusinessAvatar businessName={businessName} logoUrl={logoUrl} size={56} />
          </View>
          <View style={styles.businessHeaderText}>
            <View style={styles.businessHeaderTopLine}>
              <AppText style={styles.businessKicker} variant="sectionLabel">Business setup</AppText>
              <ChevronRight color={colors.ink3} size={15} strokeWidth={2.2} />
            </View>
            <AppText style={styles.businessName} numberOfLines={1} variant="rowTitle">
              {displayBusinessName}
            </AppText>
            <AppText style={styles.businessMeta} numberOfLines={1} variant="rowSubtitle">
              {tradeConfig.label} · {customers.length} {customers.length === 1 ? "customer" : "customers"}
            </AppText>
            <View style={styles.businessBadges}>
              <HeaderBadge label={depositBadgeLabel} tone={paymentStatus === "connected" ? "green" : "amber"} />
              <HeaderBadge label={priceReadinessLabel} tone="neutral" />
            </View>
          </View>
        </Pressable>

        <SettingsSection label="Quote defaults">
          <SettingsRow
            icon={<Percent color={colors.ink2} size={15} strokeWidth={2.1} />}
            label="Tax rate"
            onPress={() => router.push("/settings/business")}
            value={`${Math.round(defaultTaxRate * 100)}%`}
          />
          <SettingsRow
            icon={<CalendarDays color={colors.ink2} size={15} strokeWidth={2.1} />}
            label="Quote valid for"
            onPress={() => router.push("/settings/business")}
            value={`${quoteValidDays} days`}
          />
          <SettingsRow
            icon={<CreditCard color={colors.ink2} size={15} strokeWidth={2.1} />}
            label="Deposit due"
            onPress={() => router.push("/settings/business")}
            value={`${Math.round(defaultDepositPercent)}%`}
          />
          <SettingsRow
            detail={defaultTerms}
            icon={<FileText color={colors.ink2} size={15} strokeWidth={2.1} />}
            label="Default terms"
            onPress={() => router.push("/settings/business")}
          />
          <SettingsRow
            detail="Hi {name}, just checking in..."
            icon={<MessageSquare color={colors.ink2} size={15} strokeWidth={2.1} />}
            label="Follow-up message"
            last
            onPress={() => Alert.alert("Follow-up message", "Follow-up templates are coming next.")}
          />
        </SettingsSection>

        <SettingsSection label="Customers & pricing">
          <SettingsRow
            detail="Edit contacts and merge duplicates"
            icon={<Users color={colors.ink2} size={16} strokeWidth={2.1} />}
            label="Customers"
            onPress={() => router.push("/customers")}
            value={`${customers.length}`}
          />
          <SettingsRow
            customValue={<BookStrengthBadge confirmed={confirmedCount} total={totalCount} />}
            detail={<StrengthDots confirmed={confirmedCount} total={totalCount} />}
            icon={<Book color={colors.ink2} size={16} strokeWidth={2.1} />}
            label="Book strength"
            onPress={() => router.push("/price-book")}
          />
          <SettingsRow
            detail="Review your starter prices"
            icon={<RotateCcw color={colors.ink2} size={15} strokeWidth={2.1} />}
            label="Re-run price setup"
            onPress={() => router.push("/onboarding")}
          />
          <SettingsRow
            customValue={<TradeValue label={tradeConfig.label} />}
            detail="More trades coming soon"
            icon={<Type color={colors.ink2} size={16} strokeWidth={2.1} />}
            label="Trade"
            last
            onPress={() => undefined}
            showChevron={false}
          />
        </SettingsSection>

        <SettingsSection label="Sending">
          <SettingsRow
            customValue={<ConnectionBadge loading={isCheckingPaymentStatus || isOpeningPaymentSetup} status={paymentStatus} />}
            detail={
              isCheckingPaymentStatus
                ? "Checking Stripe status..."
                : paymentStatus === "connected"
                  ? "Customers can pay quote deposits"
                  : paymentStatus === "pending" || isOpeningPaymentSetup
                    ? "Stripe is finishing verification"
                  : "Connect Stripe to collect deposits"
            }
            icon={<CreditCard color={colors.ink2} size={15} strokeWidth={2.1} />}
            label="Online deposits"
            onPress={() => void openPaymentSetup()}
          />
          <SettingsRow
            customValue={<VerifiedBadge />}
            detail={senderEmail}
            icon={<Mail color={colors.ink2} size={15} strokeWidth={2.1} />}
            label="Send quotes from"
            last
            onPress={() => Alert.alert("Sending email", "Email sender setup is not connected yet.")}
          />
        </SettingsSection>

        <SettingsSection label="Legal & support">
          <SettingsRow
            detail="How QuoteVan handles account, quote, customer, and payment data"
            icon={<Lock color={colors.ink2} size={15} strokeWidth={2.1} />}
            label="Privacy Policy"
            onPress={() => void Linking.openURL(legalUrls.privacy)}
          />
          <SettingsRow
            detail="Your responsibilities when creating, sending, and collecting deposits"
            icon={<FileText color={colors.ink2} size={15} strokeWidth={2.1} />}
            label="Terms of Service"
            onPress={() => void Linking.openURL(legalUrls.terms)}
          />
          <SettingsRow
            detail="Request deletion of your account and associated app data"
            icon={<Users color={colors.ink2} size={16} strokeWidth={2.1} />}
            label="Account deletion"
            onPress={() => void Linking.openURL(legalUrls.accountDeletion)}
          />
          <SettingsRow
            detail="Get help with quotes, payments, privacy, or store review"
            icon={<Mail color={colors.ink2} size={15} strokeWidth={2.1} />}
            label="Support"
            last
            onPress={() => void Linking.openURL(legalUrls.support)}
          />
        </SettingsSection>

        <AppText style={styles.version} variant="meta">
          Account & billing live in your profile · v0.4.1
        </AppText>
      </ScrollView>
      <BottomTabBar />
    </Screen>
  );
}

function SettingsSection(props: { label: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <SectionHeader label={props.label} />
      <View style={styles.sectionCard}>{props.children}</View>
    </View>
  );
}

function SettingsRow(props: {
  icon: ReactNode;
  label: string;
  detail?: ReactNode | undefined;
  value?: string | undefined;
  customValue?: ReactNode | undefined;
  onPress: () => void;
  showChevron?: boolean | undefined;
  last?: boolean | undefined;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={props.onPress} style={[styles.row, props.last ? styles.rowLast : null]}>
      <View style={styles.rowIcon}>{props.icon}</View>
      <View style={styles.rowText}>
        <AppText style={styles.rowLabel} variant="rowTitle">{props.label}</AppText>
        {typeof props.detail === "string" ? (
          <AppText style={styles.rowDetail} numberOfLines={1} variant="rowSubtitle">
            {props.detail}
          </AppText>
        ) : (
          props.detail
        )}
      </View>
      {props.customValue ?? (props.value ? <AppText style={styles.rowValue} variant="body">{props.value}</AppText> : null)}
      {props.showChevron === false ? null : (
        <ChevronRight color={colors.ink3} size={15} strokeWidth={2.2} />
      )}
    </Pressable>
  );
}

function StrengthDots(props: { confirmed: number; total: number }) {
  const segments = Array.from({ length: Math.max(props.total, 1) }, (_, index) => index).slice(0, 11);

  return (
    <View style={styles.strengthDots}>
      {segments.map((index) => (
        <View
          key={index}
          style={[
            styles.strengthDot,
            { backgroundColor: index < props.confirmed ? colors.green : colors.amber }
          ]}
        />
      ))}
    </View>
  );
}

function BookStrengthBadge(props: { confirmed: number; total: number }) {
  return (
    <View style={styles.bookBadge}>
      <AppText style={styles.bookBadgeText} variant="statusPill">
        {props.confirmed} of {props.total}
      </AppText>
    </View>
  );
}

function VerifiedBadge() {
  return (
    <View style={styles.verifiedBadge}>
      <AppText style={styles.verifiedText} variant="statusPill">Verified</AppText>
    </View>
  );
}

function ConnectionBadge(props: { status: "setup" | "pending" | "connected"; loading?: boolean | undefined }) {
  const connected = props.status === "connected";
  const pending = props.status === "pending" || props.loading;

  if (pending) {
    return (
      <View style={[styles.verifiedBadge, styles.pendingBadge, styles.pendingDotsBadge]}>
        <PendingDots />
      </View>
    );
  }

  return (
    <View style={[styles.verifiedBadge, connected ? null : styles.pendingBadge]}>
      <AppText style={[styles.verifiedText, connected ? null : styles.pendingText]} variant="statusPill">
        {connected ? "On" : "Setup"}
      </AppText>
    </View>
  );
}

function PendingDots() {
  const first = useRef(new Animated.Value(0.35)).current;
  const second = useRef(new Animated.Value(0.35)).current;
  const third = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const createPulse = (value: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, { duration: 260, toValue: 1, useNativeDriver: true }),
          Animated.timing(value, { duration: 260, toValue: 0.35, useNativeDriver: true }),
          Animated.delay(520 - delay)
        ])
      );

    const pulses = [createPulse(first, 0), createPulse(second, 160), createPulse(third, 320)];
    pulses.forEach((pulse) => pulse.start());
    return () => pulses.forEach((pulse) => pulse.stop());
  }, [first, second, third]);

  return (
    <View style={styles.pendingDots}>
      <Animated.View style={[styles.pendingDot, { opacity: first }]} />
      <Animated.View style={[styles.pendingDot, { opacity: second }]} />
      <Animated.View style={[styles.pendingDot, { opacity: third }]} />
    </View>
  );
}

function TradeValue(props: { label: string }) {
  return (
    <View style={styles.tradeValue}>
      <AppText style={styles.tradeText} variant="body">{props.label}</AppText>
      <Lock color={colors.ink3} size={11} strokeWidth={2.2} />
    </View>
  );
}

function HeaderBadge(props: { label: string; tone: "green" | "amber" | "neutral" }) {
  return (
    <View
      style={[
        styles.headerBadge,
        props.tone === "green" ? styles.headerBadgeGreen : null,
        props.tone === "amber" ? styles.headerBadgeAmber : null
      ]}
    >
      <AppText
        style={[
          styles.headerBadgeText,
          props.tone === "green" ? styles.headerBadgeTextGreen : null,
          props.tone === "amber" ? styles.headerBadgeTextAmber : null
        ]}
        variant="statusPill"
      >
        {props.label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 20,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 42
  },
  businessHeader: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: 13,
    minHeight: 98,
    padding: 13
  },
  businessAvatar: {
    alignItems: "center",
    borderRadius: 28,
    height: 56,
    justifyContent: "center",
    width: 56
  },
  businessHeaderText: {
    flex: 1,
    gap: 3,
    minWidth: 0
  },
  businessHeaderTopLine: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  businessKicker: {
    color: colors.ink3,
    fontSize: 9.5,
    letterSpacing: 1.35,
    ...fontStyles.medium
  },
  businessName: {
    color: colors.ink,
    fontSize: 18,
    lineHeight: 22,
    ...fontStyles.semibold
  },
  businessMeta: {
    color: colors.ink3,
    fontSize: 11.5,
    ...fontStyles.regular
  },
  businessBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingTop: 7
  },
  headerBadge: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderRadius: 7,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  headerBadgeGreen: {
    backgroundColor: colors.greenBg,
    borderColor: colors.greenBorder
  },
  headerBadgeAmber: {
    backgroundColor: colors.amberBg,
    borderColor: colors.amberBorder
  },
  headerBadgeText: {
    color: colors.ink3,
    fontSize: 8.5,
    ...fontStyles.semibold,
    textTransform: "uppercase"
  },
  headerBadgeTextGreen: {
    color: colors.green
  },
  headerBadgeTextAmber: {
    color: colors.amber
  },
  section: {
    gap: 9
  },
  sectionLabel: {
    ...typography.sectionLabel,
    fontSize: 10,
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
    ...fontStyles.semibold,
  },
  rowDetail: {
    color: colors.ink3,
    fontSize: 11,
    ...fontStyles.regular,
  },
  rowValue: {
    color: colors.ink2,
    fontSize: 13,
    ...fontStyles.semibold,
  },
  strengthDots: {
    flexDirection: "row",
    gap: 3,
    marginTop: 3
  },
  strengthDot: {
    borderRadius: radius.pill,
    height: 6,
    width: 6
  },
  bookBadge: {
    backgroundColor: colors.amberBg,
    borderColor: colors.amberBorder,
    borderRadius: 7,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 4
  },
  bookBadgeText: {
    color: colors.amber,
    fontSize: 9,
    ...fontStyles.semibold,
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
    ...fontStyles.semibold,
    textTransform: "uppercase"
  },
  pendingBadge: {
    backgroundColor: colors.amberBg,
    borderColor: colors.amberBorder
  },
  pendingDotsBadge: {
    minWidth: 50
  },
  pendingDots: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
    justifyContent: "center",
    minWidth: 22
  },
  pendingDot: {
    backgroundColor: colors.amber,
    borderRadius: radius.pill,
    height: 5,
    width: 5
  },
  pendingText: {
    color: colors.amber
  },
  tradeValue: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7
  },
  tradeText: {
    color: colors.ink2,
    fontSize: 13,
    ...fontStyles.medium,
  },
  version: {
    color: colors.ink3,
    fontSize: 10.5,
    ...fontStyles.regular,
    paddingBottom: 2,
    marginTop: -2,
    textAlign: "center"
  }
});
