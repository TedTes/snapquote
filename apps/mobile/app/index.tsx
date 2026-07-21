import { useMemo } from "react";
import { ArrowRight, Camera, Check, CircleAlert, Clock3, Lock, Mic, Plus } from "lucide-react-native";
import { router } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { BottomTabBar } from "../src/ui/BottomTabBar";
import { QuoteCard } from "../src/ui/QuoteCard";
import { QuoteMark } from "../src/ui/QuoteMark";
import { Screen } from "../src/ui/components";
import { colors, radius } from "../src/ui/theme";
import { formatMoney, initials } from "../src/lib/format";
import { useQuoteRows } from "../src/state/useQuoteRows";
import { useMvpStore, type QuoteRecord } from "../src/state/mvp";

type QuotesFilter = "draft" | "sent" | "viewed" | "stale" | "accepted";

export default function DashboardScreen() {
  const businessName = useMvpStore((state) => state.businessName);
  const startNewQuoteWizard = useMvpStore((state) => state.startNewQuoteWizard);
  const priceBookItems = useMvpStore((state) => state.priceBookItems);
  const rows = useQuoteRows();
  const starterPricesToConfirm = priceBookItems.filter((item) => item.confirmedAt === null).length;

  const metrics = useMemo(() => {
    const activeRows = rows.filter(
      (row) => row.status === "draft" || row.status === "sent" || row.status === "viewed"
    );
    const draftRows = rows.filter((row) => row.status === "draft");
    const draftBlockedRows = draftRows.filter((row) => row.blockers.reasons.length > 0);
    const readyRows = draftRows.filter((row) => row.blockers.reasons.length === 0);
    const staleRows = rows.filter((row) => row.stale);
    const sentRows = rows.filter((row) => row.status === "sent");
    const acceptedRows = rows.filter((row) => row.status === "accepted");
    const viewedRows = rows.filter((row) => row.status === "viewed");
    const totalValue = activeRows.reduce((sum, row) => sum + (row.totals?.totalCents ?? 0), 0);
    const readyValue = readyRows.reduce((sum, row) => sum + (row.totals?.totalCents ?? 0), 0);

    return {
      activeRows,
      acceptedRows,
      draftBlockedRows,
      draftRows,
      readyRows,
      readyValue,
      sentRows,
      staleRows,
      totalValue,
      viewedRows
    };
  }, [rows]);

  const activeQuotes = useMemo(
    () => [...rows].sort((a, b) => b.quote.updatedAt.localeCompare(a.quote.updatedAt)).slice(0, 4),
    [rows]
  );

  function startQuote() {
    startNewQuoteWizard();
    router.push("/new-quote");
  }

  function photosComingSoon() {
    Alert.alert(
      "Photo capture is coming soon",
      "For now, snap photos on your camera roll and mention what they show in your voice note."
    );
  }

  function openQuote(quote: QuoteRecord) {
    router.push({ pathname: "/quote/[id]", params: { id: quote.id } });
  }

  function goToQuotes(filter?: QuotesFilter) {
    router.push(filter ? { pathname: "/quotes", params: { filter } } : "/quotes");
  }

  return (
    <Screen edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>{businessName.toUpperCase()}</Text>
            <Text style={styles.title}>Today</Text>
            <Text style={styles.date}>{formatToday()}</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(businessName)}</Text>
          </View>
        </View>

        {rows.length === 0 ? (
          <EmptyDashboardState
            businessReady
            onCamera={photosComingSoon}
            onConfirmPrices={() => router.push("/price-book")}
            onNewQuote={startQuote}
            onVoice={startQuote}
            starterPricesToConfirm={starterPricesToConfirm}
            totalPriceItems={priceBookItems.length}
          />
        ) : (
          <>
            <View style={styles.pipelineCard}>
              <View style={styles.pipelineTopRow}>
                <Text style={styles.cardLabel}>Open pipeline</Text>
                <Text style={styles.pipelineCount}>
                  {metrics.activeRows.length} {metrics.activeRows.length === 1 ? "quote" : "quotes"}
                </Text>
              </View>
              <Text style={styles.pipelineValue}>{formatMoney(metrics.totalValue)}</Text>

              <View style={styles.pipelineTrack}>
                <PipelineSegment
                  color={colors.borderStrong}
                  flexValue={Math.max(metrics.draftRows.length, 1)}
                  muted={metrics.draftRows.length === 0}
                />
                <PipelineSegment
                  color={colors.dark}
                  flexValue={Math.max(metrics.sentRows.length + metrics.viewedRows.length, 1)}
                  muted={metrics.sentRows.length + metrics.viewedRows.length === 0}
                />
                <PipelineSegment
                  color={colors.green}
                  flexValue={Math.max(metrics.acceptedRows.length, 1)}
                  muted={metrics.acceptedRows.length === 0}
                />
              </View>

              <View style={styles.legend}>
                <Legend color={colors.borderStrong} label="Draft" />
                <Legend color={colors.dark} label="Sent" />
                <Legend color={colors.green} label="Accepted" />
              </View>
            </View>

            <View style={styles.actionRow}>
              <Pressable accessibilityRole="button" onPress={startQuote} style={styles.newQuoteButton}>
                <Plus color={colors.onDark} size={18} strokeWidth={2.7} />
                <Text style={styles.newQuoteText}>New quote</Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Start with voice"
                accessibilityRole="button"
                onPress={startQuote}
                style={styles.iconButton}
              >
                <Mic color={colors.ink} size={18} strokeWidth={2.5} />
              </Pressable>
              <Pressable
                accessibilityLabel="Add job photos"
                accessibilityRole="button"
                onPress={photosComingSoon}
                style={styles.iconButton}
              >
                <Camera color={colors.ink} size={18} strokeWidth={2.5} />
              </Pressable>
            </View>

            <Text style={styles.sectionLabel}>Needs you today</Text>
            <View style={styles.attentionCard}>
              <AttentionRow
                action="Price"
                count={metrics.draftBlockedRows.length}
                icon="alert"
                onPress={() => goToQuotes("draft")}
                subtitle="Red lines are blocking send"
                title={
                  metrics.draftBlockedRows.length === 0
                    ? "No drafts need a price"
                    : `${metrics.draftBlockedRows.length} ${plural(metrics.draftBlockedRows.length, "draft")} need a price`
                }
                tone="red"
              />
              <AttentionRow
                action="Send"
                count={metrics.readyRows.length}
                icon="check"
                onPress={() => goToQuotes("draft")}
                subtitle={`${formatMoney(metrics.readyValue)} fully priced & waiting`}
                title={
                  metrics.readyRows.length === 0
                    ? "No drafts ready to send"
                    : `${metrics.readyRows.length} ${plural(metrics.readyRows.length, "draft")} ready to send`
                }
                tone="green"
              />
              <AttentionRow
                action="Nudge"
                count={metrics.staleRows.length}
                icon="clock"
                last
                onPress={() => goToQuotes("stale")}
                subtitle="Sent 3+ days ago, no reply"
                title={
                  metrics.staleRows.length === 0
                    ? "No follow-ups due"
                    : `${metrics.staleRows.length} ${plural(metrics.staleRows.length, "quote")} to follow up`
                }
                tone="amber"
              />
            </View>

            <View style={styles.activeHeader}>
              <Text style={styles.sectionLabel}>Active quotes</Text>
              <Pressable accessibilityRole="button" onPress={() => goToQuotes()}>
                <Text style={styles.seeAll}>See all {rows.length}</Text>
              </Pressable>
            </View>

            {activeQuotes.map((row) => (
              <QuoteCard key={row.quote.id} onPress={() => openQuote(row.quote)} row={row} />
            ))}
          </>
        )}
      </ScrollView>
      <BottomTabBar />
    </Screen>
  );
}

