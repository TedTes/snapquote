import { useMemo } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronLeft,
  CircleDollarSign,
  Lock,
  Mail,
  MoreHorizontal,
  Plus
} from "lucide-react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { AnimatedCard } from "../../../src/ui/AnimatedCard";
import { Banner, Card, Chip, EmptyState, GhostButton, Screen } from "../../../src/ui/components";
import { fadeEnter, useMotionEnabled } from "../../../src/ui/motion";
import { colors, radius, spacing, type MatchTone } from "../../../src/ui/theme";
import { describeQuantity, formatDateTime, formatMoney, formatRelativeToNow } from "../../../src/lib/format";
import {
  getCustomer,
  getQuoteBlockers,
  getQuoteEvents,
  getQuoteIsStale,
  getQuoteStatus,
  getQuoteTotals,
  useMvpStore,
  type QuoteRecord,
  type StoredLineItem
} from "../../../src/state/mvp";
import type { QuoteEvent } from "@snapquote/shared";

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

  return <QuoteDetail customerName={customer?.name ?? "Unnamed customer"} events={events} quote={quote} />;
}

function DraftReview(props: { quote: QuoteRecord; customerName: string }) {
  const { quote } = props;
  const deleteDraftQuote = useMvpStore((state) => state.deleteDraftQuote);
  const confirmYellowLine = useMvpStore((state) => state.confirmYellowLine);
  const blockers = useMemo(() => getQuoteBlockers(quote), [quote]);
  const sortedLines = useMemo(() => [...quote.lineItems].sort((a, b) => a.position - b.position), [quote]);
  const trustedLines = sortedLines.filter((line) => line.matchState === "green");
  const confirmLines = sortedLines.filter((line) => line.matchState === "yellow");
  const priceLines = sortedLines.filter((line) => line.matchState === "red");
  const coverageSlots = buildCoverageSlots(sortedLines);
  const trustedTotalCents = trustedLines.reduce(
    (sum, line) => sum + Math.round(line.quantity * (line.unitPriceCents ?? 0)),
    0
  );
  const trustedCount = trustedLines.length;
  const blockerCount = blockers.redLineCount + blockers.yellowLineCount;
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
          deleteDraftQuote(quote.id);
          router.replace("/");
        }
      }
    ]);
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
          <Text style={styles.navTitle}>Draft review</Text>
          <Pressable accessibilityRole="button" onPress={openDraftMenu} style={styles.navButton}>
            <MoreHorizontal color={colors.ink} size={19} strokeWidth={2.5} />
          </Pressable>
        </View>

        <View style={styles.draftHeader}>
          <Text style={styles.customerName}>{props.customerName}</Text>
          <Text style={styles.jobMeta} numberOfLines={1}>
            {quote.address}
            {quote.jobTitle.trim().length > 0 ? ` · ${quote.jobTitle}` : ""}
          </Text>
        </View>

        <View style={styles.coverageCard}>
          <View style={styles.coverageTop}>
            <Text style={styles.coverageLabel}>Price coverage</Text>
            <Text style={styles.coverageCount}>
              {trustedCount} of {sortedLines.length} lines trusted
            </Text>
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
            <CoverageLegend color={colors.green} label={`${trustedCount} from your book`} />
            <CoverageLegend color={colors.amber} label={`${confirmLines.length} to confirm`} />
            <CoverageLegend color={colors.red} label={`${priceLines.length} to price`} />
          </View>
        </View>

        {trustedLines.map((line) => (
          <DraftLineCard key={line.id} line={line} onPress={() => openLine(line.id)} tone="green" />
        ))}

        {confirmLines.length > 0 ? <Text style={styles.lineSection}>Needs your ok</Text> : null}
        {confirmLines.map((line) => (
          <DraftLineCard
            key={line.id}
            actionLabel="Confirm"
            line={line}
            onAction={() => confirmYellowLine(quote.id, line.id)}
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
            <Text style={styles.footerLabel}>Trusted so far</Text>
            <Text style={[styles.footerStatus, footerStatusStyle(footerTone)]}>
              {footerStatusText(blockers)}
            </Text>
          </View>
          <Text style={styles.footerAmount}>
            {formatMoney(trustedTotalCents)}
            {blockerCount > 0 ? <Text style={styles.footerPlus}>+</Text> : null}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={blockerCount > 0}
          onPress={() => router.push({ pathname: "/quote/[id]/preview", params: { id: quote.id } })}
          style={[styles.resolveButton, blockerCount > 0 ? styles.resolveButtonDisabled : null]}
        >
          <Mail color={blockerCount > 0 ? colors.ink3 : colors.onDark} size={16} />
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
        <View style={[styles.lineRail, { backgroundColor: palette.fg }]} />
        <View style={styles.lineBody}>
          <View style={styles.lineTop}>
            <View style={[styles.lineIconBadge, { backgroundColor: palette.bg }]}>
              {props.tone === "green" ? (
                <CheckCircle2 color={palette.fg} size={18} strokeWidth={2.5} />
              ) : props.tone === "yellow" ? (
                <AlertTriangle color={palette.fg} size={18} strokeWidth={2.3} />
              ) : (
                <CircleDollarSign color={palette.fg} size={18} strokeWidth={2.3} />
              )}
            </View>
            <View style={styles.lineText}>
              <Text style={styles.lineTitle} numberOfLines={1}>
                {lineTitle(line)}
              </Text>
              <Text style={styles.lineSub} numberOfLines={1}>
                {lineSubtitle(line)}
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

function QuoteDetail(props: { quote: QuoteRecord; customerName: string; events: QuoteEvent[] }) {
  const { quote } = props;
  const followUpQuote = useMvpStore((state) => state.followUpQuote);
  const reviseQuote = useMvpStore((state) => state.reviseQuote);
  const duplicateQuote = useMvpStore((state) => state.duplicateQuote);
  const status = getQuoteStatus(quote, props.events);
  const totals = getQuoteTotals(quote);
  const stale = getQuoteIsStale(quote);
  const timeline = useMemo(() => getQuoteEvents(props.events, quote.id), [props.events, quote.id]);

  function revise() {
    const newId = reviseQuote(quote.id);
    router.push({ pathname: "/quote/[id]", params: { id: newId } });
  }

  function duplicate() {
    const newId = duplicateQuote(quote.id);
    router.push({ pathname: "/quote/[id]", params: { id: newId } });
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false}>
        <View style={styles.draftNav}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.navButton}>
            <ChevronLeft color={colors.ink} size={18} strokeWidth={2.5} />
          </Pressable>
          <Text style={styles.navTitle}>Quote detail</Text>
          <View style={styles.navButton} />
        </View>

        <View style={styles.detailHeader}>
          <Chip label={statusLabel(status)} tone={statusTone(status)} />
          <Text style={styles.customerName}>{props.customerName}</Text>
          <Text style={styles.jobMeta}>
            {quote.address} · {totals ? formatMoney(totals.totalCents) : "$--"}
            {quote.sentAt ? ` · sent ${formatRelativeToNow(quote.sentAt)}` : ""}
          </Text>
        </View>

        {stale ? (
          <>
            <Banner tone="red">Sent 3+ days ago with no response. A nudge often closes these.</Banner>
            <GhostButton label="Send follow-up email" onPress={() => followUpQuote(quote.id)} />
          </>
        ) : null}

        <Card>
          <Text style={styles.timelineTitle}>Status timeline</Text>
          {timeline.map((event, index) => (
            <View key={event.id} style={styles.timelineRow}>
              <View style={styles.timelineDotColumn}>
                <View style={styles.timelineDot} />
                {index < timeline.length - 1 ? <View style={styles.timelineRail} /> : null}
              </View>
              <View style={styles.timelineText}>
                <Text style={styles.timelineLabel}>{eventLabel(event)}</Text>
                <Text style={styles.timelineDate}>{formatDateTime(event.createdAt)}</Text>
              </View>
            </View>
          ))}
        </Card>

        {status !== "superseded" ? (
          <View style={styles.detailActions}>
            <View style={styles.detailActionItem}>
              <GhostButton label="Revise" onPress={revise} small />
            </View>
            <View style={styles.detailActionItem}>
              <GhostButton label="Duplicate" onPress={duplicate} small />
            </View>
          </View>
        ) : null}

        <Text style={styles.detailMut}>
          Sent quotes are locked. Revise creates a new draft and marks this one Superseded.
        </Text>
      </ScrollView>
    </Screen>
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

function statusLabel(status: string): string {
  return `${status.charAt(0).toUpperCase()}${status.slice(1)}`;
}

function statusTone(status: string): MatchTone | "neutral" {
  if (status === "accepted") {
    return "green";
  }

  if (status === "viewed") {
    return "yellow";
  }

  if (status === "declined" || status === "expired") {
    return "red";
  }

  return "neutral";
}

const styles = StyleSheet.create({
  notFound: {
    padding: spacing.lg
  },
  draftContent: {
    gap: 12,
    padding: 20,
    paddingBottom: 22
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
  draftHeader: {
    gap: 2,
    marginTop: 2
  },
  customerName: {
    color: colors.ink,
    fontSize: 23,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 27
  },
  jobMeta: {
    color: colors.ink2,
    fontSize: 12,
    fontWeight: "600"
  },
  coverageCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 10,
    padding: 13
  },
  coverageTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
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
    marginTop: 6,
    textTransform: "uppercase"
  },
  lineCardShell: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: "hidden"
  },
  lineCard: {
    flexDirection: "row",
    minHeight: 64
  },
  lineRail: {
    width: 5
  },
  lineBody: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  lineTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
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
    fontSize: 15,
    fontWeight: "900"
  },
  lineSub: {
    color: colors.ink3,
    fontSize: 12,
    fontWeight: "600"
  },
  lineAmount: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900"
  },
  lineActionArea: {
    alignItems: "flex-end",
    gap: 6,
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
    minHeight: 33,
    paddingHorizontal: 12
  },
  lineActionText: {
    fontSize: 13,
    fontWeight: "900"
  },
  addLine: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius.md,
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
    fontWeight: "900"
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
    fontSize: 12,
    fontWeight: "800"
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
    fontSize: 26,
    fontWeight: "900"
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
    height: 48,
    justifyContent: "center"
  },
  resolveButtonDisabled: {
    backgroundColor: "#CCC9BF"
  },
  resolveButtonText: {
    color: colors.onDark,
    fontSize: 14,
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
  detailContent: {
    gap: spacing.md,
    padding: 20,
    paddingBottom: spacing.xxl
  },
  detailHeader: {
    gap: 6
  },
  timelineTitle: {
    color: colors.ink3,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.6,
    marginBottom: spacing.sm,
    textTransform: "uppercase"
  },
  timelineRow: {
    flexDirection: "row",
    gap: spacing.sm
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
  timelineRail: {
    backgroundColor: colors.border,
    flex: 1,
    minHeight: 18,
    width: 2
  },
  timelineText: {
    flex: 1,
    paddingBottom: spacing.sm
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
  detailActions: {
    flexDirection: "row",
    gap: spacing.sm
  },
  detailActionItem: {
    flex: 1
  },
  detailMut: {
    color: colors.ink3,
    fontSize: 12,
    lineHeight: 16
  }
});
