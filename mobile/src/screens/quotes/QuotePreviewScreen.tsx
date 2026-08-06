import { useState } from "react";
import { ArrowLeft, Edit3, Eye, Mail, MessageCircle, Send } from "lucide-react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { deriveCustomerCity, type QuoteDiscount } from "@snapquote/shared";
import {
  AnimatedSheetContent,
  SheetModal,
} from "../../shared-ui/AnimatedSheet";
import { InlineProgressPanel } from "../../shared-ui/ProgressExperience";
import {
  Banner,
  Card,
  Chip,
  EmptyState,
  GhostButton,
  PrimaryButton,
  Screen,
  SegmentedControl,
} from "../../shared-ui/base";
import { colors, fontStyles, radius, spacing, typography } from "../../shared-ui/theme";
import { describeQuantity, formatLongDate, formatMoney, initials } from "../../utils/format";
import { isUpgradeRequiredError, snapquoteApi, userFacingErrorMessage } from "../../api/client";
import { useAuthStore } from "../../state/authStore";
import {
  getQuoteBlockers,
  getQuoteCustomer,
  getQuoteStatus,
  getQuoteTotals,
  dollarsToCents,
  useQuoteStore,
} from "../../state/quoteStore";

type DiscountMode = QuoteDiscount["type"];