function EmptyDashboardState(props: {
  businessReady: boolean;
  onCamera: () => void;
  onConfirmPrices: () => void;
  onNewQuote: () => void;
  onVoice: () => void;
  starterPricesToConfirm: number;
  totalPriceItems: number;
}) {
  return (
    <>
      <View style={styles.firstQuoteCard}>
        <View style={styles.emptyIconCard}>
          <QuoteMark />
        </View>

        <Text style={styles.firstQuoteTitle}>Send your first quote</Text>
        <Text style={styles.firstQuoteCopy}>
          Walk the job, talk it through, and SnapQuote drafts the scope — priced only from your book.
        </Text>

        <View style={styles.firstQuoteActions}>
          <Pressable accessibilityRole="button" onPress={props.onNewQuote} style={styles.firstQuotePrimary}>
            <Plus color={colors.onDark} size={16} strokeWidth={2.8} />
            <Text style={styles.firstQuotePrimaryText}>New quote</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Start with voice"
            accessibilityRole="button"
            onPress={props.onVoice}
            style={styles.firstQuoteIconButton}
          >
            <Mic color={colors.ink} size={17} strokeWidth={2.4} />
          </Pressable>
          <Pressable
            accessibilityLabel="Add job photos"
            accessibilityRole="button"
            onPress={props.onCamera}
            style={styles.firstQuoteIconButton}
          >
            <Camera color={colors.ink} size={17} strokeWidth={2.4} />
          </Pressable>
        </View>

        <View style={styles.firstQuoteLock}>
          <Lock color={colors.ink3} size={11} strokeWidth={2.1} />
          <Text style={styles.firstQuoteLockText}>No guessed prices — ever</Text>
        </View>
      </View>

      <Text style={[styles.sectionLabel, styles.setupLabel]}>Finish setting up</Text>
      <View style={styles.setupCard}>
        <SetupRow
          action={props.starterPricesToConfirm > 0 ? "Confirm" : "Done"}
          done={props.starterPricesToConfirm === 0}
          icon="book"
          last={false}
          onPress={props.onConfirmPrices}
          subtitle={
            props.starterPricesToConfirm > 0
              ? `${props.starterPricesToConfirm} of ${props.totalPriceItems} still need your ok`
              : `${props.totalPriceItems} prices ready to match`
          }
          title={props.starterPricesToConfirm > 0 ? "Confirm your starter prices" : "Starter prices confirmed"}
        />
        <SetupRow
          action="Done"
          done={props.businessReady}
          icon="check"
          last
          onPress={() => router.push("/settings")}
          subtitle="Name, tax rate, terms"
          title="Business details added"
        />
      </View>
    </>
  );
}

