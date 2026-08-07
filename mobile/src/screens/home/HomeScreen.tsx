import { useMemo } from "react";
import { ArrowRight, Check, CircleAlert, ClipboardCheck, Clock3, Lock } from "lucide-react-native";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { BusinessAvatar } from "../../shared-ui/BusinessAvatar";
import { BottomTabBar } from "../../shared-ui/BottomTabBar";
import { QuoteCard } from "../quotes/components/QuoteCard";
import { Screen } from "../../shared-ui/base";
import { SectionHeader } from "../../shared-ui/layout";
import { AppText } from "../../shared-ui/text";
import { colors, fontStyles, radius, typography } from "../../shared-ui/theme";
import { displayBusinessName, formatMoney } from "../../utils/format";
import { useAuthStore } from "../../state/authStore";
import { useQuoteRows } from "../../state/useQuoteRows";
import { useQuoteStore, type QuoteRecord } from "../../state/quoteStore";
import { useRemoteQuoteRefresh } from "../../sync/useRemoteQuoteRefresh";

type QuotesFilter = "draft" | "sent" | "viewed" | "stale" | "accepted";

export default function DashboardScreen() {
  const businessName = useQuoteStore((state) => state.businessName);
  const logoUrl = useAuthStore((state) => state.me?.org.logoUrl ?? null);
  const rows = useQuoteRows();
  useRemoteQuoteRefresh({ pollMs: 30000 });
  const businessDisplayName = displayBusinessName(businessName, "Add business name");

  const metrics = useMemo(() => {
    const pipelineRows = rows.filter(
      (row) =>
        row.status === "draft" ||
        row.status === "sent" ||
        row.status === "viewed" ||
        row.status === "accepted"
    );
    const draftRows = pipelineRows.filter((row) => row.status === "draft");
    const draftBlockedRows = draftRows.filter((row) => row.blockers.reasons.length > 0);
    const readyRows = draftRows.filter((row) => row.blockers.reasons.length === 0);
    const staleRows = pipelineRows.filter((row) => row.stale);
    const sentRows = pipelineRows.filter((row) => row.status === "sent");
    const acceptedRows = pipelineRows.filter((row) => row.status === "accepted");
    const viewedRows = pipelineRows.filter((row) => row.status === "viewed");
    const totalValue = pipelineRows.reduce((sum, row) => sum + (row.totals?.totalCents ?? 0), 0);
    const readyValue = readyRows.reduce((sum, row) => sum + (row.totals?.totalCents ?? 0), 0);
    const sentLikeCount = sentRows.length + viewedRows.length;
    const pipelineStatusItems = [
      { color: colors.borderStrong, count: draftRows.length, key: "draft", label: "Draft" },
      { color: colors.dark, count: sentLikeCount, key: "sent", label: "Sent" },
      { color: colors.green, count: acceptedRows.length, key: "accepted", label: "Accepted" }
    ];
    const pipelineSegments = pipelineStatusItems.filter((segment) => segment.count > 0);

    return {
      acceptedRows,
      draftBlockedRows,
      draftRows,
      pipelineRows,
      pipelineSegments,
      pipelineStatusItems,
      readyRows,
      readyValue,
      sentRows,
      staleRows,
      totalValue,
      viewedRows
    };
  }, [rows]);

  const activeQuotes = useMemo(
    () => [...metrics.pipelineRows].sort((a, b) => b.quote.updatedAt.localeCompare(a.quote.updatedAt)).slice(0, 4),
    [metrics.pipelineRows]
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
            <AppText style={styles.eyebrow} variant="sectionLabel">
              {businessDisplayName.toUpperCase()}
            </AppText>
            <AppText style={styles.dateTitle} variant="meta">
              {formatToday()}
            </AppText>
          </View>
          <Pressable
            accessibilityLabel="Open profile"
            accessibilityRole="button"
            onPress={() => router.push("/settings/edit")}
            style={styles.avatar}
          >
            <BusinessAvatar businessName={businessName} logoUrl={logoUrl} size={48} />
          </Pressable>
        </View>

        {rows.length === 0 ? (
          <EmptyDashboardInfo />
        ) : (
          <>
            <View style={styles.pipelineCard}>
              <View style={styles.pipelineTopRow}>
                <AppText style={styles.cardLabel} variant="sectionLabel">
                  Open pipeline
                </AppText>
                <AppText variant="meta">
                  {metrics.pipelineRows.length} {metrics.pipelineRows.length === 1 ? "quote" : "quotes"}
                </AppText>
              </View>
              <AppText style={styles.pipelineValue} variant="pipelineAmount">
                {formatMoney(metrics.totalValue)}
              </AppText>

              <View style={styles.pipelineTrack}>
                {metrics.pipelineSegments.length > 0 ? (
                  metrics.pipelineSegments.map((segment) => (
                    <PipelineSegment color={segment.color} flexValue={segment.count} key={segment.key} />
                  ))
                ) : (
                  <PipelineSegment color={colors.border} flexValue={1} />
                )}
              </View>

              <View style={styles.legend}>
                {metrics.pipelineStatusItems.map((item) => (
                  <Legend
                    active={item.count > 0}
                    color={item.color}
                    count={item.count}
                    key={item.key}
                    label={item.label}
                  />
                ))}
              </View>
            </View>

            <SectionHeader label="Needs you today" />
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
                    : `${metrics.draftBlockedRows.length} ${plural(metrics.draftBlockedRows.length, "draft")} ${
                        metrics.draftBlockedRows.length === 1 ? "needs" : "need"
                      } a price`
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
              <SectionHeader
                actionLabel={`See all ${metrics.pipelineRows.length}`}
                label="Active quotes"
                onActionPress={() => goToQuotes()}
                style={styles.activeSectionHeader}
              />
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

      <AppText style={styles.emptyInfoTitle} variant="rowTitle">
        Send your first quote
      </AppText>
      <AppText style={styles.emptyInfoCopy} variant="body">
        Tap the + below — walk the job, talk it through, and QuoteVan drafts a priced quote from your book.
      </AppText>

      <View style={styles.emptyLock}>
        <Lock color={colors.ink3} size={11} strokeWidth={2.2} />
        <AppText style={styles.emptyLockText} variant="meta">
          No guessed prices — ever
        </AppText>
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
        <AppText variant="attentionTitle">{props.title}</AppText>
        <AppText variant="attentionSubtitle">{props.subtitle}</AppText>
      </View>
      <View style={styles.attentionActionWrap}>
        <AppText style={styles.attentionAction} tone={props.tone} variant="button">
          {props.action}
        </AppText>
        <ArrowRight color={palette.fg} size={14} strokeWidth={2.7} />
      </View>
    </Pressable>
  );
}

function Legend(props: { active: boolean; color: string; count: number; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: props.active ? props.color : colors.border }]} />
      <AppText style={[styles.legendLabel, !props.active ? styles.legendMuted : null]} variant="rowSubtitle">
        {props.label}
      </AppText>
      <AppText style={[styles.legendCount, !props.active ? styles.legendMuted : null]} variant="rowSubtitle">
        {props.count}
      </AppText>
    </View>
  );
}

