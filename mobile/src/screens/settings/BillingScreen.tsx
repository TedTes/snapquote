import { useCallback, useEffect, useState, type ReactNode } from "react";
import * as Linking from "expo-linking";
import { router, useFocusEffect } from "expo-router";
import { BookOpen, ChevronLeft, CreditCard, Eye, Send } from "lucide-react-native";
import { Alert, AppState, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatMonthlyPlanPrice, quoteVanPlan, quoteVanPricing } from "@snapquote/shared";
import { snapquoteApi, userFacingErrorMessage } from "../../api/client";
import { useAuthStore } from "../../state/authStore";
import { Screen } from "../../shared-ui/base";
import { colors, radius, shadowLg } from "../../shared-ui/theme";

export default function BillingSettingsScreen() {
  const authStatus = useAuthStore((state) => state.status);
  const me = useAuthStore((state) => state.me);
  const setMe = useAuthStore((state) => state.setMe);
  const [openingBilling, setOpeningBilling] = useState(false);
  const insets = useSafeAreaInsets();
  const plan = me?.billing?.plan ?? quoteVanPlan(me?.org.plan);
  const trialEndsAt = me?.entitlements.trialEndsAt ?? null;
  const trialExpired = me?.entitlements.trialExpired ?? false;
  const sentQuoteCount = me?.entitlements.sentQuoteCount ?? me?.billing?.usage.sentQuoteCount ?? null;
  const freeSendsRemaining = me?.entitlements.freeSendsRemaining ?? me?.billing?.usage.freeSendsRemaining ?? null;
  const stripeStatus = me?.billing?.status?.stripeStatus ?? "trial";
  const currentPeriodEnd = me?.billing?.status?.currentPeriodEnd ?? null;
  const cancelAtPeriodEnd = me?.billing?.status?.cancelAtPeriodEnd ?? false;
  const soloPlan = quoteVanPricing.plans.solo;
  const planIsSolo = plan.id === "solo";
  const actionLabel = authStatus !== "signed_in"
    ? "Sign in to start trial"
    : planIsSolo
      ? "Manage subscription"
      : "Upgrade to Solo";

  const refreshBilling = useCallback(async () => {
    if (authStatus !== "signed_in") {
      return;
    }

    try {
      const nextMe = await snapquoteApi.me();
      setMe(nextMe);
    } catch (error) {
      console.warn("QuoteVan billing refresh skipped", error);
    }
  }, [authStatus, setMe]);

  useFocusEffect(
    useCallback(() => {
      void refreshBilling();
    }, [refreshBilling])
  );

  useEffect(() => {
    if (authStatus !== "signed_in") return undefined;

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void refreshBilling();
      }
    });

    return () => subscription.remove();
  }, [authStatus, refreshBilling]);

  async function openBilling() {
    if (openingBilling) {
      return;
    }

    if (authStatus !== "signed_in") {
      router.push({ pathname: "/auth", params: { from: "app" } });
      return;
    }

    setOpeningBilling(true);

    try {
      const response = planIsSolo
        ? await snapquoteApi.billingPortal()
        : await snapquoteApi.billingCheckout();

      if (!response.url) {
        Alert.alert("Billing not connected", "Subscription billing is not configured for this build yet.");
        return;
      }

      await Linking.openURL(response.url);
      await refreshBilling();
    } catch (error) {
      Alert.alert("Could not open billing", userFacingErrorMessage(error));
    } finally {
      setOpeningBilling(false);
    }
  }

  return (
    <Screen edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.nav}>
          <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.back()} style={styles.navButton}>
            <ChevronLeft color={colors.ink} size={20} strokeWidth={2.4} />
          </Pressable>
          <Text style={styles.navTitle}>Billing</Text>
          <View style={styles.navButtonGhost} />
        </View>

        <View style={styles.soloCard}>
          <View style={styles.soloCardTop}>
            <View style={styles.soloMetaRow}>
              <View style={styles.soloMetaLeft}>
                <View style={styles.recommendedBadge}>
                  <Text style={styles.recommendedBadgeText}>Recommended</Text>
                </View>
              </View>
              <Text style={styles.price}>{formatMonthlyPlanPrice(soloPlan.monthlyPriceCents)}</Text>
            </View>
          </View>
          <FeatureRow icon={<Send color={colors.accent} size={16} strokeWidth={2.3} />} label="Send unlimited quote links" />
          <FeatureRow icon={<Eye color={colors.accent} size={16} strokeWidth={2.3} />} label="See when customers view or respond" />
          <FeatureRow icon={<BookOpen color={colors.accent} size={16} strokeWidth={2.3} />} label="Keep pricing consistent with your price book" />
          <FeatureRow icon={<CreditCard color={colors.accent} size={16} strokeWidth={2.3} />} label="Collect deposits when Stripe is connected" last />
        </View>

        <View style={styles.futureCard}>
          <View style={styles.futureCardHeader}>
            <Text style={styles.futureTitle}>Crew</Text>
            <View style={styles.futureBadge}>
              <Text style={styles.futureBadgeText}>Coming later</Text>
            </View>
          </View>
          <Text style={styles.futureDetail}>Team workflows, SMS, automations, and reporting are planned after Solo is stable.</Text>
        </View>

        <View style={styles.currentPlanRow}>
          <Text style={styles.currentPlanLabel}>Current</Text>
          <Text style={styles.currentPlanText}>
            {authStatus === "signed_in" ? plan.name : "Free trial"} · {planStatusText({
              authStatus,
              planId: plan.id,
              detail: plan.detail,
              trialEndsAt,
              trialExpired,
              sentQuoteCount,
              freeSendsRemaining,
              stripeStatus,
              currentPeriodEnd,
              cancelAtPeriodEnd
            })}
          </Text>
        </View>
      </ScrollView>
      <View pointerEvents="box-none" style={[styles.floatingFooter, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable
          accessibilityRole="button"
          disabled={openingBilling}
          onPress={() => void openBilling()}
          style={[styles.floatingButton, openingBilling ? styles.floatingButtonDisabled : null]}
        >
          <Text style={[styles.floatingButtonText, openingBilling ? styles.floatingButtonTextDisabled : null]}>
            {openingBilling ? "Opening..." : actionLabel}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

function FeatureRow(props: { icon: ReactNode; label: string; last?: boolean | undefined }) {
  return (
    <View style={[styles.featureRow, props.last ? styles.featureRowLast : null]}>
      <View style={styles.featureIcon}>{props.icon}</View>
      <Text style={styles.featureText}>{props.label}</Text>
    </View>
  );
}

function planStatusText(input: {
  authStatus: string;
  planId: string;
  detail: string;
  trialEndsAt: string | null;
  trialExpired: boolean;
  sentQuoteCount: number | null;
  freeSendsRemaining: number | null;
  stripeStatus: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}) {
  if (input.authStatus !== "signed_in") {
    return `${quoteVanPricing.trialDays} days free · ${quoteVanPricing.freeSentQuoteLimit} sent quotes included`;
  }

  if (input.stripeStatus === "checkout_started" || input.stripeStatus === "incomplete") {
    return "Checkout started · finish payment";
  }

  if (input.planId === "solo") {
    const periodEnd = formatDate(input.currentPeriodEnd);

    if (input.cancelAtPeriodEnd) {
      return periodEnd ? `Canceling · access until ${periodEnd}` : "Canceling at period end";
    }

    if (input.stripeStatus === "past_due" || input.stripeStatus === "unpaid") {
      return "Payment failed · update billing";
    }

    if (input.stripeStatus === "active") {
      return periodEnd ? `Solo active · renews ${periodEnd}` : "Solo active";
    }

    if (input.stripeStatus === "trialing") {
      return periodEnd ? `Solo trial · renews ${periodEnd}` : "Solo trial active";
    }

    if (input.stripeStatus === "canceled" || input.stripeStatus === "incomplete_expired" || input.stripeStatus === "paused") {
      return "Subscription inactive · update billing";
    }

    return input.detail;
  }

  if (input.planId === "expired") {
    if (input.stripeStatus === "past_due" || input.stripeStatus === "unpaid") {
      return "Payment failed · update billing";
    }

    return "Subscription inactive · upgrade to send quote links";
  }

  if (input.planId === "trial") {
    if (input.trialExpired) {
      return "Trial ended · upgrade to keep sending quote links";
    }

    if (input.freeSendsRemaining === 0) {
      return "Free sends used · upgrade to keep sending quote links";
    }

    const remaining = input.freeSendsRemaining === null
      ? null
      : `${input.freeSendsRemaining} free ${input.freeSendsRemaining === 1 ? "send" : "sends"} left`;
    const endsAt = formatDate(input.trialEndsAt);
    return [remaining, endsAt ? `Trial ends ${endsAt}` : null].filter(Boolean).join(" · ") || input.detail;
  }

  return input.detail;
}

function formatDate(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 130,
    gap: 14
  },
  nav: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4
  },
  navButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 48
  },
  navButtonGhost: {
    height: 48,
    width: 48
  },
  navTitle: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: "900"
  },
  currentPlanRow: {
    alignItems: "flex-start",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 14,
    paddingVertical: 9
  },
  currentPlanLabel: {
    color: colors.ink3,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    lineHeight: 17,
    textTransform: "uppercase"
  },
  currentPlanText: {
    color: colors.ink2,
    flex: 1,
    fontSize: 12.5,
    fontWeight: "700",
    lineHeight: 17
  },
  soloCard: {
    backgroundColor: colors.surface,
    borderColor: colors.accentBorder,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    overflow: "hidden",
    paddingBottom: 20
  },
  soloCardTop: {
    minHeight: 72,
    paddingBottom: 14,
    paddingHorizontal: 18,
    paddingTop: 16
  },
  soloMetaRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12
  },
  soloMetaLeft: {
    alignItems: "flex-start",
    gap: 5,
    flexShrink: 1
  },
  recommendedBadge: {
    backgroundColor: colors.accentBg,
    borderColor: colors.accentBorder,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 3
  },
  recommendedBadgeText: {
    color: colors.accent,
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  futureCard: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: 6,
    padding: 18
  },
  futureCardHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between"
  },
  futureBadge: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  futureBadgeText: {
    color: colors.ink3,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  price: {
    color: colors.ink,
    fontSize: 25,
    fontWeight: "900",
    lineHeight: 30,
    textAlign: "right"
  },
  planDetail: {
    color: colors.ink2,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 21
  },
  featureRow: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 48,
    paddingHorizontal: 18
  },
  featureRowLast: {
    borderBottomWidth: 0
  },
  featureIcon: {
    alignItems: "center",
    backgroundColor: colors.accentBg,
    borderRadius: radius.sm,
    height: 30,
    justifyContent: "center",
    width: 30
  },
  featureText: {
    color: colors.ink,
    flex: 1,
    fontSize: 14.5,
    fontWeight: "700",
    lineHeight: 19
  },
  futureTitle: {
    color: colors.ink2,
    fontSize: 18,
    fontWeight: "900"
  },
  futureDetail: {
    color: colors.ink3,
    fontSize: 13.5,
    fontWeight: "600",
    lineHeight: 18
  },
  floatingFooter: {
    bottom: 0,
    left: 0,
    paddingHorizontal: 24,
    paddingTop: 12,
    position: "absolute",
    right: 0
  },
  floatingButton: {
    ...shadowLg,
    alignItems: "center",
    backgroundColor: colors.dark,
    borderRadius: radius.md,
    minHeight: 62,
    justifyContent: "center"
  },
  floatingButtonDisabled: {
    backgroundColor: colors.borderStrong
  },
  floatingButtonText: {
    color: colors.onDark,
    fontSize: 18,
    fontWeight: "900"
  },
  floatingButtonTextDisabled: {
    color: colors.ink2
  }
});