function SetupRow(props: {
  action: string;
  done: boolean;
  icon: "book" | "check";
  last: boolean;
  onPress: () => void;
  subtitle: string;
  title: string;
}) {
  const color = props.done ? colors.green : colors.amber;
  const bg = props.done ? colors.greenBg : colors.amberBg;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onPress}
      style={[styles.setupRow, props.last ? styles.setupRowLast : null]}
    >
      <View style={[styles.setupIcon, { backgroundColor: bg }]}>
        {props.icon === "check" ? (
          <Check color={color} size={16} strokeWidth={2.7} />
        ) : (
          <Text style={[styles.setupBookIcon, { color }]}>B</Text>
        )}
      </View>
      <View style={styles.setupText}>
        <Text style={styles.setupTitle}>{props.title}</Text>
        <Text style={styles.setupSub}>{props.subtitle}</Text>
      </View>
      <View style={styles.setupActionWrap}>
        <Text style={[styles.setupAction, { color }]}>{props.action}</Text>
        {props.done ? null : <ArrowRight color={color} size={13} strokeWidth={2.6} />}
      </View>
    </Pressable>
  );
}

function AttentionRow(props: {
  action: string;
  count: number;
  icon: "alert" | "check" | "clock";
  last?: boolean | undefined;
  onPress: () => void;
  subtitle: string;
  title: string;
  tone: "red" | "green" | "amber";
}) {
  const palette = tonePalette(props.tone);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onPress}
      style={[styles.attentionRow, props.last ? styles.attentionRowLast : null]}
    >
      <View style={[styles.attentionIcon, { backgroundColor: palette.bg }]}>
        {props.icon === "check" ? (
          <Check color={palette.fg} size={15} strokeWidth={2.8} />
        ) : props.icon === "clock" ? (
          <Clock3 color={palette.fg} size={15} strokeWidth={2.4} />
        ) : (
          <CircleAlert color={palette.fg} size={15} strokeWidth={2.4} />
        )}
      </View>
      <View style={styles.attentionText}>
        <Text style={styles.attentionTitle}>{props.title}</Text>
        <Text style={styles.attentionSub}>{props.subtitle}</Text>
      </View>
      <View style={styles.attentionActionWrap}>
        <Text style={[styles.attentionAction, { color: palette.fg }]}>{props.action}</Text>
        <ArrowRight color={palette.fg} size={14} strokeWidth={2.7} />
      </View>
    </Pressable>
  );
}

function Legend(props: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: props.color }]} />
      <Text style={styles.legendText}>{props.label}</Text>
    </View>
  );
}

function PipelineSegment(props: { color: string; flexValue: number; muted: boolean }) {
  return (
    <View
      style={[
        styles.pipelineSegment,
        {
          backgroundColor: props.muted ? colors.border : props.color,
          flex: props.flexValue
        }
      ]}
    />
  );
}

function tonePalette(tone: "red" | "green" | "amber") {
  if (tone === "green") {
    return { fg: colors.green, bg: colors.greenBg };
  }

  if (tone === "amber") {
    return { fg: colors.amber, bg: colors.amberBg };
  }

  return { fg: colors.red, bg: colors.redBg };
}

function formatToday(): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric"
  }).format(new Date());
}

function plural(count: number, noun: string): string {
  return count === 1 ? noun : `${noun}s`;
}

