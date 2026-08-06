import { useMemo, useState } from "react";
import {
  Check,
  ChevronRight,
  ClipboardList,
  CircleAlert,
  Clock3,
  Eye,
  ListFilter,
  Lock,
  Mic,
  RotateCcw,
  Search,
  User
} from "lucide-react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { deriveCustomerCity, deriveJobLabel } from "@snapquote/shared";
import { BottomTabBar } from "../../shared-ui/BottomTabBar";
import { ClipboardQuoteMark } from "./components/ClipboardQuoteMark";
import { Screen } from "../../shared-ui/base";
import { SectionHeader } from "../../shared-ui/layout";
import { AppText } from "../../shared-ui/text";
import { colors, fontStyles, radius, typography } from "../../shared-ui/theme";
import { formatMoney, formatShortDate } from "../../utils/format";
import { matchesQuoteSearch, useQuoteRows, type QuoteRow } from "../../state/useQuoteRows";
import type { QuoteRecord } from "../../state/quoteStore";
import { useRemoteQuoteRefresh } from "../../sync/useRemoteQuoteRefresh";

type FilterKey = "all" | "draft" | "sent" | "viewed" | "accepted" | "stale";

const filterOptions: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "sent", label: "Sent" },
  { key: "viewed", label: "Viewed" },
  { key: "stale", label: "Stale" },
  { key: "accepted", label: "Accepted" }
];

const searchThreshold = 7;

