import { useCallback, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { BarChart3, RefreshCw, TriangleAlert } from "lucide-react-native";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import {
  snapquoteApi,
  userFacingErrorMessage,
  type SuggestionMetrics,
  type SuggestionMetricsPeriod
} from "../../api/client";
import { Screen, SegmentedControl, TopBar } from "../../shared-ui/base";
import { AppText } from "../../shared-ui/text";
import { colors, fontStyles, radius, spacing } from "../../shared-ui/theme";

const periodOptions: Array<{ label: string; value: SuggestionMetricsPeriod }> = [
  { label: "7 days", value: "7d" },
  { label: "30 days", value: "30d" },
  { label: "90 days", value: "90d" },
  { label: "All", value: "all" }
];

export default function AccuracyInsightsScreen() {
  const [period, setPeriod] = useState<SuggestionMetricsPeriod>("30d");
  const [metrics, setMetrics] = useState<SuggestionMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSequence = useRef(0);

  const load = useCallback(async (refresh = false) => {
    const sequence = requestSequence.current + 1;
    requestSequence.current = sequence;
    if (refresh) setRefreshing(true);
    else setLoading(true);

    try {
      const result = await snapquoteApi.getSuggestionMetrics(period);
      if (sequence !== requestSequence.current) return;
      setMetrics(result);
      setError(null);
    } catch (loadError) {
      if (sequence !== requestSequence.current) return;
      setError(userFacingErrorMessage(loadError));
    } finally {
      if (sequence === requestSequence.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [period]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const currentMetrics = metrics?.period.key === period ? metrics : null;

  return (
    <Screen edges={["top"]}>
      <TopBar backLabel="Settings" onBack={() => router.back()} title="AI accuracy" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl onRefresh={() => void load(true)} refreshing={refreshing} tintColor={colors.ink3} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <AppText variant="screenTitle">Suggestion accuracy</AppText>
          <AppText variant="headerSummary">
            See which photo suggestions help, where they miss, and how reliably analysis completes.
          </AppText>
        </View>

        <SegmentedControl onChange={setPeriod} options={periodOptions} value={period} />

        {error && currentMetrics === null ? (
          <ErrorState error={error} loading={loading} onRetry={() => void load()} />
        ) : currentMetrics === null ? (
          <LoadingState />
        ) : (
          <Dashboard metrics={currentMetrics} staleError={error} />
        )}
      </ScrollView>
    </Screen>
  );
}

function Dashboard(props: { metrics: SuggestionMetrics; staleError: string | null }) {
  const { metrics } = props;
  const hasReviews = metrics.totals.reviewed > 0;
  const trend = metrics.trend.slice(-8);

  return (
    <View style={styles.dashboard}>
      {props.staleError ? (
        <View style={styles.inlineError}>
          <TriangleAlert color={colors.red} size={16} />
          <AppText style={styles.inlineErrorText} tone="red" variant="meta">Showing saved results. {props.staleError}</AppText>
        </View>
      ) : null}

      <View style={styles.primaryPanel}>
        <View style={styles.primaryTop}>
          <View>
            <AppText style={styles.onDarkLabel} variant="sectionLabel">Accepted after review</AppText>
            <AppText style={styles.primaryValue} tone="onDark" variant="pipelineAmount">
              {formatRate(metrics.totals.acceptanceRate)}
            </AppText>
          </View>
          <View style={styles.reviewedBadge}>
            <AppText style={styles.reviewedBadgeText} tone="onDark" variant="statusPill">
              {metrics.totals.reviewed} reviewed
            </AppText>
          </View>
        </View>
        <AppText style={styles.onDarkCopy} tone="onDark" variant="body">
          Pending suggestions are excluded, so this reflects decisions you have actually made.
        </AppText>
        <View style={styles.outcomeBar}>
          <View style={[styles.outcomeAccepted, ratioStyle(metrics.totals.accepted, metrics.totals.reviewed)]} />
          <View style={[styles.outcomeRejected, ratioStyle(metrics.totals.rejected, metrics.totals.reviewed)]} />
          {!hasReviews ? <View style={styles.outcomeEmpty} /> : null}
        </View>
        <View style={styles.legend}>
          <LegendItem color={colors.greenBorder} label={`${metrics.totals.accepted} accepted`} />
          <LegendItem color={colors.redBorder} label={`${metrics.totals.rejected} rejected`} />
        </View>
      </View>

      {!hasReviews ? (
        <View style={styles.emptyPanel}>
          <View style={styles.emptyIcon}><BarChart3 color={colors.green} size={22} /></View>
          <View style={styles.emptyText}>
            <AppText variant="rowTitle">No reviewed suggestions yet</AppText>
            <AppText variant="rowSubtitle">
              Accept or reject photo suggestions on a request to start measuring accuracy.
            </AppText>
          </View>
        </View>
      ) : null}

      <View style={styles.statsRow}>
        <Stat label="Pending" value={String(metrics.totals.pending)} tone="amber" />
        <Stat label="Analysis complete" value={formatRate(metrics.totals.completionRate)} tone="green" />
        <Stat label="Decision time" value={formatHours(metrics.totals.medianDecisionHours)} tone="neutral" />
      </View>

      <MetricSection
        description="Higher-confidence suggestions should earn a higher acceptance rate."
        title="Confidence calibration"
      >
        {metrics.confidenceBands.map((band) => (
          <ProgressRow
            key={band.key}
            label={band.label}
            rate={band.acceptanceRate}
            supporting={`${band.reviewed} reviewed`}
          />
        ))}
      </MetricSection>

      {metrics.byType.length > 0 ? (
        <MetricSection description="Acceptance by the kind of suggestion produced." title="Suggestion mix">
          {metrics.byType.map((row) => (
            <ProgressRow
              key={row.type}
              label={typeLabel(row.type)}
              rate={row.acceptanceRate}
              supporting={`${row.accepted} accepted · ${row.rejected} rejected`}
            />
          ))}
        </MetricSection>
      ) : null}

      {trend.length > 0 ? (
        <MetricSection description="Recent reviewed decisions in the selected period." title="Decision trend">
          {trend.map((point) => (
            <TrendRow
              accepted={point.accepted}
              key={point.key}
              label={point.label}
              rejected={point.rejected}
            />
          ))}
        </MetricSection>
      ) : null}

      {metrics.topRejected.length > 0 ? (
        <MetricSection description="Repeated misses are the best candidates for prompt or pricing improvements." title="Most rejected">
          {metrics.topRejected.map((row, index) => (
            <View key={`${row.description}-${index}`} style={styles.rejectedRow}>
              <View style={styles.rank}><AppText variant="button">{index + 1}</AppText></View>
              <View style={styles.rejectedText}>
                <AppText numberOfLines={2} variant="rowTitle">{row.description}</AppText>
                <AppText variant="rowSubtitle">
                  {row.count} {row.count === 1 ? "rejection" : "rejections"} · {Math.round(row.averageConfidence * 100)}% avg confidence
                </AppText>
              </View>
            </View>
          ))}
        </MetricSection>
      ) : null}

      {metrics.models.length > 0 ? (
        <MetricSection description="Technical reliability of each analysis version used." title="Analysis reliability">
          {metrics.models.map((model) => (
            <View key={`${model.model}-${model.version ?? ""}`} style={styles.modelRow}>
              <View style={styles.modelText}>
                <AppText numberOfLines={1} variant="rowTitle">{model.model}</AppText>
                <AppText variant="rowSubtitle">{model.version ?? "Unversioned"} · {model.attempted} attempts</AppText>
              </View>
              <View style={styles.completionBadge}>
                <AppText style={styles.completionText} variant="statusPill">{formatRate(model.completionRate)}</AppText>
              </View>
            </View>
          ))}
        </MetricSection>
      ) : null}
    </View>
  );
}

function MetricSection(props: { title: string; description: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <AppText variant="panelTitle">{props.title}</AppText>
        <AppText variant="rowSubtitle">{props.description}</AppText>
      </View>
      <View style={styles.sectionBody}>{props.children}</View>
    </View>
  );
}

function ProgressRow(props: { label: string; supporting: string; rate: number | null }) {
  const percent = Math.round((props.rate ?? 0) * 100);

  return (
    <View style={styles.progressRow}>
      <View style={styles.progressTop}>
        <View>
          <AppText variant="rowTitle">{props.label}</AppText>
          <AppText variant="rowSubtitle">{props.supporting}</AppText>
        </View>
        <AppText style={styles.progressValue} variant="statValue">{props.rate === null ? "—" : `${percent}%`}</AppText>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${percent}%` }]} />
      </View>
    </View>
  );
}

function TrendRow(props: { label: string; accepted: number; rejected: number }) {
  const total = props.accepted + props.rejected;

  return (
    <View style={styles.trendRow}>
      <AppText style={styles.trendLabel} variant="meta">{props.label}</AppText>
      <View style={styles.trendBar}>
        <View style={[styles.trendAccepted, ratioStyle(props.accepted, total)]} />
        <View style={[styles.trendRejected, ratioStyle(props.rejected, total)]} />
      </View>
      <AppText style={styles.trendCount} variant="meta">{total}</AppText>
    </View>
  );
}

function Stat(props: { label: string; value: string; tone: "green" | "amber" | "neutral" }) {
  return (
    <View style={styles.stat}>
      <AppText style={[styles.statValue, props.tone === "green" ? styles.statGreen : null, props.tone === "amber" ? styles.statAmber : null]}>
        {props.value}
      </AppText>
      <AppText style={styles.statLabel} variant="meta">{props.label}</AppText>
    </View>
  );
}

function LegendItem(props: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: props.color }]} />
      <AppText style={styles.legendText} tone="onDark" variant="meta">{props.label}</AppText>
    </View>
  );
}

function ErrorState(props: { error: string; loading: boolean; onRetry: () => void }) {
  return (
    <View style={styles.statePanel}>
      <View style={styles.errorIcon}><TriangleAlert color={colors.red} size={24} /></View>
      <AppText variant="panelTitle">Could not load accuracy</AppText>
      <AppText style={styles.stateCopy} variant="body">{props.error}</AppText>
      <Pressable accessibilityRole="button" disabled={props.loading} onPress={props.onRetry} style={styles.retryButton}>
        <RefreshCw color={colors.onDark} size={17} />
        <AppText tone="onDark" variant="button">{props.loading ? "Retrying..." : "Try again"}</AppText>
      </Pressable>
    </View>
  );
}

function LoadingState() {
  return (
    <View style={styles.statePanel}>
      <View style={styles.emptyIcon}><BarChart3 color={colors.green} size={22} /></View>
      <AppText variant="panelTitle">Loading accuracy</AppText>
      <AppText style={styles.stateCopy} variant="body">Comparing your reviewed suggestions.</AppText>
    </View>
  );
}

function ratioStyle(value: number, total: number) {
  return { flex: total > 0 ? value / total : 0 };
}

function formatRate(value: number | null) {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

function formatHours(value: number | null) {
  if (value === null) return "—";
  if (value < 1) return `${Math.max(1, Math.round(value * 60))}m`;
  if (value < 24) return `${Math.round(value)}h`;
  return `${Math.round(value / 24)}d`;
}

function typeLabel(type: string) {
  if (type === "site_condition") return "Site conditions";
  if (type === "question") return "Questions";
  if (type === "task") return "Tasks";
  return type.replace(/_/g, " ");
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingBottom: 40, paddingHorizontal: spacing.xl, paddingTop: spacing.md },
  header: { gap: 5 },
  dashboard: { gap: spacing.lg },
  inlineError: { alignItems: "center", backgroundColor: colors.redBg, borderColor: colors.redBorder, borderRadius: radius.sm, borderWidth: 1, flexDirection: "row", gap: spacing.sm, padding: spacing.md },
  inlineErrorText: { flex: 1 },
  primaryPanel: { backgroundColor: colors.dark, borderRadius: radius.md, gap: spacing.md, padding: spacing.lg },
  primaryTop: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between" },
  onDarkLabel: { color: "#BDB9AF" },
  primaryValue: { color: colors.onDark, fontSize: 42, lineHeight: 48, marginTop: 4 },
  reviewedBadge: { backgroundColor: "#34322D", borderColor: "#56534C", borderRadius: radius.sm, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 6 },
  reviewedBadgeText: { color: "#E6E2D8", fontSize: 9 },
  onDarkCopy: { color: "#D0CCC2", maxWidth: 315 },
  outcomeBar: { backgroundColor: "#403E38", borderRadius: radius.pill, flexDirection: "row", height: 9, overflow: "hidden" },
  outcomeAccepted: { backgroundColor: "#71B894" },
  outcomeRejected: { backgroundColor: "#D77A71" },
  outcomeEmpty: { backgroundColor: "#56534C", flex: 1 },
  legend: { flexDirection: "row", gap: spacing.lg },
  legendItem: { alignItems: "center", flexDirection: "row", gap: 6 },
  legendDot: { borderRadius: radius.pill, height: 7, width: 7 },
  legendText: { color: "#D0CCC2" },
  emptyPanel: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, flexDirection: "row", gap: spacing.md, padding: spacing.lg },
  emptyIcon: { alignItems: "center", backgroundColor: colors.greenBg, borderRadius: 22, height: 44, justifyContent: "center", width: 44 },
  emptyText: { flex: 1, gap: 3 },
  statsRow: { flexDirection: "row", gap: spacing.sm },
  stat: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, flex: 1, gap: 2, minHeight: 76, padding: spacing.md },
  statValue: { color: colors.ink, fontSize: 20, lineHeight: 24, ...fontStyles.bold },
  statGreen: { color: colors.green },
  statAmber: { color: colors.amber },
  statLabel: { fontSize: 10 },
  section: { gap: spacing.sm },
  sectionHeader: { gap: 3, paddingHorizontal: 2 },
  sectionBody: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, overflow: "hidden" },
  progressRow: { borderBottomColor: colors.border, borderBottomWidth: 1, gap: spacing.sm, padding: spacing.md },
  progressTop: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  progressValue: { color: colors.green },
  progressTrack: { backgroundColor: colors.surfaceMuted, borderRadius: radius.pill, height: 6, overflow: "hidden" },
  progressFill: { backgroundColor: colors.green, borderRadius: radius.pill, height: "100%" },
  trendRow: { alignItems: "center", borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: "row", gap: spacing.sm, minHeight: 42, paddingHorizontal: spacing.md },
  trendLabel: { width: 52 },
  trendBar: { backgroundColor: colors.surfaceMuted, borderRadius: radius.pill, flex: 1, flexDirection: "row", height: 7, overflow: "hidden" },
  trendAccepted: { backgroundColor: colors.green },
  trendRejected: { backgroundColor: colors.redBorder },
  trendCount: { textAlign: "right", width: 22 },
  rejectedRow: { alignItems: "center", borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: "row", gap: spacing.md, padding: spacing.md },
  rank: { alignItems: "center", backgroundColor: colors.redBg, borderRadius: radius.sm, height: 30, justifyContent: "center", width: 30 },
  rejectedText: { flex: 1, gap: 2 },
  modelRow: { alignItems: "center", borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: "row", gap: spacing.md, minHeight: 62, padding: spacing.md },
  modelText: { flex: 1, gap: 2 },
  completionBadge: { backgroundColor: colors.greenBg, borderColor: colors.greenBorder, borderRadius: radius.sm, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 5 },
  completionText: { color: colors.green },
  statePanel: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, gap: spacing.sm, justifyContent: "center", minHeight: 280, padding: spacing.xxl },
  errorIcon: { alignItems: "center", backgroundColor: colors.redBg, borderRadius: 22, height: 44, justifyContent: "center", width: 44 },
  stateCopy: { textAlign: "center" },
  retryButton: { alignItems: "center", backgroundColor: colors.dark, borderRadius: radius.sm, flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm, minHeight: 46, paddingHorizontal: spacing.lg }
});
