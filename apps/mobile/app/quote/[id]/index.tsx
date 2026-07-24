import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Archive,
  Check,
  ChevronLeft,
  Copy,
  FileText,
  Link2,
  Lock,
  Mail,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  Send
} from "lucide-react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";
import { AnimatedCard } from "../../../src/ui/AnimatedCard";
import { Banner, EmptyState, Screen, SwatchTab } from "../../../src/ui/components";
import { fadeEnter, useMotionEnabled } from "../../../src/ui/motion";
import { apiBaseUrl, snapquoteApi, userFacingErrorMessage } from "../../../src/lib/api";
import { colors, radius, spacing } from "../../../src/ui/theme";
import { describeQuantity, formatDateTime, formatMoney, formatShortDate } from "../../../src/lib/format";
import {
  getCustomer,
  getQuoteBlockers,
  getQuoteEvents,
  getQuoteStatus,
  getQuoteTotals,
  useMvpStore,
  type QuoteRecord,
  type StoredLineItem
} from "../../../src/state/mvp";
import type { Customer, QuoteEvent } from "@snapquote/shared";

export default function QuoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const quote = useMvpStore((state) => state.quotes.find((candidate) => candidate.id === id));
  const customers = useMvpStore((state) => state.customers);
  const events = useMvpStore((state) => state.events);

  if (!id || !quote) {
    return (
      <Screen>
        <View style={styles.notFound}>
          <EmptyState title="Quote not found" text="It may have been deleted." />
        </View>
      </Screen>
    );
  }

  const customer = getCustomer(customers, quote.customerId);
  const status = getQuoteStatus(quote, events);

  if (status === "draft") {
    return <DraftReview customerName={customer?.name ?? "Unnamed customer"} quote={quote} />;
  }

  return <QuoteDetail customer={customer ?? null} customerName={customer?.name ?? "Unnamed customer"} events={events} quote={quote} />;
}