export default function QuotesScreen() {
  const params = useLocalSearchParams<{ filter?: string }>();
  const rows = useQuoteRows();
  useRemoteQuoteRefresh({ pollMs: 30000 });

  const initialFilter = filterOptions.some((option) => option.key === params.filter)
    ? (params.filter as FilterKey)
    : "all";

  const [filter, setFilter] = useState<FilterKey>(initialFilter);
  const [query, setQuery] = useState("");
  const visibleRows = useMemo(() => rows.filter((row) => row.status !== "superseded"), [rows]);
  const revisionsByQuoteId = useMemo(() => {
    const groups = new Map<string, QuoteRow[]>();

    for (const row of rows) {
      const replacementId = row.quote.supersededByQuoteId;

      if (replacementId === null) {
        continue;
      }

      const revisions = groups.get(replacementId) ?? [];
      revisions.push(row);
      groups.set(replacementId, revisions);
    }

    for (const revisions of groups.values()) {
      revisions.sort((a, b) => b.quote.updatedAt.localeCompare(a.quote.updatedAt));
    }

    return groups;
  }, [rows]);
  const showSearch = visibleRows.length > searchThreshold;

  const activeRows = useMemo(
    () => visibleRows.filter((row) => row.status === "draft" || row.status === "sent" || row.status === "viewed"),
    [visibleRows]
  );

  const filterCounts = useMemo(
    () => ({
      all: visibleRows.length,
      draft: visibleRows.filter((row) => row.status === "draft").length,
      sent: visibleRows.filter((row) => row.status === "sent").length,
      viewed: visibleRows.filter((row) => row.status === "viewed").length,
      stale: visibleRows.filter((row) => row.stale).length,
      accepted: visibleRows.filter((row) => row.status === "accepted").length
    }),
    [visibleRows]
  );

  const filtered = useMemo(() => {
    const bySearch = visibleRows.filter((row) => matchesQuoteSearch(row, showSearch ? query : ""));

    if (filter === "all") {
      return bySearch;
    }

    if (filter === "stale") {
      return bySearch.filter((row) => row.stale);
    }

    return bySearch.filter((row) => row.status === filter);
  }, [visibleRows, query, filter, showSearch]);

  const grouped = useMemo(() => {
    const needsAttention = filtered.filter(
      (row) => row.stale || (row.status === "draft" && row.blockers.reasons.length > 0) || row.status === "viewed"
    );
    const attentionIds = new Set(needsAttention.map((row) => row.quote.id));
    const thisWeek = filtered.filter((row) => !attentionIds.has(row.quote.id));

    return {
      needsAttention,
      thisWeek
    };
  }, [filtered]);

  function openQuote(quote: QuoteRecord) {
    router.push({ pathname: "/quote/[id]", params: { id: quote.id } });
  }

  if (visibleRows.length === 0) {
    return (
      <Screen edges={["top"]}>
          <View style={styles.emptyScreen}>
            <View style={styles.header}>
            <AppText style={styles.headerSummary} variant="headerSummary">
              0 quotes active
            </AppText>
          </View>

          <EmptyQuotesState />
        </View>
        <BottomTabBar />
      </Screen>
    );
  }

  return (
    <Screen edges={["top"]}>
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <AppText style={styles.headerSummary} variant="headerSummary">
              {activeQuoteSummary(activeRows.length)}
            </AppText>
            <Pressable accessibilityRole="button" style={styles.filterButton}>
              <ListFilter color={colors.ink} size={18} strokeWidth={2.4} />
            </Pressable>
          </View>

          {showSearch ? (
            <View style={styles.searchBox}>
              <Search color={colors.ink3} size={15} />
              <TextInput
                accessibilityLabel="Search customers or addresses"
                onChangeText={setQuery}
                placeholder="Search customers or addresses"
                placeholderTextColor={colors.ink3}
                style={styles.searchInput}
                value={query}
              />
            </View>
          ) : null}

          <ScrollView contentContainerStyle={styles.filterRow} horizontal showsHorizontalScrollIndicator={false}>
            {filterOptions.map((option) => {
              const active = option.key === filter;

              return (
                <Pressable
                  accessibilityRole="button"
                  key={option.key}
                  onPress={() => setFilter(option.key)}
                  style={[styles.filterChip, active ? styles.filterChipActive : null]}
                >
                  {option.key === "stale" ? <View style={styles.staleDot} /> : null}
                  <AppText style={[styles.filterChipText, active ? styles.filterChipTextActive : null]} variant="button">
                    {option.label}
                  </AppText>
                  <AppText style={[styles.filterCountText, active ? styles.filterCountTextActive : null]} variant="meta">
                    {filterCounts[option.key]}
                  </AppText>
                </Pressable>
              );
            })}
          </ScrollView>

          {filtered.length === 0 ? <NoMatchesState /> : null}

          {grouped.needsAttention.length > 0 ? (
            <QuoteSection label="Needs attention">
              {grouped.needsAttention.map((row) => (
                <CompactQuoteCard
                  key={row.quote.id}
                  onOpenRevision={openQuote}
                  onPress={() => openQuote(row.quote)}
                  revisions={revisionsByQuoteId.get(row.quote.id) ?? []}
                  row={row}
                />
              ))}
            </QuoteSection>
          ) : null}

          {grouped.thisWeek.length > 0 ? (
            <QuoteSection label={grouped.needsAttention.length > 0 ? "This week" : "All quotes"}>
              {grouped.thisWeek.map((row) => (
                <CompactQuoteCard
                  key={row.quote.id}
                  onOpenRevision={openQuote}
                  onPress={() => openQuote(row.quote)}
                  revisions={revisionsByQuoteId.get(row.quote.id) ?? []}
                  row={row}
                />
              ))}
            </QuoteSection>
          ) : null}
        </ScrollView>
      </View>
      <BottomTabBar />
    </Screen>
  );
}

