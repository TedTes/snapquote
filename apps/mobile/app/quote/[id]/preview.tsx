import { useState } from "react";
import { Mail, MessageCircle } from "lucide-react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { QuoteDiscount } from "@snapquote/shared";
import { AnimatedSheetContent, SheetModal } from "../../../src/ui/AnimatedSheet";
import {
  Banner,
  Card,
  Chip,
  Divider,
  EmptyState,
  GhostButton,
  KeyValueRow,
  PrimaryButton,
  Screen,
  SegmentedControl,
  TopBar
} from "../../../src/ui/components";
import { colors, radius, spacing } from "../../../src/ui/theme";
import { formatLongDate, formatMoney, initials } from "../../../src/lib/format";
import { snapquoteApi, userFacingErrorMessage } from "../../../src/lib/api";
import {
  getCustomer,
  getQuoteBlockers,
  getQuoteStatus,
  getQuoteTotals,
  dollarsToCents,
  useMvpStore
} from "../../../src/state/mvp";

type DiscountMode = QuoteDiscount["type"];

export default function QuotePreviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const businessName = useMvpStore((state) => state.businessName);
  const quote = useMvpStore((state) => state.quotes.find((candidate) => candidate.id === id));
  const customers = useMvpStore((state) => state.customers);
  const events = useMvpStore((state) => state.events);
  const upsertRemoteQuote = useMvpStore((state) => state.upsertRemoteQuote);

  const [showSendSheet, setShowSendSheet] = useState(false);
  const [showDiscountSheet, setShowDiscountSheet] = useState(false);
  const [discountMode, setDiscountMode] = useState<DiscountMode>(quote?.discount.type ?? "none");
  const [discountValue, setDiscountValue] = useState(
    quote?.discount.type === "percent"
      ? String(quote.discount.value)
      : quote?.discount.type === "cents"
        ? String(Math.round(quote.discount.value / 100))
        : ""
  );
  const [sending, setSending] = useState(false);
  const [savingDiscount, setSavingDiscount] = useState(false);

  if (!id || !quote) {
    return (
      <Screen>
        <TopBar title="Preview" onBack={() => router.replace("/")} />
        <View style={styles.notFound}>
          <EmptyState text="It may have been deleted." title="Quote not found" />
        </View>
      </Screen>
    );
  }

  const customer = getCustomer(customers, quote.customerId);
  const status = getQuoteStatus(quote, events);
  const blockers = getQuoteBlockers(quote);
  const totals = getQuoteTotals(quote);
  const sortedLines = [...quote.lineItems].sort((a, b) => a.position - b.position);
  const canSend = status === "draft" && blockers.reasons.length === 0 && totals !== null;

  async function confirmSend() {
    if (!quote) {
      return;
    }

    setSending(true);

    try {
      const updated = await snapquoteApi.sendQuote(quote.id);
      upsertRemoteQuote(updated);
      setShowSendSheet(false);
      router.replace({ pathname: "/quote/[id]", params: { id: quote.id } });
    } catch (error) {
      Alert.alert("Could not send quote", userFacingErrorMessage(error));
    } finally {
      setSending(false);
    }
  }

  async function saveDiscount() {
    if (!quote) {
      return;
    }

    const parsed = Number(discountValue);
    const discount: QuoteDiscount =
      discountMode === "none"
        ? { type: "none", value: 0 }
        : discountMode === "percent"
          ? { type: "percent", value: Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : 0 }
          : { type: "cents", value: dollarsToCents(discountValue) };

    setSavingDiscount(true);

    try {
      const updated = await snapquoteApi.patchQuote(quote.id, { discount });
      upsertRemoteQuote(updated);
      setShowDiscountSheet(false);
    } catch (error) {
      Alert.alert("Could not save discount", userFacingErrorMessage(error));
    } finally {
      setSavingDiscount(false);
    }
  }

  return (
    <Screen>
      <TopBar eyebrow="as customer sees it" title="Preview" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.brandCard}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>{initials(businessName)}</Text>
          </View>
          <View style={styles.brandText}>
            <Text style={styles.brandName}>{businessName}</Text>
            <Text style={styles.brandSub}>
              Quote for {customer?.name ?? "customer"} · {quote.address}
            </Text>
          </View>
        </Card>

        <Card>
          {sortedLines.map((line, index) => (
            <View key={line.id}>
              <KeyValueRow
                label={line.description}
                value={formatMoney(line.unitPriceCents !== null ? Math.round(line.quantity * line.unitPriceCents) : null)}
              />
              {index < sortedLines.length - 1 ? <Divider /> : null}
            </View>
          ))}
        </Card>

        <Card>
          <KeyValueRow label="Subtotal" value={totals ? formatMoney(totals.subtotalCents) : "$--"} />
          {totals && totals.discountCents > 0 ? (
            <>
              <View style={styles.spacer} />
              <KeyValueRow label="Discount" value={`-${formatMoney(totals.discountCents)}`} />
            </>
          ) : null}
          {status === "draft" ? (
            <>
              <View style={styles.spacer} />
              <Pressable accessibilityRole="button" onPress={() => setShowDiscountSheet(true)} style={styles.discountButton}>
                <Text style={styles.discountButtonText}>
                  {quote.discount.type === "none" ? "Add discount" : "Edit discount"}
                </Text>
              </Pressable>
            </>
          ) : null}
          <View style={styles.spacer} />
          <KeyValueRow label={`Tax (${Math.round(quote.taxRate * 100)}%)`} value={totals ? formatMoney(totals.taxCents) : "$--"} />
          <Divider />
          <KeyValueRow label="Total" strong value={totals ? formatMoney(totals.totalCents) : "$--"} />
        </Card>

        <Text style={styles.footnote}>
          Valid until {formatLongDate(toIso(quote.validUntil))}
          {quote.scopeNotes.length > 0 ? ` · ${quote.scopeNotes.join(" ")}` : ""}
        </Text>
      </ScrollView>
      <View style={styles.footer}>
        {canSend ? (
          <PrimaryButton label="Send quote" onPress={() => setShowSendSheet(true)} />
        ) : status === "draft" ? (
          <PrimaryButton disabled label="Fix pricing before sending" onPress={() => {}} />
        ) : (
          <GhostButton
            label="View quote status"
            onPress={() => router.replace({ pathname: "/quote/[id]", params: { id: quote.id } })}
          />
        )}
      </View>

      <SheetModal onDismiss={() => setShowSendSheet(false)} style={styles.modalBackdrop} visible={showSendSheet}>
        <AnimatedSheetContent style={styles.sheet}>
          <View style={styles.grabber} />
          <Text style={styles.sheetTitle}>Send quote</Text>
          <Text style={styles.sheetSubtitle}>
            {totals ? formatMoney(totals.totalCents) : "$--"} to {customer?.name ?? "customer"}
          </Text>

          <Card style={styles.channelRow}>
            <View style={styles.channelIcon}>
              <Mail color={colors.ink} size={18} />
            </View>
            <View style={styles.channelText}>
              <Text style={styles.channelTitle}>Email link</Text>
              <Text style={styles.channelSub}>{customer?.email ?? "No email on file"}</Text>
            </View>
            <Chip label={customer?.email ? "Ready" : "Missing"} tone={customer?.email ? "green" : "red"} />
          </Card>

          <Card style={[styles.channelRow, styles.channelRowDisabled]}>
            <View style={styles.channelIcon}>
              <MessageCircle color={colors.ink3} size={18} />
            </View>
            <View style={styles.channelText}>
              <Text style={styles.channelTitleMuted}>Text link</Text>
              <Text style={styles.channelSub}>Coming soon</Text>
            </View>
          </Card>

          <Banner tone="green">All lines priced — safe to send.</Banner>

          <PrimaryButton
            disabled={!customer?.email || sending}
            label={sending ? "Sending..." : "Send email now"}
            onPress={() => void confirmSend()}
          />
          <Pressable
            accessibilityRole="button"
            disabled={sending}
            onPress={() => setShowSendSheet(false)}
            style={styles.cancelLink}
          >
            <Text style={styles.cancelLinkText}>Cancel</Text>
          </Pressable>
        </AnimatedSheetContent>
      </SheetModal>

      <SheetModal onDismiss={() => setShowDiscountSheet(false)} style={styles.modalBackdrop} visible={showDiscountSheet}>
        <AnimatedSheetContent style={styles.sheet}>
          <View style={styles.grabber} />
          <Text style={styles.sheetTitle}>Discount</Text>
          <SegmentedControl
            onChange={setDiscountMode}
            options={[
              { label: "None", value: "none" },
              { label: "%", value: "percent" },
              { label: "$", value: "cents" }
            ]}
            value={discountMode}
          />
          {discountMode !== "none" ? (
            <TextInput
              keyboardType="decimal-pad"
              onChangeText={setDiscountValue}
              placeholder={discountMode === "percent" ? "10" : "100"}
              placeholderTextColor={colors.ink3}
              style={styles.discountInput}
              value={discountValue}
            />
          ) : null}
          <PrimaryButton
            disabled={savingDiscount}
            label={savingDiscount ? "Saving..." : "Apply discount"}
            onPress={() => void saveDiscount()}
          />
        </AnimatedSheetContent>
      </SheetModal>
    </Screen>
  );
}

