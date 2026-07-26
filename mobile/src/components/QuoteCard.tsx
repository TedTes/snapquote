import { Check, CircleAlert, Clock3 } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AnimatedCard } from "./AnimatedCard";
import { GhostButton } from "./base";
import { colors, radius, spacing } from "./theme";
import { formatMoney, formatRelativeToNow } from "../utils/format";
import type { QuoteRow } from "../state/useQuoteRows";
import type { StoredLineItem } from "../state/quoteStore";

export function QuoteCard(props: { row: QuoteRow; onPress: () => void; onFollowUp?: (() => void) | undefined }) {
  const { row } = props;
  const alert = cardAlert(row);
  const partial = row.totals === null;
  const amountCents = row.totals ? row.totals.totalCents : sumTrustedCents(row.quote.lineItems);

  return (
    <AnimatedCard style={styles.wrap}>
      <Pressable accessibilityRole="button" onPress={props.onPress} style={styles.card}>
        <View style={[styles.rail, { backgroundColor: alert.color }]} />
        <View style={styles.body}>
          <View style={styles.top}>
            <View style={styles.titleBlock}>
              <Text style={styles.customer} numberOfLines={1}>
                {row.customer?.name ?? "Unnamed customer"}
              </Text>
              <Text style={styles.address} numberOfLines={1}>
                {row.quote.address || "No address"}
              </Text>
            </View>
            <View style={styles.amountBlock}>
              <Text style={styles.amount}>
                {formatMoney(amountCents)}
                {partial ? "+" : ""}
              </Text>
              <Text style={styles.status}>{cardStatusLabel(row)}</Text>
            </View>
          </View>

          <View style={styles.alertRow}>
            <View style={[styles.alertIcon, { backgroundColor: alert.bg }]}>
              {alert.kind === "check" ? (
                <Check color={alert.color} size={13} strokeWidth={2.8} />
              ) : alert.kind === "clock" ? (
                <Clock3 color={alert.color} size={13} strokeWidth={2.5} />
              ) : (
                <CircleAlert color={alert.color} size={13} strokeWidth={2.5} />
              )}
            </View>
            <Text style={[styles.alertText, { color: alert.color }]} numberOfLines={1}>
              {alert.label}
            </Text>
          </View>
        </View>
      </Pressable>
      {props.onFollowUp ? (
        <View style={styles.followUp}>
          <GhostButton label="Send follow-up" onPress={props.onFollowUp} small />
        </View>
      ) : null}
    </AnimatedCard>
  );
}

function sumTrustedCents(lineItems: StoredLineItem[]): number {
  return lineItems
    .filter((line) => line.matchState === "green" && line.unitPriceCents !== null)
    .reduce((sum, line) => sum + Math.round(line.quantity * (line.unitPriceCents ?? 0)), 0);
}

function cardAlert(row: QuoteRow): {
  label: string;
  color: string;
  bg: string;
  kind: "check" | "clock" | "alert";
} {
  if (row.stale) {
    return {
      label: `Follow up · sent ${formatRelativeToNow(row.quote.sentAt ?? row.quote.createdAt)}`,
      color: colors.amber,
      bg: colors.amberBg,
      kind: "clock"
    };
  }

  if (row.status === "draft") {
    const blockers = row.blockers.redLineCount + row.blockers.yellowLineCount;

    if (blockers > 0) {
      return {
        label: `${blockers} ${blockers === 1 ? "line needs" : "lines need"} a price`,
        color: colors.red,
        bg: colors.redBg,
        kind: "alert"
      };
    }

    return {
      label: "Ready to send",
      color: colors.green,
      bg: colors.greenBg,
      kind: "check"
    };
  }

  if (row.status === "viewed") {
    return {
      label: `Viewed · ${formatRelativeToNow(row.quote.firstViewedAt ?? row.quote.updatedAt)}`,
      color: colors.amber,
      bg: colors.amberBg,
      kind: "clock"
    };
  }

  if (row.status === "accepted") {
    return {
      label: "Accepted",
      color: colors.green,
      bg: colors.greenBg,
      kind: "check"
    };
  }

  if (row.status === "sent") {
    return {
      label: "Sent · not viewed yet",
      color: colors.ink2,
      bg: colors.surfaceMuted,
      kind: "clock"
    };
  }

  if (row.status === "declined") {
    return {
      label: "Declined by customer",
      color: colors.red,
      bg: colors.redBg,
      kind: "alert"
    };
  }

  if (row.status === "superseded") {
    return {
      label: "Replaced by a newer quote",
      color: colors.ink3,
      bg: colors.surfaceMuted,
      kind: "clock"
    };
  }

  return {
    label: `${row.status} · ${formatRelativeToNow(row.quote.updatedAt)}`,
    color: colors.ink3,
    bg: colors.surfaceMuted,
    kind: "clock"
  };
}

function cardStatusLabel(row: QuoteRow): string {
  if (row.stale) {
    return "FOLLOW-UP";
  }

  if (row.status === "viewed") {
    return "VIEWED";
  }

  if (row.status === "superseded") {
    return "REPLACED";
  }

  return row.status.toUpperCase();
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: "hidden"
  },
  card: {
    flexDirection: "row",
    minHeight: 72
  },
  rail: {
    width: 5
  },
  body: {
    flex: 1,
    gap: 8,
    padding: spacing.md
  },
  top: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between"
  },
  titleBlock: {
    flex: 1,
    gap: 2
  },
  customer: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900"
  },
  address: {
    color: colors.ink2,
    fontSize: 13,
    fontWeight: "600"
  },
  amountBlock: {
    alignItems: "flex-end",
    gap: 2
  },
  amount: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900"
  },
  status: {
    color: colors.ink3,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8
  },
  alertRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6
  },
  alertIcon: {
    alignItems: "center",
    borderRadius: radius.sm,
    height: 22,
    justifyContent: "center",
    width: 22
  },
  alertText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "800"
  },
  followUp: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    padding: spacing.sm
  }
});