function EmptyQuotesState() {
  return (
    <View style={styles.emptyFull}>
      <View style={styles.emptyIconCard}>
        <ClipboardQuoteMark />
      </View>

      <AppText style={styles.emptyHeadline} variant="rowTitle">Your first quote starts here</AppText>
      <AppText style={styles.emptyCopy} variant="body">
        Walk the job, talk it through, and QuoteVan drafts the scope — priced only from your book.
      </AppText>

      <AppText style={styles.emptyHint} variant="meta">Tap the + button below to start.</AppText>

      <View style={styles.emptySteps}>
        <EmptyStep icon="checklist" index="01" label="Checklist" />
        <AppText style={styles.stepArrow} variant="meta">›</AppText>
        <EmptyStep icon="mic" index="02" label="Talk it" />
        <AppText style={styles.stepArrow} variant="meta">›</AppText>
        <EmptyStep icon="send" index="03" label="Send it" />
      </View>

      <View style={styles.emptyLock}>
        <Lock color={colors.ink3} size={11} />
        <AppText style={styles.emptyLockText} variant="meta">No guessed prices — ever</AppText>
      </View>
    </View>
  );
}

function EmptyStep(props: { icon: "checklist" | "mic" | "send"; index: string; label: string }) {
  return (
    <View style={styles.emptyStep}>
      <AppText style={styles.stepIndex} variant="meta">{props.index}</AppText>
      {props.icon === "checklist" ? (
        <ClipboardList color={colors.ink2} size={18} strokeWidth={2.2} />
      ) : props.icon === "mic" ? (
        <Mic color={colors.ink2} size={18} strokeWidth={2.2} />
      ) : (
        <Check color={colors.ink2} size={18} strokeWidth={2.5} />
      )}
      <AppText style={styles.stepLabel} variant="meta">{props.label}</AppText>
    </View>
  );
}

function NoMatchesState() {
  return (
    <View style={styles.noMatches}>
      <AppText style={styles.noMatchesTitle} variant="rowTitle">Nothing matches</AppText>
      <AppText style={styles.noMatchesText} variant="body">Try a different filter or search term.</AppText>
    </View>
  );
}

function QuoteSection(props: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <SectionHeader label={props.label} />
      <View style={styles.sectionCards}>{props.children}</View>
    </View>
  );
}

function activeQuoteSummary(count: number) {
  return `${count} ${count === 1 ? "quote" : "quotes"} active`;
}

