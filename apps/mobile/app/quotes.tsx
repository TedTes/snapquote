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
  Search
} from "lucide-react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from "react-native";
import { BottomTabBar } from "../src/ui/BottomTabBar";
import { ClipboardQuoteMark } from "../src/ui/ClipboardQuoteMark";
import { Screen } from "../src/ui/components";
import { colors, radius } from "../src/ui/theme";
import { formatMoney, formatShortDate } from "../src/lib/format";
import { useQuoteRows, type QuoteRow } from "../src/state/useQuoteRows";
import type { QuoteRecord } from "../src/state/mvp";

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
  const showListTools = visibleRows.length > searchThreshold;
  const showSearch = showListTools;

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
    const term = showSearch ? query.trim().toLowerCase() : "";
    const bySearch = visibleRows.filter((row) => {
      if (term.length === 0) {
        return true;
      }

      const haystack = `${row.customer?.name ?? ""} ${row.quote.address} ${row.quote.jobTitle}`.toLowerCase();
      return haystack.includes(term);
    });

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

  const simpleRows = useMemo(
    () => [...visibleRows].sort((a, b) => b.quote.updatedAt.localeCompare(a.quote.updatedAt)),
    [visibleRows]
  );

  function openQuote(quote: QuoteRecord) {
    router.push({ pathname: "/quote/[id]", params: { id: quote.id } });
  }

  if (visibleRows.length === 0) {
    return (
      <Screen edges={["top"]}>
        <View style={styles.emptyScreen}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>Quotes</Text>
              <Text style={styles.activeCount}>0 active</Text>
            </View>
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
            <View style={styles.titleRow}>
              <Text style={styles.title}>Quotes</Text>
              <Text style={styles.activeCount}>{activeRows.length} active</Text>
            </View>
            {showListTools ? (
              <Pressable accessibilityRole="button" style={styles.filterButton}>
                <ListFilter color={colors.ink} size={18} strokeWidth={2.4} />
              </Pressable>
            ) : null}
          </View>

          {showListTools ? (
            <>
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
                      <Text style={[styles.filterChipText, active ? styles.filterChipTextActive : null]}>
                        {option.label}
                      </Text>
                      <Text style={[styles.filterCountText, active ? styles.filterCountTextActive : null]}>
                        {filterCounts[option.key]}
                      </Text>
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
            </>
          ) : (
            <SimpleQuoteList onOpenQuote={openQuote} revisionsByQuoteId={revisionsByQuoteId} rows={simpleRows} />
          )}
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

      <Text style={styles.emptyHeadline}>Your first quote starts here</Text>
      <Text style={styles.emptyCopy}>
        Walk the job, talk it through, and SnapQuote drafts the scope — priced only from your book.
      </Text>

      <Text style={styles.emptyHint}>Tap the + button below to start.</Text>

      <View style={styles.emptySteps}>
        <EmptyStep icon="checklist" index="01" label="Checklist" />
        <Text style={styles.stepArrow}>›</Text>
        <EmptyStep icon="mic" index="02" label="Talk it" />
        <Text style={styles.stepArrow}>›</Text>
        <EmptyStep icon="send" index="03" label="Send it" />
      </View>

      <View style={styles.emptyLock}>
        <Lock color={colors.ink3} size={11} />
        <Text style={styles.emptyLockText}>No guessed prices — ever</Text>
      </View>
    </View>
  );
}

function EmptyStep(props: { icon: "checklist" | "mic" | "send"; index: string; label: string }) {
  return (
    <View style={styles.emptyStep}>
      <Text style={styles.stepIndex}>{props.index}</Text>
      {props.icon === "checklist" ? (
        <ClipboardList color={colors.ink2} size={18} strokeWidth={2.2} />
      ) : props.icon === "mic" ? (
        <Mic color={colors.ink2} size={18} strokeWidth={2.2} />
      ) : (
        <Check color={colors.ink2} size={18} strokeWidth={2.5} />
      )}
      <Text style={styles.stepLabel}>{props.label}</Text>
    </View>
  );
}

function NoMatchesState() {
  return (
    <View style={styles.noMatches}>
      <Text style={styles.noMatchesTitle}>Nothing matches</Text>
      <Text style={styles.noMatchesText}>Try a different filter or search term.</Text>
    </View>
  );
}

function QuoteSection(props: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{props.label}</Text>
      <View style={styles.sectionCards}>{props.children}</View>
    </View>
  );
}

function SimpleQuoteList(props: {
  onOpenQuote: (quote: QuoteRecord) => void;
  revisionsByQuoteId: Map<string, QuoteRow[]>;
  rows: QuoteRow[];
}) {
  const cardStyle = simpleCardStyle(props.rows.length);

  return (
    <View style={styles.simpleList}>
      {props.rows.map((row) => (
        <CompactQuoteCard
          cardStyle={cardStyle}
          key={row.quote.id}
          onOpenRevision={props.onOpenQuote}
          onPress={() => props.onOpenQuote(row.quote)}
          revisions={props.revisionsByQuoteId.get(row.quote.id) ?? []}
          row={row}
        />
      ))}
      <View style={styles.simpleHintRow}>
        <Text style={styles.simpleHintText}>Tap + to add another quote</Text>
      </View>
    </View>
  );
}