export default function QuotePreviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const businessName = useQuoteStore((state) => state.businessName);
  const defaultTerms = useQuoteStore((state) => state.defaultTerms);
  const quote = useQuoteStore((state) =>
    state.quotes.find((candidate) => candidate.id === id),
  );
  const customers = useQuoteStore((state) => state.customers);
  const events = useQuoteStore((state) => state.events);
  const authStatus = useAuthStore((state) => state.status);
  const updateQuoteDiscount = useQuoteStore((state) => state.updateQuoteDiscount);
  const removeRemoteQuote = useQuoteStore((state) => state.removeRemoteQuote);
  const upsertRemoteQuote = useQuoteStore((state) => state.upsertRemoteQuote);
  const me = useAuthStore((state) => state.me);
  const insets = useSafeAreaInsets();

  const [showSendSheet, setShowSendSheet] = useState(false);
  const [showDiscountSheet, setShowDiscountSheet] = useState(false);
  const [discountMode, setDiscountMode] = useState<DiscountMode>(
    quote?.discount.type ?? "none",
  );
  const [discountValue, setDiscountValue] = useState(
    quote?.discount.type === "percent"
      ? String(quote.discount.value)
      : quote?.discount.type === "cents"
        ? String(Math.round(quote.discount.value / 100))
        : "",
  );
  const [sending, setSending] = useState(false);
  const [savingDiscount, setSavingDiscount] = useState(false);

  if (!id || !quote) {
    return (
      <Screen>
        <View style={styles.previewNav}>
          <Pressable accessibilityRole="button" onPress={() => router.replace("/")} style={styles.backButton}>
            <ArrowLeft color={colors.ink} size={16} strokeWidth={2.4} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <View style={styles.navCenter}>
            <Text style={styles.navEyebrow}>As customer sees it</Text>
            <Text style={styles.navTitle}>Preview</Text>
          </View>
          <View style={styles.navSpacer} />
        </View>
        <View style={styles.notFound}>
          <EmptyState
            text="It may have been deleted."
            title="Quote not found"
          />
        </View>
      </Screen>
    );
  }

  const customer = getQuoteCustomer(quote, customers);
  const status = getQuoteStatus(quote, events);
  const blockers = getQuoteBlockers(quote);
  const totals = getQuoteTotals(quote);
  const sortedLines = [...quote.lineItems].sort(
    (a, b) => a.position - b.position,
  );
  const logoUrl = me?.org.logoUrl ?? null;
  const senderEmail = me?.user.email ?? "";
  const senderContact = [me?.org.contactPhone, me?.org.website, senderEmail]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .join(" · ");
  const proposalNumber = quote.id.replace(/[^a-z0-9]/gi, "").slice(-4).toUpperCase() || "1042";
  const terms = quote.terms.trim().length > 0 ? quote.terms : defaultTerms;
  const canSend =
    status === "draft" && blockers.reasons.length === 0 && totals !== null;

  async function confirmSend() {
    if (!quote) {
      return;
    }

    if (!customer?.email) {
      Alert.alert("Add customer email", "An email address is required before sending the quote.");
      return;
    }

    if (authStatus !== "signed_in") {
      setShowSendSheet(false);
      Alert.alert(
        "You're not signed in",
        "Sign in with Apple or Google to send this quote and track customer views.",
        [
          { text: "Not now", style: "cancel" },
          { text: "Sign in", onPress: () => router.push({ pathname: "/auth", params: { from: "app" } }) },
        ],
      );
      return;
    }

    setSending(true);

    try {
      let quoteIdToSend = quote.id;

      if (quote.id.startsWith("quote-")) {
        // A local quote's customer already has a real backend id when it was picked from
        // an existing (already-synced) customer -- local-only ids use a "cust-" prefix.
        // Reference it directly instead of sending an inline customer object.
        const pickedRemoteCustomerId =
          customer !== null && !customer.id.startsWith("cust-") ? customer.id : null;

        const created = await snapquoteApi.createQuote({
          ...(pickedRemoteCustomerId !== null
            ? { customerId: pickedRemoteCustomerId }
            : {
                customer: {
                  name: customer?.name ?? "Unnamed customer",
                  email: customer?.email ?? null,
                  phone: customer?.phone ?? null,
                  address: quote.address,
                  city: customer?.city || deriveCustomerCity(quote.address),
                },
              }),
          address: quote.address,
          workType: quote.workType,
          jobTitle: quote.jobTitle,
          checklist: quote.checklist,
          transcript: quote.transcript,
          typedNotes: quote.notes,
          audioStoragePath: quote.audioStoragePath,
          audioContentType: quote.audioContentType,
          audioDurationSeconds: quote.audioDurationSeconds,
        });
        const synced = await snapquoteApi.patchQuote(created.id, {
          discount: quote.discount,
          lineItems: quote.lineItems.map(({ id: _lineId, ...line }) => ({
            ...line,
            priceBookItemId: null,
          })),
          notes: quote.notes,
          taxRate: quote.taxRate,
          terms: quote.terms,
          validUntil: quote.validUntil,
        });

        upsertRemoteQuote(synced);
        removeRemoteQuote(quote.id);
        quoteIdToSend = synced.id;
      }

      const updated = await snapquoteApi.sendQuote(quoteIdToSend, ["email"]);
      upsertRemoteQuote(updated);
      setShowSendSheet(false);
      router.replace({ pathname: "/quote/[id]", params: { id: updated.id } });
    } catch (error) {
      if (isUpgradeRequiredError(error)) {
        setShowSendSheet(false);
        Alert.alert("Upgrade to send", userFacingErrorMessage(error), [
          { text: "Not now", style: "cancel" },
          { text: "View plan", onPress: () => router.push("/settings/billing") }
        ]);
      } else {
        Alert.alert("Could not send quote", userFacingErrorMessage(error));
      }
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
          ? {
              type: "percent",
              value: Number.isFinite(parsed)
                ? Math.max(0, Math.min(100, parsed))
                : 0,
            }
          : { type: "cents", value: dollarsToCents(discountValue) };

    if (authStatus !== "signed_in") {
      updateQuoteDiscount(quote.id, discount);
      setShowDiscountSheet(false);
      return;
    }

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
    <Screen edges={["top"]}>
      <View style={styles.screen}>
        <View style={styles.previewNav}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft color={colors.ink} size={16} strokeWidth={2.4} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <View style={styles.navCenter}>
            <Text style={styles.navEyebrow}>As customer sees it</Text>
            <Text style={styles.navTitle}>Preview</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => setShowDiscountSheet(true)} style={styles.editButton}>
            <Edit3 color={colors.ink2} size={13} strokeWidth={2.2} />
            <Text style={styles.editText}>Edit</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 8) + 88 }]}>
          <View style={styles.proposalCard}>
            <View style={styles.businessBlock}>
              <View style={styles.logo}>
                {logoUrl ? (
                  <Image source={{ uri: logoUrl }} style={styles.logoImage} />
                ) : (
                  <Text style={styles.logoText}>{initials(businessName)}</Text>
                )}
              </View>
              <View style={styles.brandText}>
                <Text style={styles.brandName}>{businessName}</Text>
                <Text style={styles.brandSub} numberOfLines={1}>
                  {senderContact}
                </Text>
              </View>
            </View>

            <View style={styles.metaGrid}>
              <MetaCell label="Quote" value={`#${proposalNumber}`} />
              <MetaCell label="Issued" value={formatLongDate(quote.createdAt).replace(",", "")} />
              <MetaCell label="Valid until" value={formatLongDate(toIso(quote.validUntil)).replace(",", "")} />
            </View>

            <View style={styles.heavyDivider} />

            <View style={styles.documentSection}>
              <Text style={styles.sectionKicker}>Prepared for</Text>
              <Text style={styles.customerName}>{customer?.name ?? "Customer"}</Text>
              <Text style={styles.customerAddress}>{quote.address}</Text>
            </View>

            <View style={styles.thinDivider} />

            <View style={styles.documentSection}>
              <Text style={styles.sectionKicker}>Scope of work</Text>
              <Text style={styles.scopeText}>{quote.scopeSummary}</Text>
            </View>

            <View style={styles.lineList}>
              {sortedLines.map((line) => (
                <View key={line.id} style={styles.proposalLine}>
                  <View style={styles.proposalLineCopy}>
                    <Text style={styles.proposalLineTitle}>{proposalLineTitle(line.description, line.quantity, line.unit)}</Text>
                  </View>
                  <Text style={styles.proposalLineAmount}>
                    {formatMoney(
                      line.unitPriceCents !== null
                        ? Math.round(line.quantity * line.unitPriceCents)
                        : null,
                    )}
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.totalBlock}>
              <ProposalTotal label="Subtotal" value={totals ? formatMoney(totals.subtotalCents) : "$--"} />
              {totals && totals.discountCents > 0 ? (
                <ProposalTotal label="Discount" value={`-${formatMoney(totals.discountCents)}`} />
              ) : null}
              <ProposalTotal label={`Tax (${Math.round(quote.taxRate * 100)}%)`} value={totals ? formatMoney(totals.taxCents) : "$--"} />
              <View style={styles.totalDivider} />
              <ProposalTotal strong label="Total" value={totals ? formatMoney(totals.totalCents) : "$--"} />
            </View>

            <View style={styles.termsBlock}>
              <Text style={styles.termsText}>
                <Text style={styles.termsStrong}>Terms. </Text>
                {terms}
                {quote.scopeNotes.length > 0 ? ` ${quote.scopeNotes.join(" ")}` : ""}
              </Text>
            </View>

            <View style={styles.customerActions}>
              <View style={styles.acceptPreviewButton}>
                <Text style={styles.acceptPreviewText}>Accept quote</Text>
              </View>
              <View style={styles.declinePreviewButton}>
                <Text style={styles.declinePreviewText}>Decline</Text>
              </View>
            </View>

            <Text style={styles.customerFootnote}>No account needed · questions? Just reply to the email</Text>
          </View>

          <View style={styles.previewOnlyRow}>
            <Eye color={colors.ink3} size={11} strokeWidth={2.1} />
            <Text style={styles.previewOnlyText}>Preview only — buttons work for your customer</Text>
          </View>
        </ScrollView>
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        {canSend ? (
          <Pressable accessibilityRole="button" onPress={() => setShowSendSheet(true)} style={styles.sendButton}>
            <Send color={colors.onDark} size={15} strokeWidth={2.4} />
            <Text style={styles.sendButtonText}>Send quote</Text>
          </Pressable>
        ) : status === "draft" ? (
          <Pressable accessibilityRole="button" disabled style={[styles.sendButton, styles.sendButtonDisabled]}>
            <Text style={styles.sendButtonTextDisabled}>Fix pricing before sending</Text>
          </Pressable>
        ) : (
          <GhostButton
            label="View quote status"
            onPress={() =>
              router.replace({
                pathname: "/quote/[id]",
                params: { id: quote.id },
              })
            }
          />
        )}
      </View>
      <SheetModal
        onDismiss={() => setShowSendSheet(false)}
        style={styles.modalBackdrop}
        visible={showSendSheet}
      >
        <AnimatedSheetContent style={styles.sheet}>
          <View style={styles.grabber} />
          <Text style={styles.sheetTitle}>Send quote</Text>
          <Text style={styles.sheetSubtitle}>
            {totals ? formatMoney(totals.totalCents) : "$--"} to{" "}
            {customer?.name ?? "customer"}
          </Text>

          <Card style={styles.channelRow}>
            <View style={styles.channelIcon}>
              <Mail color={colors.ink} size={18} />
            </View>
            <View style={styles.channelText}>
              <Text style={styles.channelTitle}>Email link</Text>
              <Text style={styles.channelSub}>
                {customer?.email ?? "No email on file"}
              </Text>
            </View>
            <Chip
              label={customer?.email ? "Ready" : "Missing"}
              tone={customer?.email ? "green" : "red"}
            />
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

          {sending ? (
            <InlineProgressPanel
              helper="The customer gets a private quote link by email."
              title="Sending quote"
            />
          ) : null}

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

      <SheetModal
        onDismiss={() => setShowDiscountSheet(false)}
        style={styles.modalBackdrop}
        visible={showDiscountSheet}
      >
        <AnimatedSheetContent style={styles.sheet}>
          <View style={styles.grabber} />
          <Text style={styles.sheetTitle}>Discount</Text>
          <SegmentedControl
            onChange={setDiscountMode}
            options={[
              { label: "None", value: "none" },
              { label: "%", value: "percent" },
              { label: "$", value: "cents" },
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

function MetaCell(props: { label: string; value: string }) {
  return (
    <View style={styles.metaCell}>
      <Text style={styles.metaLabel}>{props.label}</Text>
      <Text style={styles.metaValue}>{props.value}</Text>
    </View>
  );
}

function ProposalTotal(props: { label: string; value: string; strong?: boolean | undefined }) {
  return (
    <View style={styles.totalRow}>
      <Text style={[styles.totalLabel, props.strong ? styles.totalLabelStrong : null]}>{props.label}</Text>
      <Text style={[styles.totalValue, props.strong ? styles.totalValueStrong : null]}>{props.value}</Text>
    </View>
  );
}

function proposalLineTitle(description: string, quantity: number, unit: string | null): string {
  const trimmed = description.trim();
  const normalized = trimmed.toLowerCase();

  if (normalized.includes("paint walls") && unit === "room") {
    return `Paint walls in ${describeQuantity(quantity, unit)}`;
  }

  if (normalized.includes("paint ceilings") && unit === "room") {
    return `Paint ceilings in ${describeQuantity(quantity, unit)}`;
  }

  if (normalized.includes("paint trim") && unit === "room") {
    return `Paint trim in ${describeQuantity(quantity, unit)}`;
  }

  if (normalized.includes("paint") && normalized.includes("door")) {
    return `Paint ${describeQuantity(quantity, "each").replace("each", "doors")}`;
  }

  return trimmed;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1
  },
  previewNav: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 10
  },
  backButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
    minHeight: 34
  },
  backText: {
    color: colors.ink,
    fontSize: 14,
    ...fontStyles.semibold,
  },
  navCenter: {
    alignItems: "center",
    gap: 1,
    left: 0,
    position: "absolute",
    right: 0
  },
  navEyebrow: {
    ...typography.sectionLabel,
    fontSize: 10,
    letterSpacing: 1.7,
    textTransform: "uppercase"
  },
  navTitle: {
    color: colors.ink,
    fontSize: 14,
    ...fontStyles.semibold,
  },
  navSpacer: {
    width: 54
  },
  editButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
    minHeight: 34
  },
  editText: {
    color: colors.ink2,
    fontSize: 13,
    ...fontStyles.semibold,
  },
  content: {
    padding: 14,
    paddingTop: 10
  },
  notFound: {
    padding: spacing.lg
  },
  proposalCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: "hidden"
  },
  businessBlock: {
    alignItems: "center",
    flexDirection: "row",
    gap: 11,
    padding: 16,
    paddingBottom: 13
  },
  logo: {
    alignItems: "center",
    backgroundColor: colors.dark,
    borderRadius: 7,
    height: 42,
    justifyContent: "center",
    width: 42
  },
  logoText: {
    color: colors.onDark,
    fontSize: 14,
    ...fontStyles.semibold,
  },
  logoImage: {
    borderRadius: 7,
    height: 42,
    width: 42
  },
  brandText: {
    flex: 1,
    gap: 2,
    minWidth: 0
  },
  brandName: {
    color: colors.ink,
    fontSize: 16,
    ...fontStyles.semibold,
  },
  brandSub: {
    color: colors.ink3,
    fontSize: 11,
    ...fontStyles.regular,
  },
  metaGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 14,
    paddingHorizontal: 16
  },
  metaCell: {
    flex: 1,
    gap: 3
  },
  metaLabel: {
    ...typography.sectionLabel,
    fontSize: 9,
    letterSpacing: 1.3,
    textTransform: "uppercase"
  },
  metaValue: {
    color: colors.ink,
    fontSize: 11,
    ...fontStyles.semibold,
  },
  heavyDivider: {
    backgroundColor: colors.dark,
    height: 2
  },
  thinDivider: {
    backgroundColor: colors.border,
    height: 1
  },
  documentSection: {
    gap: 5,
    padding: 16
  },
  sectionKicker: {
    ...typography.sectionLabel,
    fontSize: 10,
    letterSpacing: 1.7,
    textTransform: "uppercase"
  },
  customerName: {
    color: colors.ink,
    fontSize: 14,
    ...fontStyles.semibold,
  },
  customerAddress: {
    color: colors.ink3,
    fontSize: 12,
    ...fontStyles.regular,
  },
  scopeText: {
    color: colors.ink2,
    fontSize: 12,
    ...fontStyles.regular,
    lineHeight: 18
  },
  lineList: {
    borderTopColor: colors.border,
    borderTopWidth: 1
  },
  proposalLine: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
    minHeight: 42,
    paddingHorizontal: 16
  },
  proposalLineCopy: {
    flex: 1,
    minWidth: 0
  },
  proposalLineTitle: {
    color: colors.ink,
    fontSize: 13,
    ...fontStyles.semibold,
  },
  proposalLineAmount: {
    color: colors.ink,
    fontSize: 13,
    ...fontStyles.bold,
  },
  totalBlock: {
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  totalRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2
  },
  totalLabel: {
    color: colors.ink2,
    fontSize: 12,
    ...fontStyles.regular,
  },
  totalValue: {
    color: colors.ink2,
    fontSize: 12,
    ...fontStyles.medium,
  },
  totalLabelStrong: {
    color: colors.ink,
    fontSize: 18,
    ...fontStyles.semibold,
  },
  totalValueStrong: {
    color: colors.ink,
    fontSize: 18,
    ...fontStyles.bold,
  },
  totalDivider: {
    backgroundColor: colors.dark,
    height: 1,
    marginVertical: 4
  },
  termsBlock: {
    padding: 16
  },
  termsText: {
    color: colors.ink2,
    fontSize: 11,
    ...fontStyles.regular,
    lineHeight: 17
  },
  termsStrong: {
    color: colors.ink,
    ...fontStyles.semibold,
  },
  customerActions: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 9,
    padding: 16,
    paddingBottom: 10
  },
  acceptPreviewButton: {
    alignItems: "center",
    backgroundColor: colors.green,
    borderRadius: 7,
    flex: 1,
    height: 40,
    justifyContent: "center"
  },
  acceptPreviewText: {
    color: colors.onDark,
    fontSize: 13,
    ...fontStyles.semibold,
  },
  declinePreviewButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 7,
    borderWidth: 1,
    flex: 1,
    height: 40,
    justifyContent: "center"
  },
  declinePreviewText: {
    color: colors.ink2,
    fontSize: 13,
    ...fontStyles.semibold,
  },
  customerFootnote: {
    color: colors.ink3,
    fontSize: 10,
    ...fontStyles.medium,
    paddingBottom: 14,
    textAlign: "center"
  },
  previewOnlyRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
    justifyContent: "center",
    paddingTop: 12
  },
  previewOnlyText: {
    color: colors.ink3,
    fontSize: 10,
    ...fontStyles.medium,
  },
  footer: {
    backgroundColor: "rgba(255,254,250,0.97)",
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 12
  },
  sendButton: {
    alignItems: "center",
    backgroundColor: colors.dark,
    borderRadius: 10,
    flexDirection: "row",
    gap: 8,
    height: 46,
    justifyContent: "center"
  },
  sendButtonDisabled: {
    backgroundColor: "#CCC9BF"
  },
  sendButtonText: {
    ...typography.primaryAction,
  },
  sendButtonTextDisabled: {
    color: colors.ink2,
    fontSize: 14,
    ...fontStyles.semibold,
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
    ...typography.sheetTitle,
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
    ...typography.inputText,
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
    ...fontStyles.semibold,
  },
  channelTitleMuted: {
    color: colors.ink2,
    fontSize: 14,
    ...fontStyles.medium,
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
    ...fontStyles.medium,
  },
});