const styles = StyleSheet.create({
  content: {
    gap: 15,
    padding: 20,
    paddingBottom: 28
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  eyebrow: {
    color: colors.ink3,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2.1
  },
  title: {
    color: colors.ink,
    fontSize: 27,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 31,
    marginTop: 4
  },
  date: {
    color: colors.ink2,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 1
  },
  avatar: {
    alignItems: "center",
    backgroundColor: colors.dark,
    borderRadius: 11,
    height: 39,
    justifyContent: "center",
    width: 39
  },
  avatarText: {
    color: colors.onDark,
    fontSize: 14,
    fontWeight: "900"
  },
  pipelineCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 13
  },
  pipelineTopRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  cardLabel: {
    color: colors.ink2,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.7,
    textTransform: "uppercase"
  },
  pipelineCount: {
    color: colors.ink3,
    fontSize: 12,
    fontWeight: "700"
  },
  pipelineValue: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 0,
    marginTop: 4
  },
  pipelineTrack: {
    flexDirection: "row",
    gap: 3,
    height: 7,
    marginTop: 10
  },
  pipelineSegment: {
    borderRadius: radius.pill
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
    marginTop: 8
  },
  legendItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5
  },
  legendDot: {
    borderRadius: 3,
    height: 8,
    width: 8
  },
  legendText: {
    color: colors.ink2,
    fontSize: 11,
    fontWeight: "600"
  },
  actionRow: {
    flexDirection: "row",
    gap: 10
  },
  newQuoteButton: {
    alignItems: "center",
    backgroundColor: colors.dark,
    borderRadius: 13,
    flex: 1,
    flexDirection: "row",
    gap: 8,
    height: 50,
    justifyContent: "center"
  },
  newQuoteText: {
    color: colors.onDark,
    fontSize: 16,
    fontWeight: "900"
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 13,
    borderWidth: 1,
    height: 50,
    justifyContent: "center",
    width: 54
  },
  sectionLabel: {
    color: colors.ink2,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.9,
    textTransform: "uppercase"
  },
  attentionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden"
  },
  attentionRow: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 11,
    minHeight: 67,
    paddingHorizontal: 14
  },
  attentionRowLast: {
    borderBottomWidth: 0
  },
  attentionIcon: {
    alignItems: "center",
    borderRadius: 19,
    height: 38,
    justifyContent: "center",
    width: 38
  },
  attentionText: {
    flex: 1,
    gap: 2
  },
  attentionTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900"
  },
  attentionSub: {
    color: colors.ink3,
    fontSize: 12,
    fontWeight: "600"
  },
  attentionActionWrap: {
    alignItems: "center",
    flexDirection: "row",
    gap: 3
  },
  attentionAction: {
    fontSize: 13,
    fontWeight: "900"
  },
  activeHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8
  },
  seeAll: {
    color: colors.ink3,
    fontSize: 12,
    fontWeight: "800"
  },
  firstQuoteCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: 2,
    paddingBottom: 15,
    paddingHorizontal: 18,
    paddingTop: 22
  },
  emptyIconCard: {
    alignItems: "center",
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    height: 84,
    justifyContent: "center",
    width: 84
  },
  firstQuoteTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 21,
    marginTop: 15,
    textAlign: "center"
  },
  firstQuoteCopy: {
    color: colors.ink2,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
    marginTop: 7,
    maxWidth: 260,
    textAlign: "center"
  },
  firstQuoteActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 19,
    width: "100%"
  },
  firstQuotePrimary: {
    alignItems: "center",
    backgroundColor: colors.dark,
    borderRadius: 12,
    flex: 1,
    flexDirection: "row",
    gap: 8,
    height: 45,
    justifyContent: "center"
  },
  firstQuotePrimaryText: {
    color: colors.onDark,
    fontSize: 14,
    fontWeight: "900"
  },
  firstQuoteIconButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    height: 45,
    justifyContent: "center",
    width: 48
  },
  firstQuoteLock: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    marginTop: 12
  },
  firstQuoteLockText: {
    color: colors.ink3,
    fontSize: 11,
    fontWeight: "600"
  },
  setupLabel: {
    marginTop: 7
  },
  setupCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden"
  },
  setupRow: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 58,
    paddingHorizontal: 13
  },
  setupRowLast: {
    borderBottomWidth: 0
  },
  setupIcon: {
    alignItems: "center",
    borderRadius: 10,
    height: 34,
    justifyContent: "center",
    width: 34
  },
  setupBookIcon: {
    fontSize: 17,
    fontWeight: "800"
  },
  setupText: {
    flex: 1,
    gap: 2
  },
  setupTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900"
  },
  setupSub: {
    color: colors.ink3,
    fontSize: 11,
    fontWeight: "600"
  },
  setupActionWrap: {
    alignItems: "center",
    flexDirection: "row",
    gap: 3
  },
  setupAction: {
    fontSize: 12,
    fontWeight: "900"
  }
});