function simpleCardStyle(count: number): StyleProp<ViewStyle> {
  if (count <= 1) {
    return styles.simpleCardOne;
  }

  if (count === 2) {
    return styles.simpleCardTwo;
  }

  if (count === 3) {
    return styles.simpleCardThree;
  }

  return styles.simpleCardMany;
}

function CompactQuoteCard(props: {
  cardStyle?: StyleProp<ViewStyle> | undefined;
  onOpenRevision: (quote: QuoteRecord) => void;
  row: QuoteRow;
  revisions: QuoteRow[];
  onPress: () => void;
}) {
  const alert = quoteAlert(props.row);
  const revisionCount = props.revisions.length;
  const latestRevision = props.revisions[0];

  return (
    <View style={[styles.quoteCard, props.cardStyle]}>
      <View style={[styles.quoteRail, { backgroundColor: alert.color }]} />
      <View style={styles.quoteCardStack}>
        <Pressable accessibilityRole="button" onPress={props.onPress} style={styles.quoteBody}>
          <View style={styles.quoteTop}>
            <View style={styles.quoteIdentity}>
              <Text style={styles.quoteCustomer} numberOfLines={1}>
                {props.row.customer?.name ?? "Unnamed customer"}
              </Text>
              <Text style={styles.quoteAddress} numberOfLines={1}>
                {quoteSubtitle(props.row.quote)}
              </Text>
            </View>
            <View style={styles.amountBlock}>
              <Text style={styles.quoteAmount}>{props.row.totals ? formatMoney(props.row.totals.totalCents) : "$--"}</Text>
              <View style={[styles.statusPill, { backgroundColor: alert.bg, borderColor: alert.border }]}>
                <Text style={[styles.statusPillText, { color: alert.color }]}>{alert.pill}</Text>
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
            <Text style={[styles.quoteAlertText, { color: alert.color }]} numberOfLines={1}>
              {alert.label}
            </Text>
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
              <Text style={styles.revisionText}>
                {revisionCount} earlier {revisionCount === 1 ? "revision" : "revisions"}
              </Text>
            </View>
            <ChevronRight color={colors.ink3} size={14} strokeWidth={2.2} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function quoteSubtitle(quote: QuoteRecord): string {
  const parts = [quote.address, quote.jobTitle].map((part) => part.trim()).filter((part) => part.length > 0);

  return parts.length > 0 ? parts.join(" · ") : "No address";
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
    fontSize: 21,
    fontWeight: "900",
    marginTop: 7,
    textAlign: "center"
  },
  emptyCopy: {
    color: colors.ink2,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
    maxWidth: 275,
    textAlign: "center"
  },
  emptyHint: {
    color: colors.ink2,
    fontSize: 12,
    fontWeight: "800",
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
    fontWeight: "900"
  },
  stepLabel: {
    color: colors.ink2,
    fontSize: 11,
    fontWeight: "800"
  },
  stepArrow: {
    color: colors.ink3,
    fontSize: 14,
    fontWeight: "800"
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
    fontWeight: "600"
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
    fontWeight: "900"
  },
  noMatchesText: {
    color: colors.ink2,
    fontSize: 13,
    fontWeight: "600"
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  titleRow: {
    alignItems: "baseline",
    flexDirection: "row",
    gap: 10
  },
  title: {
    color: colors.ink,
    fontSize: 25,
    fontWeight: "900",
    letterSpacing: 0
  },
  activeCount: {
    color: colors.ink3,
    fontSize: 14,
    fontWeight: "800"
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
    fontWeight: "800"
  },
  filterChipTextActive: {
    color: colors.onDark
  },
  filterCountText: {
    color: colors.ink3,
    fontSize: 11,
    fontWeight: "900"
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
    color: colors.ink3,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
    textTransform: "uppercase"
  },
  sectionCards: {
    gap: 8
  },
  simpleList: {
    gap: 12,
    paddingTop: 18
  },
  simpleHintRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 18,
    paddingTop: 8
  },
  simpleHintText: {
    color: colors.ink3,
    fontSize: 13,
    fontWeight: "700"
  },
  simpleCardOne: {
    minHeight: 116
  },
  simpleCardTwo: {
    minHeight: 104
  },
  simpleCardThree: {
    minHeight: 94
  },
  simpleCardMany: {
    minHeight: 82
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
  quoteCustomer: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900"
  },
  quoteAddress: {
    color: colors.ink3,
    fontSize: 12,
    fontWeight: "600"
  },
  amountBlock: {
    alignItems: "flex-end",
    gap: 6
  },
  quoteAmount: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900"
  },
  statusPill: {
    borderRadius: 7,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  statusPillText: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.7
  },
  quoteAlertRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5
  },
  quoteAlertText: {
    flex: 1,
    fontSize: 11,
    fontWeight: "800"
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
    fontWeight: "700"
  }
});