function CompactQuoteCard(props: {
  onOpenRevision: (quote: QuoteRecord) => void;
  row: QuoteRow;
  revisions: QuoteRow[];
  onPress: () => void;
}) {
  const alert = quoteAlert(props.row);
  const revisionCount = props.revisions.length;
  const latestRevision = props.revisions[0];

  return (
    <View style={styles.quoteCard}>
      <View style={[styles.quoteRail, { backgroundColor: alert.color }]} />
      <View style={styles.quoteCardStack}>
        <Pressable accessibilityRole="button" onPress={props.onPress} style={styles.quoteBody}>
          <View style={styles.quoteTop}>
            <View style={styles.quoteIdentity}>
              <AppText style={styles.quoteTitle} numberOfLines={1} variant="rowTitle">
                {deriveJobLabel(props.row.quote)}
              </AppText>
              <View style={styles.quoteCustomerRow}>
                <User color={colors.ink3} size={11} strokeWidth={2.2} />
                <AppText style={styles.quoteCustomerSubtitle} numberOfLines={1} variant="rowSubtitle">
                  {customerSubtitle(props.row.customer)}
                </AppText>
              </View>
            </View>
            <View style={styles.amountBlock}>
              <AppText style={styles.quoteAmount} variant="amount">
                {props.row.totals ? formatMoney(props.row.totals.totalCents) : "$--"}
              </AppText>
              <View style={[styles.statusPill, { backgroundColor: alert.bg, borderColor: alert.border }]}>
                <AppText style={[styles.statusPillText, { color: alert.color }]} variant="statusPill">
                  {alert.pill}
                </AppText>
              </View>
            </View>
          </View>
          <View style={styles.quoteAlertRow}>
            {alert.icon === "check" ? (
              <Check color={alert.color} size={12} strokeWidth={2.7} />
            ) : alert.icon === "eye" ? (
              <Eye color={alert.color} size={12} strokeWidth={2.4} />
            ) : alert.icon === "clock" ? (
              <Clock3 color={alert.color} size={12} strokeWidth={2.4} />
            ) : (
              <CircleAlert color={alert.color} size={12} strokeWidth={2.4} />
            )}
            <AppText style={[styles.quoteAlertText, { color: alert.color }]} numberOfLines={1} variant="button">
              {alert.label}
            </AppText>
          </View>
        </Pressable>
        {revisionCount > 0 && latestRevision ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => props.onOpenRevision(latestRevision.quote)}
            style={styles.revisionRow}
          >
            <View style={styles.revisionTextRow}>
              <RotateCcw color={colors.ink3} size={11} strokeWidth={2.2} />
              <AppText style={styles.revisionText} variant="meta">
                {revisionCount} earlier {revisionCount === 1 ? "revision" : "revisions"}
              </AppText>
            </View>
            <ChevronRight color={colors.ink3} size={14} strokeWidth={2.2} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function customerSubtitle(customer: QuoteRow["customer"]): string {
  if (customer === null) {
    return "Unnamed customer";
  }

  const city = customer.city.trim() || deriveCustomerCity(customer.address);
  return city.length > 0 ? `${customer.name} · ${city}` : customer.name;
}

function quoteAlert(row: QuoteRow): {
  bg: string;
  border: string;
  color: string;
  icon: "alert" | "check" | "clock" | "eye";
  label: string;
  pill: string;
} {
  if (row.stale) {
    return {
      bg: colors.amberBg,
      border: colors.amberBorder,
      color: colors.amber,
      icon: "clock",
      label: "Stale · no reply in 4 days",
      pill: "STALE"
    };
  }

  if (row.status === "sent" && row.quote.firstViewedAt === null) {
    return {
      bg: colors.surfaceMuted,
      border: colors.border,
      color: colors.ink2,
      icon: "clock",
      label: "Sent today · not viewed",
      pill: "SENT"
    };
  }

  if (row.status === "draft") {
    const blockers = row.blockers.redLineCount + row.blockers.yellowLineCount;

    if (blockers > 0) {
      return {
        bg: colors.surfaceMuted,
        border: colors.border,
        color: colors.red,
        icon: "alert",
        label: `${blockers} ${blockers === 1 ? "line needs" : "lines need"} a price`,
        pill: "DRAFT"
      };
    }

    return {
      bg: colors.greenBg,
      border: colors.greenBorder,
      color: colors.green,
      icon: "check",
      label: "Fully priced · ready to send",
      pill: "READY"
    };
  }

  if (row.status === "viewed") {
    return {
      bg: colors.surfaceMuted,
      border: colors.border,
      color: colors.ink2,
      icon: "eye",
      label: "Viewed today",
      pill: "SENT"
    };
  }

  if (row.status === "accepted") {
    return {
      bg: colors.greenBg,
      border: colors.greenBorder,
      color: colors.green,
      icon: "check",
      label: `Accepted · ${formatShortDate(row.quote.updatedAt)}`,
      pill: "ACCEPTED"
    };
  }

  return {
    bg: colors.surfaceMuted,
    border: colors.border,
    color: colors.ink2,
    icon: "clock",
    label: `${row.status} · ${formatShortDate(row.quote.updatedAt)}`,
    pill: row.status.toUpperCase()
  };
}

const styles = StyleSheet.create({
  screen: {
    flex: 1
  },
  content: {
    gap: 12,
    padding: 20,
    paddingBottom: 92
  },
  emptyScreen: {
    flex: 1,
    paddingBottom: 18,
    paddingHorizontal: 20,
    paddingTop: 20
  },
  emptyFull: {
    alignItems: "center",
    gap: 15,
    paddingHorizontal: 22,
    paddingTop: 70
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
  emptyHeadline: {
    color: colors.ink,
    fontSize: 18,
    ...fontStyles.semibold,
    marginTop: 7,
    textAlign: "center"
  },
  emptyCopy: {
    color: colors.ink2,
    fontSize: 13,
    ...fontStyles.regular,
    lineHeight: 19,
    maxWidth: 275,
    textAlign: "center"
  },
  emptyHint: {
    color: colors.ink2,
    fontSize: 12,
    ...fontStyles.medium,
    marginTop: 5,
    textAlign: "center"
  },
  emptySteps: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    marginTop: 18,
    width: "100%"
  },
  emptyStep: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    gap: 5,
    height: 84,
    justifyContent: "center",
    width: 88
  },
  stepIndex: {
    color: colors.ink3,
    fontSize: 9,
    ...fontStyles.medium,
  },
  stepLabel: {
    color: colors.ink2,
    fontSize: 11,
    ...fontStyles.medium,
  },
  stepArrow: {
    color: colors.ink3,
    fontSize: 14,
    ...fontStyles.medium,
  },
  emptyLock: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    marginTop: 8
  },
  emptyLockText: {
    color: colors.ink3,
    fontSize: 12,
    ...fontStyles.medium,
  },
  noMatches: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 5,
    padding: 16
  },
  noMatchesTitle: {
    color: colors.ink,
    fontSize: 16,
    ...fontStyles.semibold,
  },
  noMatchesText: {
    color: colors.ink2,
    fontSize: 13,
    ...fontStyles.regular,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  headerSummary: {
    ...typography.headerSummary
  },
  filterButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 38
  },
  searchBox: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    height: 38,
    paddingHorizontal: 12
  },
  searchInput: {
    color: colors.ink,
    flex: 1,
    fontSize: 13,
    paddingVertical: 0
  },
  filterRow: {
    gap: 8,
    paddingRight: 24
  },
  filterChip: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    height: 34,
    paddingHorizontal: 12
  },
  filterChipActive: {
    backgroundColor: colors.dark,
    borderColor: colors.dark
  },
  filterChipText: {
    color: colors.ink2,
    fontSize: 13,
    ...fontStyles.medium,
  },
  filterChipTextActive: {
    color: colors.onDark,
    ...fontStyles.semibold,
  },
  filterCountText: {
    color: colors.ink3,
    fontSize: 11,
    ...fontStyles.medium,
  },
  filterCountTextActive: {
    color: "rgba(255,255,255,0.7)"
  },
  staleDot: {
    backgroundColor: colors.amber,
    borderRadius: radius.pill,
    height: 7,
    width: 7
  },
  section: {
    gap: 8,
    marginTop: 12
  },
  sectionLabel: {
    ...typography.sectionLabel,
    fontSize: 10
  },
  sectionCards: {
    gap: 8
  },
  quoteCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 78,
    overflow: "hidden"
  },
  quoteRail: {
    width: 5
  },
  quoteCardStack: {
    flex: 1
  },
  quoteBody: {
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  quoteTop: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between"
  },
  quoteIdentity: {
    flex: 1,
    gap: 2,
    minWidth: 0
  },
  quoteTitle: {
    ...typography.rowTitle
  },
  quoteCustomerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4
  },
  quoteCustomerSubtitle: {
    ...typography.rowSubtitle,
    fontSize: 11.5
  },
  amountBlock: {
    alignItems: "flex-end",
    gap: 6
  },
  quoteAmount: {
    ...typography.amount
  },
  statusPill: {
    borderRadius: 7,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  statusPillText: {
    ...typography.statusPill,
    fontSize: 9
  },
  quoteAlertRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5
  },
  quoteAlertText: {
    flex: 1,
    fontSize: 11,
    ...fontStyles.medium,
  },
  revisionRow: {
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 32,
    paddingHorizontal: 14
  },
  revisionTextRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5
  },
  revisionText: {
    color: colors.ink3,
    fontSize: 11,
    ...fontStyles.medium,
  }
});