function PipelineSegment(props: { color: string; flexValue: number }) {
  return (
    <View
      style={[
        styles.pipelineSegment,
        {
          backgroundColor: props.color,
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
    ...typography.sectionLabel,
    letterSpacing: 1.7
  },
  dateTitle: {
    color: colors.ink2,
    fontSize: 14.5,
    ...fontStyles.regular,
    lineHeight: 19,
    marginTop: 4
  },
  avatar: {
    alignItems: "center",
    borderRadius: 24,
    height: 48,
    justifyContent: "center",
    width: 48
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
    ...typography.sectionLabel,
    letterSpacing: 1.5
  },
  pipelineCount: {
    color: colors.ink3,
    fontSize: 12,
    ...fontStyles.medium,
  },
  pipelineValue: {
    ...typography.pipelineAmount,
    marginTop: 4
  },
  pipelineTrack: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    flexDirection: "row",
    gap: 4,
    height: 7,
    marginTop: 10,
    overflow: "hidden"
  },
  pipelineSegment: {
    borderRadius: radius.pill
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 8
  },
  legendItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4
  },
  legendDot: {
    borderRadius: 3,
    height: 8,
    width: 8
  },
  legendLabel: {
    ...typography.rowSubtitle,
    fontSize: 11
  },
  legendCount: {
    color: colors.ink2,
    fontSize: 11,
    ...fontStyles.medium
  },
  legendMuted: {
    color: colors.inkMuted
  },
  sectionLabel: {
    ...typography.sectionLabel,
    letterSpacing: 1.6
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
    ...typography.attentionTitle
  },
  attentionSub: {
    ...typography.attentionSubtitle
  },
  attentionActionWrap: {
    alignItems: "center",
    flexDirection: "row",
    gap: 3
  },
  attentionAction: {
    fontSize: 13,
    ...fontStyles.semibold,
  },
  activeHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8
  },
  activeSectionHeader: {
    flex: 1
  },
  seeAll: {
    color: colors.ink3,
    fontSize: 12,
    ...fontStyles.medium,
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
    fontSize: 18,
    ...fontStyles.semibold,
    marginTop: 17,
    textAlign: "center"
  },
  emptyInfoCopy: {
    color: colors.ink2,
    fontSize: 12,
    ...fontStyles.regular,
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
    ...fontStyles.medium,
  }
});
