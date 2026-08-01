import { useMemo } from "react";
import { ArrowRight, Check, CircleAlert, ClipboardCheck, Clock3, Lock } from "lucide-react-native";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { BottomTabBar } from "../../shared-ui/BottomTabBar";
import { QuoteCard } from "../quotes/components/QuoteCard";
import { Screen } from "../../shared-ui/base";
import { colors, radius } from "../../shared-ui/theme";
import { businessInitials, displayBusinessName, formatMoney } from "../../utils/format";
import { useQuoteRows } from "../../state/useQuoteRows";
import { useQuoteStore, type QuoteRecord } from "../../state/quoteStore";
import { useRemoteQuoteRefresh } from "../../sync/useRemoteQuoteRefresh";

type QuotesFilter = "draft" | "sent" | "viewed" | "stale" | "accepted";

export default function DashboardScreen() {
  const businessName = useQuoteStore((state) => state.businessName);
  const rows = useQuoteRows();
  useRemoteQuoteRefresh({ pollMs: 30000 });
  const businessDisplayName = displayBusinessName(businessName, "Add business name");

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
            <Text style={styles.eyebrow}>{businessDisplayName.toUpperCase()}</Text>
            <Text style={styles.title}>Today</Text>
            <Text style={styles.date}>{formatToday()}</Text>
          </View>
          <Pressable
            accessibilityLabel="Open profile"
            accessibilityRole="button"
            onPress={() => router.push("/settings/edit")}
            style={styles.avatar}
          >
            <Text style={styles.avatarText}>{businessInitials(businessName)}</Text>
          </Pressable>
        </View>

        {rows.length === 0 ? (
          <EmptyDashboardInfo />
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

function EmptyDashboardInfo() {
  return (
    <View style={styles.emptyCenter}>
      <View style={styles.emptyIconCard}>
        <ClipboardCheck color={colors.green} size={34} strokeWidth={2.15} />
      </View>

      <Text style={styles.emptyInfoTitle}>Send your first quote</Text>
      <Text style={styles.emptyInfoCopy}>
        Tap the + below — walk the job, talk it through, and QuoteVan drafts a priced quote from your book.
      </Text>

      <View style={styles.emptyLock}>
        <Lock color={colors.ink3} size={11} strokeWidth={2.2} />
        <Text style={styles.emptyLockText}>No guessed prices — ever</Text>
      </View>
    </View>
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
    flexGrow: 1,
    gap: 15,
    padding: 20,
    paddingBottom: 86
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
    borderRadius: 24,
    height: 48,
    justifyContent: "center",
    width: 48
  },
  avatarText: {
    color: colors.onDark,
    fontSize: 16,
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
  emptyCenter: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingBottom: 96,
    paddingHorizontal: 4
  },
  emptyIconCard: {
    alignItems: "center",
    backgroundColor: colors.dark,
    borderRadius: 17,
    height: 70,
    justifyContent: "center",
    width: 70
  },
  emptyInfoTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 17,
    textAlign: "center"
  },
  emptyInfoCopy: {
    color: colors.ink2,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
    marginTop: 9,
    maxWidth: 278,
    textAlign: "center"
  },
  emptyLock: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    marginTop: 23
  },
  emptyLockText: {
    color: colors.ink3,
    fontSize: 11,
    fontWeight: "700"
  }
});