function toIso(date: string): string {
  return `${date}T00:00:00.000Z`;
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.xxl
  },
  notFound: {
    padding: spacing.lg
  },
  brandCard: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md
  },
  logo: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  logoText: {
    color: colors.ink2,
    fontSize: 14,
    fontWeight: "700"
  },
  brandText: {
    flex: 1,
    gap: 2
  },
  brandName: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "700"
  },
  brandSub: {
    color: colors.ink2,
    fontSize: 12
  },
  spacer: {
    height: spacing.sm
  },
  discountButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 40
  },
  discountButtonText: {
    color: colors.ink2,
    fontSize: 13,
    fontWeight: "800"
  },
  footnote: {
    color: colors.ink3,
    fontSize: 12,
    lineHeight: 17
  },
  footer: {
    padding: spacing.lg,
    paddingTop: spacing.sm
  },
  modalBackdrop: {
    backgroundColor: "rgba(18,22,28,0.35)",
    flex: 1,
    justifyContent: "flex-end"
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    gap: spacing.sm,
    padding: spacing.lg
  },
  grabber: {
    alignSelf: "center",
    backgroundColor: colors.border,
    borderRadius: 999,
    height: 4,
    marginBottom: spacing.xs,
    width: 38
  },
  sheetTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "800"
  },
  sheetSubtitle: {
    color: colors.ink2,
    fontSize: 13,
    marginBottom: spacing.xs
  },
  channelRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  channelRowDisabled: {
    opacity: 0.55
  },
  discountInput: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 18,
    fontWeight: "800",
    minHeight: 52,
    paddingHorizontal: 14
  },
  channelIcon: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    height: 34,
    justifyContent: "center",
    width: 34
  },
  channelText: {
    flex: 1,
    gap: 2
  },
  channelTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "700"
  },
  channelTitleMuted: {
    color: colors.ink2,
    fontSize: 14,
    fontWeight: "700"
  },
  channelSub: {
    color: colors.ink3,
    fontSize: 12
  },
  cancelLink: {
    alignItems: "center",
    paddingVertical: spacing.xs
  },
  cancelLinkText: {
    color: colors.ink3,
    fontSize: 13,
    fontWeight: "600"
  }
});