function DraftReview(props: { quote: QuoteRecord; customerName: string }) {
  const { quote } = props;
  const removeRemoteQuote = useMvpStore((state) => state.removeRemoteQuote);
  const upsertPriceBookItem = useMvpStore((state) => state.upsertPriceBookItem);
  const upsertRemoteQuote = useMvpStore((state) => state.upsertRemoteQuote);
  const [savingLineId, setSavingLineId] = useState<string | null>(null);
  const [deletingDraft, setDeletingDraft] = useState(false);
  const blockers = useMemo(() => getQuoteBlockers(quote), [quote]);
  const sortedLines = useMemo(() => [...quote.lineItems].sort((a, b) => a.position - b.position), [quote]);
  const trustedLines = sortedLines.filter((line) => line.matchState === "green");
  const confirmLines = sortedLines.filter((line) => line.matchState === "yellow");
  const priceLines = sortedLines.filter((line) => line.matchState === "red");
  const coverageSlots = buildCoverageSlots(sortedLines);
  const totals = getQuoteTotals(quote);
  const trustedTotalCents = trustedLines.reduce(
    (sum, line) => sum + Math.round(line.quantity * (line.unitPriceCents ?? 0)),
    0
  );
  const trustedCount = trustedLines.length;
  const blockerCount = blockers.redLineCount + blockers.yellowLineCount;
  const allLinesTrusted = sortedLines.length > 0 && blockerCount === 0;
  const footerTone = blockers.redLineCount > 0 ? "red" : blockers.yellowLineCount > 0 ? "amber" : "green";

  function postponeDraft() {
    router.replace({ pathname: "/quotes", params: { filter: "draft" } });
  }

  function confirmDelete() {
    Alert.alert("Delete draft?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void deleteRemoteDraft();
        }
      }
    ]);
  }

  async function deleteRemoteDraft() {
    if (deletingDraft) {
      return;
    }

    setDeletingDraft(true);

    try {
      await snapquoteApi.deleteDraftQuote(quote.id);
      removeRemoteQuote(quote.id);
      router.replace("/");
    } catch (error) {
      Alert.alert("Could not delete draft", userFacingErrorMessage(error));
    } finally {
      setDeletingDraft(false);
    }
  }

  function openDraftMenu() {
    Alert.alert("Draft actions", "This draft is already saved. You can come back from Quotes.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Save for later",
        onPress: postponeDraft
      },
      {
        text: "Delete draft",
        style: "destructive",
        onPress: confirmDelete
      }
    ]);
  }

  function openLine(lineId: string) {
    router.push({ pathname: "/quote/[id]/line/[lineId]", params: { id: quote.id, lineId } });
  }

  async function confirmLine(lineId: string) {
    if (savingLineId !== null) {
      return;
    }

    setSavingLineId(lineId);

    try {
      const response = await snapquoteApi.confirmLine(quote.id, lineId);
      upsertPriceBookItem(response.item);
      upsertRemoteQuote(response.quote);
    } catch (error) {
      Alert.alert("Could not confirm price", userFacingErrorMessage(error));
    } finally {
      setSavingLineId(null);
    }
  }

  function goBack() {
    postponeDraft();
  }

  const motionEnabled = useMotionEnabled();

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.draftContent} showsVerticalScrollIndicator={false}>
        <View style={styles.draftNav}>
          <Pressable accessibilityRole="button" onPress={goBack} style={styles.navButton}>
            <ChevronLeft color={colors.ink} size={18} strokeWidth={2.5} />
          </Pressable>
          <View style={styles.draftNavIdentity}>
            <Text style={styles.draftNavName} numberOfLines={1}>{props.customerName}</Text>
            <Text style={styles.draftNavMeta} numberOfLines={1}>
              {quote.jobTitle.trim().length > 0 ? `Draft · ${quote.jobTitle}` : "Draft"}
            </Text>
          </View>
          <Pressable accessibilityRole="button" onPress={openDraftMenu} style={styles.navButton}>
            <MoreHorizontal color={colors.ink} size={19} strokeWidth={2.5} />
          </Pressable>
        </View>

        {allLinesTrusted ? (
          <View style={styles.quietCoverageLine}>
            <View style={styles.quietCoverageMark}>
              <Check color={colors.onDark} size={9} strokeWidth={3} />
            </View>
            <Text style={styles.quietCoverageText}>All {sortedLines.length} lines priced from your book</Text>
          </View>
        ) : (
          <View style={styles.coverageCard}>
            <View style={styles.coverageHero}>
              <View style={styles.coverageIcon}>
                <Check color={colors.ink2} size={20} strokeWidth={2.8} />
              </View>
              <View style={styles.coverageCopy}>
                <Text style={styles.coverageTitle}>Price coverage</Text>
                <Text style={styles.coverageSubtitle}>
                  {coverageSubtitle({ confirmCount: confirmLines.length, priceCount: priceLines.length, totalCount: sortedLines.length, trustedCount })}
                </Text>
              </View>
            </View>
            <View style={styles.coverageBars}>
              {coverageSlots.map((line, index) =>
                line ? (
                  <View
                    key={line.id}
                    style={[styles.coverageBar, { backgroundColor: matchColor(line.matchState) }]}
                  />
                ) : (
                  <View key={`empty-${index}`} style={[styles.coverageBar, styles.coverageBarEmpty]} />
                )
              )}
            </View>
            <View style={styles.coverageLegend}>
              {trustedCount > 0 ? <CoverageLegend color={colors.green} label={`${trustedCount} from your book`} /> : null}
              {confirmLines.length > 0 ? <CoverageLegend color={colors.amber} label={`${confirmLines.length} to confirm`} /> : null}
              {priceLines.length > 0 ? <CoverageLegend color={colors.red} label={`${priceLines.length} to price`} /> : null}
            </View>
          </View>
        )}

        {trustedLines.map((line) => (
          <DraftLineCard key={line.id} line={line} onPress={() => openLine(line.id)} tone="green" />
        ))}

        {confirmLines.length > 0 ? <Text style={styles.lineSection}>Needs your ok</Text> : null}
        {confirmLines.map((line) => (
          <DraftLineCard
            key={line.id}
            actionLabel={savingLineId === line.id ? "Saving" : "Confirm"}
            line={line}
            onAction={() => void confirmLine(line.id)}
            onPress={() => openLine(line.id)}
            tone="yellow"
          />
        ))}

        {priceLines.length > 0 ? <Text style={styles.lineSection}>Needs a price</Text> : null}
        {priceLines.map((line) => (
          <DraftLineCard
            key={line.id}
            actionLabel="Add price"
            line={line}
            onAction={() => openLine(line.id)}
            onPress={() => openLine(line.id)}
            tone="red"
          />
        ))}

        {quote.conflicts.map((conflict) => (
          <Banner key={conflict.field} tone="amber">
            {conflict.message}
          </Banner>
        ))}

        <Pressable accessibilityRole="button" onPress={() => openLine("new")} style={styles.addLine}>
          <Plus color={colors.ink2} size={16} strokeWidth={2.5} />
          <Text style={styles.addLineText}>Add a line</Text>
        </Pressable>
      </ScrollView>

      <Animated.View {...(motionEnabled ? { entering: fadeEnter } : {})} style={styles.resolveFooter}>
        <View style={styles.footerTop}>
          <View style={styles.footerCopy}>
            <Text style={styles.footerLabel}>Total</Text>
            <Text style={[styles.footerStatus, footerStatusStyle(footerTone)]}>
              {footerStatusText(blockers)}
            </Text>
          </View>
          <View style={styles.footerAmountBlock}>
            <Text style={styles.footerAmount}>
              {formatMoney(totals ? totals.totalCents : trustedTotalCents)}
              {blockerCount > 0 ? <Text style={styles.footerPlus}>+</Text> : null}
            </Text>
            {totals ? <Text style={styles.footerTax}>incl. {formatMoney(totals.taxCents)} tax</Text> : null}
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={blockerCount > 0}
          onPress={() => router.push({ pathname: "/quote/[id]/preview", params: { id: quote.id } })}
          style={[styles.resolveButton, blockerCount > 0 ? styles.resolveButtonDisabled : null]}
        >
          <Send color={blockerCount > 0 ? colors.ink3 : colors.onDark} size={16} />
          <Text style={[styles.resolveButtonText, blockerCount > 0 ? styles.resolveButtonTextDisabled : null]}>
            {blockerCount > 0 ? `Resolve ${blockerCount} lines to send` : "Preview & send"}
          </Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={postponeDraft} style={styles.saveLaterButton}>
          <Text style={styles.saveLaterText}>Save draft for later</Text>
        </Pressable>
        <View style={styles.footerLock}>
          <Lock color={colors.ink3} size={11} />
          <Text style={styles.footerLockText}>Prices come only from your book or you</Text>
        </View>
      </Animated.View>
    </Screen>
  );
}

function DraftLineCard(props: {
  actionLabel?: string | undefined;
  line: StoredLineItem;
  onAction?: (() => void) | undefined;
  onPress: () => void;
  tone: "green" | "yellow" | "red";
}) {
  const { line } = props;
  const palette = linePalette(props.tone);
  const lineTotal = line.unitPriceCents !== null ? Math.round(line.quantity * line.unitPriceCents) : null;

  return (
    <AnimatedCard style={styles.lineCardShell}>
      <Pressable accessibilityRole="button" onPress={props.onPress} style={styles.lineCard}>
        <SwatchTab tone={props.tone} />
        <View style={styles.lineBody}>
          <View style={styles.lineTop}>
            <View style={styles.lineText}>
              <Text style={styles.lineTitle} numberOfLines={1}>
                {lineTitle(line)}
              </Text>
              <Text style={styles.lineSub} numberOfLines={1}>
                {lineSourceText(line, props.tone)}
              </Text>
            </View>
            {props.tone === "green" ? (
              <Text style={styles.lineAmount}>{formatMoney(lineTotal)}</Text>
            ) : (
              <View style={styles.lineActionArea}>
                {props.tone === "yellow" && line.unitPriceCents !== null ? (
                  <Text style={styles.suggestedPrice}>{formatMoney(line.unitPriceCents)} suggested</Text>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  onPress={props.onAction ?? props.onPress}
                  style={[styles.lineActionButton, { backgroundColor: palette.bg, borderColor: palette.border }]}
                >
                  {props.tone !== "red" ? <Check color={palette.fg} size={12} strokeWidth={2.8} /> : <Plus color={palette.fg} size={13} />}
                  <Text style={[styles.lineActionText, { color: palette.fg }]}>
                    {props.actionLabel ?? "Edit"}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    </AnimatedCard>
  );
}

function CoverageLegend(props: { color: string; label: string }) {
  return (
    <View style={styles.coverageLegendItem}>
      <View style={[styles.coverageDot, { backgroundColor: props.color }]} />
      <Text style={styles.coverageLegendText}>{props.label}</Text>
    </View>
  );
}

function QuoteDetail(props: { quote: QuoteRecord; customer: Customer | null; customerName: string; events: QuoteEvent[] }) {
  const { quote } = props;
  const upsertRemoteQuote = useMvpStore((state) => state.upsertRemoteQuote);
  const [sendingFollowUp, setSendingFollowUp] = useState(false);
  const [quoteAction, setQuoteAction] = useState<"revise" | "duplicate" | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const status = getQuoteStatus(quote, props.events);
  const totals = getQuoteTotals(quote);
  const timeline = useMemo(() => getQuoteEvents(props.events, quote.id), [props.events, quote.id]);
  const sortedLines = useMemo(() => [...quote.lineItems].sort((a, b) => a.position - b.position), [quote.lineItems]);
  const publicUrl = quote.publicToken ? `${apiBaseUrl}/public/quotes/${quote.publicToken}` : null;
  const statusMeta = quoteStatusMeta({ quote, events: timeline });

  async function revise() {
    if (quoteAction !== null) {
      return;
    }

    setQuoteAction("revise");

    try {
      const response = await snapquoteApi.reviseQuote(quote.id);
      upsertRemoteQuote(response.supersededQuote);
      upsertRemoteQuote(response.quote);
      setMenuOpen(false);
      router.push({ pathname: "/quote/[id]", params: { id: response.quote.id } });
    } catch (error) {
      Alert.alert("Could not revise quote", userFacingErrorMessage(error));
    } finally {
      setQuoteAction(null);
    }
  }

  async function duplicate() {
    if (quoteAction !== null) {
      return;
    }

    setQuoteAction("duplicate");

    try {
      const duplicated = await snapquoteApi.duplicateQuote(quote.id);
      upsertRemoteQuote(duplicated);
      setMenuOpen(false);
      router.push({ pathname: "/quote/[id]", params: { id: duplicated.id } });
    } catch (error) {
      Alert.alert("Could not duplicate quote", userFacingErrorMessage(error));
    } finally {
      setQuoteAction(null);
    }
  }

  async function followUp() {
    if (sendingFollowUp) {
      return;
    }

    setSendingFollowUp(true);

    try {
      const updated = await snapquoteApi.followUpQuote(quote.id);
      upsertRemoteQuote(updated);
    } catch (error) {
      Alert.alert("Could not send follow-up", userFacingErrorMessage(error));
    } finally {
      setSendingFollowUp(false);
    }
  }

  function downloadPdf() {
    setMenuOpen(false);
    Alert.alert("Download PDF", "PDF export is coming next.");
  }

  function archiveQuote() {
    setMenuOpen(false);
    Alert.alert("Archive quote", "Archiving sent quotes is coming next.");
  }

  function callCustomer() {
    const phone = props.customer?.phone?.replace(/[^\d+]/g, "") ?? "";

    if (phone.length === 0) {
      Alert.alert("No phone number", "Add a customer phone number before calling.");
      return;
    }

    void Linking.openURL(`tel:${phone}`);
  }

  function emailCustomer() {
    const email = props.customer?.email ?? "";

    if (email.length === 0) {
      Alert.alert("No email address", "Add a customer email before emailing.");
      return;
    }

    void Linking.openURL(`mailto:${email}?subject=${encodeURIComponent(`Quote from SnapQuote`)}`);
  }

  function sharePublicLink() {
    if (!publicUrl) {
      Alert.alert("No quote link yet", "Send or sync this quote before sharing the customer link.");
      return;
    }

    void Share.share({ message: publicUrl, url: publicUrl });
  }

  return (
    <Screen edges={["top"]}>
      <View style={styles.detailScreen}>
        <ScrollView
          contentContainerStyle={[styles.detailContent, { paddingBottom: Math.max(insets.bottom, 8) + 92 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.draftNav}>
            <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.navButton}>
              <ChevronLeft color={colors.ink} size={18} strokeWidth={2.5} />
            </Pressable>
            <View style={styles.detailNavIdentity}>
              <Text style={styles.detailNavName} numberOfLines={1}>{props.customerName}</Text>
              <Text style={styles.detailNavMeta} numberOfLines={1}>
                {quote.address}
                {quote.jobTitle.trim().length > 0 ? ` · ${quote.jobTitle}` : ""}
              </Text>
            </View>
            <Pressable accessibilityRole="button" onPress={() => setMenuOpen((value) => !value)} style={styles.navButton}>
              <MoreHorizontal color={colors.ink} size={19} strokeWidth={2.5} />
            </Pressable>
          </View>

          <View style={styles.detailHeader}>
            <Text style={styles.detailHeroAmount}>{totals ? formatMoney(totals.totalCents) : "$--"}</Text>
            <View style={styles.detailStatusRow}>
              <View style={[styles.detailStatusPill, detailStatusPillStyle(status)]}>
                <Text style={[styles.detailStatusText, detailStatusTextStyle(status)]}>
                  {quoteStatusLabel(status)}
                </Text>
              </View>
              <Text style={styles.detailValidUntil}>{statusMeta}</Text>
            </View>
          </View>

          <View style={styles.quoteSummaryCard}>
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryHeaderLabel}>What you sent</Text>
              <Text style={styles.summaryHeaderCount}>{sortedLines.length} lines</Text>
            </View>
            {sortedLines.slice(0, 4).map((line, index, visibleLines) => (
              <View
                key={line.id}
                style={[styles.summaryLine, index < visibleLines.length - 1 ? styles.summaryLineBorder : null]}
              >
                <View style={styles.summaryLineText}>
                  <Text style={styles.summaryLineTitle} numberOfLines={1}>{lineTitle(line)}</Text>
                  <Text style={styles.summaryLineSub} numberOfLines={1}>{lineSubtitle(line)}</Text>
                </View>
                <Text style={styles.summaryLineAmount}>
                  {line.unitPriceCents !== null ? formatMoney(Math.round(line.quantity * line.unitPriceCents)) : "$--"}
                </Text>
              </View>
            ))}
            {sortedLines.length > 4 ? (
              <Text style={styles.summaryMore}>+ {sortedLines.length - 4} more lines</Text>
            ) : null}
            <View style={styles.summaryDivider} />
            <View style={styles.summaryTotals}>
              <SummaryTotal label="Subtotal" value={totals ? formatMoney(totals.subtotalCents) : "$--"} />
              <SummaryTotal label={`Tax (${formatTaxRate(quote.taxRate)})`} value={totals ? formatMoney(totals.taxCents) : "$--"} />
              <SummaryTotal strong label="Total" value={totals ? formatMoney(totals.totalCents) : "$--"} />
            </View>
          </View>

          <View style={styles.timelineCard}>
            <Text style={styles.timelineTitle}>Status timeline</Text>
            {timeline.map((event, index) => (
              <View key={event.id} style={styles.timelineRow}>
                <View style={styles.timelineDotColumn}>
                  <View style={styles.timelineDot} />
                  {index < timeline.length - 1 || quote.firstViewedAt === null ? <View style={styles.timelineRail} /> : null}
                </View>
                <View style={styles.timelineText}>
                  <Text style={styles.timelineLabel}>{eventLabel(event)}</Text>
                  <Text style={styles.timelineDate}>{formatDateTime(event.createdAt)}</Text>
                </View>
              </View>
            ))}
            {quote.firstViewedAt === null ? (
              <View style={styles.timelineRow}>
                <View style={styles.timelineDotColumn}>
                  <View style={styles.timelineDotOpen} />
                </View>
                <View style={styles.timelineText}>
                  <Text style={styles.timelineMuted}>Not viewed yet</Text>
                  <Text style={styles.timelineDate}>We'll tell you when they open it</Text>
                </View>
              </View>
            ) : null}
          </View>

          <View style={styles.contactActions}>
            <ContactAction icon="phone" label="Call" onPress={callCustomer} />
            <ContactAction icon="mail" label="Email" onPress={emailCustomer} />
            <ContactAction icon="link" label="Copy link" onPress={sharePublicLink} />
          </View>

          <Text style={styles.detailMut}>
            Sent quotes are locked. Revise creates a new draft and marks this one Superseded.
          </Text>
        </ScrollView>

        <View style={[styles.followUpFooter, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <Pressable
            accessibilityRole="button"
            disabled={sendingFollowUp}
            onPress={() => void followUp()}
            style={[styles.followUpButton, sendingFollowUp ? styles.followUpButtonDisabled : null]}
          >
            <Send color={sendingFollowUp ? colors.ink3 : colors.onDark} size={15} strokeWidth={2.4} />
            <Text style={[styles.followUpButtonText, sendingFollowUp ? styles.followUpButtonTextDisabled : null]}>
              {sendingFollowUp ? "Sending follow-up..." : "Send follow-up"}
            </Text>
          </Pressable>
        </View>

        {menuOpen ? (
          <>
            <Pressable accessibilityRole="button" onPress={() => setMenuOpen(false)} style={styles.menuScrim} />
            <View style={styles.detailMenu}>
              <MenuRow icon={<Pencil color={colors.ink2} size={16} strokeWidth={2.2} />} label={quoteAction === "revise" ? "Revising..." : "Revise quote"} onPress={() => void revise()} />
              <MenuRow icon={<Copy color={colors.ink2} size={16} strokeWidth={2.2} />} label={quoteAction === "duplicate" ? "Duplicating..." : "Duplicate"} onPress={() => void duplicate()} />
              <MenuRow icon={<FileText color={colors.ink2} size={16} strokeWidth={2.2} />} label="Download PDF" onPress={downloadPdf} />
              <MenuRow icon={<Archive color={colors.ink2} size={16} strokeWidth={2.2} />} label="Archive" onPress={archiveQuote} />
              <View style={styles.menuNote}>
                <Text style={styles.menuNoteText}>
                  Sent quotes are locked. Revise creates a new draft and marks this one Superseded.
                </Text>
              </View>
            </View>
          </>
        ) : null}
      </View>
    </Screen>
  );
}

function SummaryTotal(props: { label: string; value: string; strong?: boolean | undefined }) {
  return (
    <View style={styles.summaryTotalRow}>
      <Text style={[styles.summaryTotalLabel, props.strong ? styles.summaryTotalLabelStrong : null]}>{props.label}</Text>
      <Text style={[styles.summaryTotalValue, props.strong ? styles.summaryTotalValueStrong : null]}>{props.value}</Text>
    </View>
  );
}

function formatTaxRate(taxRate: number): string {
  const percent = taxRate <= 1 ? taxRate * 100 : taxRate;
  return `${Number.isInteger(percent) ? percent.toFixed(0) : percent.toFixed(2).replace(/\.?0+$/, "")}%`;
}

function quoteStatusMeta(input: { quote: QuoteRecord; events: QuoteEvent[] }): string {
  const sentEvent = [...input.events].reverse().find((event) => event.type === "sent");
  const basis = sentEvent?.createdAt ?? input.quote.sentAt ?? input.quote.updatedAt;

  return `${relativeDayTime(basis)} · valid to ${formatShortDate(input.quote.validUntil)}`;
}

function relativeDayTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit"
  }).format(date);

  return `${sameDay ? "today" : formatShortDate(iso)} at ${time}`;
}

function quoteStatusLabel(status: string): string {
  if (status === "sent") {
    return "Sent";
  }

  if (status === "viewed") {
    return "Viewed";
  }

  if (status === "accepted") {
    return "Accepted";
  }

  if (status === "declined") {
    return "Declined";
  }

  if (status === "superseded") {
    return "Superseded";
  }

  return `${status.charAt(0).toUpperCase()}${status.slice(1)}`;
}

function detailStatusPillStyle(status: string) {
  if (status === "accepted") {
    return styles.detailStatusPillGreen;
  }

  if (status === "declined" || status === "expired") {
    return styles.detailStatusPillRed;
  }

  if (status === "viewed") {
    return styles.detailStatusPillAmber;
  }

  return styles.detailStatusPillNeutral;
}

function detailStatusTextStyle(status: string) {
  if (status === "accepted") {
    return styles.detailStatusTextGreen;
  }

  if (status === "declined" || status === "expired") {
    return styles.detailStatusTextRed;
  }

  if (status === "viewed") {
    return styles.detailStatusTextAmber;
  }

  return styles.detailStatusTextNeutral;
}

function ContactAction(props: { icon: "phone" | "mail" | "link"; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={props.onPress} style={styles.contactAction}>
      {props.icon === "phone" ? (
        <Phone color={colors.ink2} size={16} strokeWidth={2.2} />
      ) : props.icon === "mail" ? (
        <Mail color={colors.ink2} size={16} strokeWidth={2.2} />
      ) : (
        <Link2 color={colors.ink2} size={16} strokeWidth={2.2} />
      )}
      <Text style={styles.contactActionText}>{props.label}</Text>
    </Pressable>
  );
}

function MenuRow(props: { icon: ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={props.onPress} style={styles.menuRow}>
      {props.icon}
      <Text style={styles.menuRowText}>{props.label}</Text>
    </Pressable>
  );
}

function eventLabel(event: QuoteEvent): string {
  switch (event.type) {
    case "created":
      return "Created";
    case "sent":
      return "Sent · email";
    case "viewed":
      return "Viewed";
    case "accepted":
      return "Accepted";
    case "declined":
      return "Declined";
    case "expired":
      return "Expired";
    case "followed_up":
      return "Follow-up sent";
    case "superseded":
      return "Superseded";
    default:
      return event.type;
  }
}

function lineTitle(line: StoredLineItem): string {
  const description = line.description;

  if (/paint ceilings?/i.test(description)) {
    return "Paint ceilings";
  }

  if (/paint doors?/i.test(description)) {
    return "Paint doors";
  }

  if (/paint walls?/i.test(description)) {
    return "Paint walls";
  }

  if (/paint trim/i.test(description)) {
    return "Paint trim";
  }

  return description;
}

function lineSubtitle(line: StoredLineItem): string {
  if (/remove wallpaper/i.test(line.description)) {
    return "Hallway · no match found";
  }

  if (line.matchState === "yellow") {
    return "Starter price — confirm once";
  }

  return describeQuantity(line.quantity, line.unit);
}

function lineSourceText(line: StoredLineItem, tone: "green" | "yellow" | "red"): string {
  if (tone === "green") {
    return `${describeQuantity(line.quantity, line.unit)} · ${line.source === "manual" ? "you priced this" : "from your book"}`;
  }

  if (tone === "yellow") {
    return "Starter price · confirm once";
  }

  return lineSubtitle(line);
}

function coverageSubtitle(input: {
  confirmCount: number;
  priceCount: number;
  totalCount: number;
  trustedCount: number;
}): string {
  if (input.confirmCount === 0 && input.priceCount === 0) {
    return `${input.trustedCount} of ${input.totalCount} · nothing guessed`;
  }

  const parts = [`${input.trustedCount} of ${input.totalCount} trusted`];

  if (input.confirmCount > 0) {
    parts.push(`${input.confirmCount} to confirm`);
  }

  if (input.priceCount > 0) {
    parts.push(`${input.priceCount} to price`);
  }

  return parts.join(" · ");
}

function buildCoverageSlots(lines: StoredLineItem[]): Array<StoredLineItem | null> {
  const minimumSlots = 8;
  const slots: Array<StoredLineItem | null> = [...lines];

  while (slots.length < minimumSlots) {
    slots.push(null);
  }

  return slots;
}

function footerStatusText(blockers: ReturnType<typeof getQuoteBlockers>): string {
  const blockerCount = blockers.redLineCount + blockers.yellowLineCount;

  if (blockerCount === 0) {
    return "Ready to send";
  }

  if (blockers.redLineCount > 0) {
    return `${blockerCount} ${blockerCount === 1 ? "line" : "lines"} still unresolved`;
  }

  return `${blockerCount} ${blockerCount === 1 ? "line" : "lines"} to review`;
}

function footerStatusStyle(tone: "red" | "amber" | "green") {
  if (tone === "red") {
    return styles.footerStatusRed;
  }

  if (tone === "amber") {
    return styles.footerStatusAmber;
  }

  return styles.footerStatusGreen;
}

function linePalette(tone: "green" | "yellow" | "red") {
  if (tone === "green") {
    return { fg: colors.green, bg: colors.greenBg, border: colors.greenBorder };
  }

  if (tone === "yellow") {
    return { fg: colors.amber, bg: colors.amberBg, border: colors.amberBorder };
  }

  return { fg: colors.red, bg: colors.redBg, border: colors.redBorder };
}

function matchColor(matchState: StoredLineItem["matchState"]): string {
  if (matchState === "green") {
    return colors.green;
  }

  if (matchState === "yellow") {
    return colors.amber;
  }

  return colors.red;
}

const styles = StyleSheet.create({
  notFound: {
    padding: spacing.lg
  },
  draftContent: {
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 22,
    paddingTop: 18
  },
  draftNav: {
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
    height: 38,
    justifyContent: "center",
    width: 38
  },
  navTitle: {
    color: colors.ink3,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2.2,
    textTransform: "uppercase"
  },
  draftNavIdentity: {
    flex: 1,
    gap: 2,
    minWidth: 0,
    paddingHorizontal: 12
  },
  draftNavName: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 0,
    lineHeight: 24
  },
  draftNavMeta: {
    color: colors.ink3,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18
  },
  draftHeader: {
    gap: 2,
    marginTop: 2
  },
  customerName: {
    color: colors.ink,
    fontSize: 23,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 27,
    textAlign: "center"
  },
  jobMeta: {
    color: colors.ink2,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center"
  },
  coverageCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 10,
    padding: 13
  },
  quietCoverageLine: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 2,
    paddingVertical: 4
  },
  quietCoverageMark: {
    alignItems: "center",
    backgroundColor: colors.green,
    borderRadius: 999,
    height: 15,
    justifyContent: "center",
    width: 15
  },
  quietCoverageText: {
    color: colors.green,
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 17
  },
  coverageHero: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14
  },
  coverageIcon: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    height: 46,
    justifyContent: "center",
    width: 46
  },
  coverageIconComplete: {
    backgroundColor: colors.green
  },
  coverageCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0
  },
  coverageTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 22
  },
  coverageTitleComplete: {
    color: "#23734F"
  },
  coverageSubtitle: {
    color: colors.ink2,
    fontSize: 13,
    fontWeight: "700"
  },
  coverageSubtitleComplete: {
    color: colors.green
  },
  coverageLabel: {
    color: colors.ink2,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.8,
    textTransform: "uppercase"
  },
  coverageCount: {
    color: colors.ink2,
    fontSize: 12,
    fontWeight: "900"
  },
  coverageBars: {
    flexDirection: "row",
    gap: 5
  },
  coverageBar: {
    borderRadius: 3,
    flex: 1,
    height: 13
  },
  coverageBarComplete: {
    backgroundColor: colors.green,
    height: 13
  },
  coverageBarEmpty: {
    backgroundColor: colors.border,
    opacity: 0.75
  },
  coverageLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9
  },
  coverageLegendItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5
  },
  coverageDot: {
    borderRadius: 3,
    height: 10,
    width: 10
  },
  coverageLegendText: {
    color: colors.ink2,
    fontSize: 11,
    fontWeight: "600"
  },
  lineSection: {
    color: colors.ink3,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.8,
    marginTop: 4,
    textTransform: "uppercase"
  },
  lineCardShell: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden"
  },
  lineCard: {
    flexDirection: "row",
    minHeight: 62
  },
  lineRail: {
    width: 5
  },
  lineBody: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  lineTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between"
  },
  lineIconBadge: {
    alignItems: "center",
    borderRadius: 9,
    height: 34,
    justifyContent: "center",
    width: 34
  },
  lineText: {
    flex: 1,
    gap: 2,
    minWidth: 0
  },
  lineTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800"
  },
  lineSub: {
    color: colors.ink3,
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2
  },
  lineAmount: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "800"
  },
  lineActionArea: {
    alignItems: "flex-end",
    gap: 5,
    width: 118
  },
  suggestedPrice: {
    color: colors.amber,
    fontSize: 11,
    fontWeight: "800"
  },
  lineActionButton: {
    alignItems: "center",
    borderRadius: 9,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    minHeight: 31,
    paddingHorizontal: 12
  },
  lineActionText: {
    fontSize: 13,
    fontWeight: "800"
  },
  addLine: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 10,
    borderStyle: "dashed",
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    height: 44,
    justifyContent: "center"
  },
  addLineText: {
    color: colors.ink2,
    fontSize: 13,
    fontWeight: "800"
  },
  resolveFooter: {
    backgroundColor: "rgba(255,254,250,0.97)",
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: 9,
    paddingHorizontal: 20,
    paddingTop: 14
  },
  footerTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  footerCopy: {
    gap: 3
  },
  footerLabel: {
    color: colors.ink2,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.7,
    textTransform: "uppercase"
  },
  footerStatus: {
    fontSize: 14,
    fontWeight: "900"
  },
  footerStatusRed: {
    color: colors.red
  },
  footerStatusAmber: {
    color: colors.amber
  },
  footerStatusGreen: {
    color: colors.green
  },
  footerAmount: {
    color: colors.ink,
    fontSize: 31,
    fontWeight: "900",
    lineHeight: 34
  },
  footerAmountBlock: {
    alignItems: "flex-end",
    gap: 1
  },
  footerTax: {
    color: colors.ink3,
    fontSize: 13,
    fontWeight: "700"
  },
  footerPlus: {
    color: colors.ink2,
    fontSize: 15
  },
  resolveButton: {
    alignItems: "center",
    backgroundColor: colors.dark,
    borderRadius: 10,
    flexDirection: "row",
    gap: 8,
    height: 50,
    justifyContent: "center"
  },
  resolveButtonDisabled: {
    backgroundColor: "#CCC9BF"
  },
  resolveButtonText: {
    color: colors.onDark,
    fontSize: 15,
    fontWeight: "900"
  },
  resolveButtonTextDisabled: {
    color: colors.ink2
  },
  saveLaterButton: {
    alignItems: "center",
    height: 28,
    justifyContent: "center"
  },
  saveLaterText: {
    color: colors.ink2,
    fontSize: 12,
    fontWeight: "800"
  },
  footerLock: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
    justifyContent: "center",
    paddingBottom: 6
  },
  footerLockText: {
    color: colors.ink3,
    fontSize: 11,
    fontWeight: "600"
  },
  detailScreen: {
    flex: 1
  },
  detailContent: {
    gap: 10,
    paddingBottom: 20,
    paddingHorizontal: 20,
    paddingTop: 8
  },
  detailNavIdentity: {
    flex: 1,
    gap: 1,
    minWidth: 0,
    paddingHorizontal: 10
  },
  detailNavName: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 17
  },
  detailNavMeta: {
    color: colors.ink2,
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 14
  },
  detailHeader: {
    alignItems: "flex-start",
    gap: 7,
    marginTop: -2,
    paddingHorizontal: 2
  },
  detailHeroAmount: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 32
  },
  detailStatusRow: {
    alignItems: "center",
    flexWrap: "wrap",
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-start",
    marginTop: 0
  },
  detailStatusPill: {
    borderRadius: 7,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  detailStatusPillGreen: {
    backgroundColor: colors.greenBg,
    borderColor: colors.greenBorder
  },
  detailStatusPillAmber: {
    backgroundColor: colors.amberBg,
    borderColor: colors.amberBorder
  },
  detailStatusPillRed: {
    backgroundColor: colors.redBg,
    borderColor: colors.redBorder
  },
  detailStatusPillNeutral: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border
  },
  detailStatusText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.7,
    textTransform: "uppercase"
  },
  detailStatusTextGreen: {
    color: colors.green
  },
  detailStatusTextAmber: {
    color: colors.amber
  },
  detailStatusTextRed: {
    color: colors.red
  },
  detailStatusTextNeutral: {
    color: colors.ink2
  },
  detailValidUntil: {
    color: colors.ink3,
    fontSize: 11,
    fontWeight: "700"
  },
  quoteSummaryCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: "hidden",
    paddingHorizontal: 15,
    paddingVertical: 13
  },
  summaryHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6
  },
  summaryHeaderLabel: {
    color: colors.ink3,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.7,
    textTransform: "uppercase"
  },
  summaryHeaderCount: {
    color: colors.ink2,
    fontSize: 12,
    fontWeight: "900"
  },
  summaryLine: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingVertical: 9
  },
  summaryLineBorder: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1
  },
  summaryLineText: {
    flex: 1,
    gap: 2,
    minWidth: 0
  },
  summaryLineTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900"
  },
  summaryLineSub: {
    color: colors.ink3,
    fontSize: 11,
    fontWeight: "600"
  },
  summaryLineAmount: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900"
  },
  summaryMore: {
    color: colors.ink3,
    fontSize: 11,
    fontWeight: "700",
    paddingBottom: 8,
    paddingTop: 2
  },
  summaryDivider: {
    backgroundColor: colors.border,
    height: 1,
    marginBottom: 9,
    marginTop: 4
  },
  summaryTotals: {
    gap: 2
  },
  summaryTotalRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2
  },
  summaryTotalLabel: {
    color: colors.ink2,
    fontSize: 12,
    fontWeight: "700"
  },
  summaryTotalLabelStrong: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900"
  },
  summaryTotalValue: {
    color: colors.ink2,
    fontSize: 12,
    fontWeight: "800"
  },
  summaryTotalValueStrong: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900"
  },
  timelineCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: "hidden",
    paddingBottom: 13,
    paddingHorizontal: 14,
    paddingTop: 13
  },
  timelineTitle: {
    color: colors.ink3,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.6,
    marginBottom: 14,
    textTransform: "uppercase"
  },
  timelineRow: {
    flexDirection: "row",
    gap: 10
  },
  timelineDotColumn: {
    alignItems: "center",
    width: 12
  },
  timelineDot: {
    backgroundColor: colors.dark,
    borderRadius: radius.pill,
    height: 10,
    width: 10
  },
  timelineDotOpen: {
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 10,
    width: 10
  },
  timelineRail: {
    backgroundColor: colors.border,
    flex: 1,
    minHeight: 18,
    width: 2
  },
  timelineText: {
    flex: 1,
    paddingBottom: 12
  },
  timelineLabel: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700"
  },
  timelineDate: {
    color: colors.ink3,
    fontSize: 11
  },
  timelineMuted: {
    color: colors.ink2,
    fontSize: 13,
    fontWeight: "700"
  },
  contactActions: {
    flexDirection: "row",
    gap: 10
  },
  contactAction: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    gap: 7,
    height: 58,
    justifyContent: "center"
  },
  contactActionText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "800"
  },
  detailMut: {
    color: colors.ink3,
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center"
  },
  followUpFooter: {
    backgroundColor: "rgba(255,254,250,0.97)",
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 12
  },
  followUpButton: {
    alignItems: "center",
    backgroundColor: colors.dark,
    borderRadius: 10,
    flexDirection: "row",
    gap: 8,
    height: 48,
    justifyContent: "center"
  },
  followUpButtonDisabled: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1
  },
  followUpButtonText: {
    color: colors.onDark,
    fontSize: 14,
    fontWeight: "900"
  },
  followUpButtonTextDisabled: {
    color: colors.ink3
  },
  menuScrim: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5
  },
  detailMenu: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    position: "absolute",
    right: 20,
    top: 56,
    width: 238,
    zIndex: 6
  },
  menuRow: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 11,
    minHeight: 41,
    paddingHorizontal: 14
  },
  menuRowText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700"
  },
  menuNote: {
    backgroundColor: colors.surfaceRaised,
    padding: 13
  },
  menuNoteText: {
    color: colors.ink3,
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 15
  }
});
