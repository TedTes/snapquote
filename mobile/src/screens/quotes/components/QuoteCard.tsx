import { Check, CircleAlert, Clock3 } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { AnimatedCard } from "../../../shared-ui/AnimatedCard";
import { GhostButton } from "../../../shared-ui/base";
import { AppText } from "../../../shared-ui/text";
import { colors, fontStyles, radius, spacing, typography } from "../../../shared-ui/theme";
import { formatMoney, formatRelativeToNow } from "../../../utils/format";
import type { QuoteRow } from "../../../state/useQuoteRows";
import type { StoredLineItem } from "../../../state/quoteStore";
import { deriveCustomerCity, deriveJobLabel } from "@snapquote/shared";

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
              <AppText style={styles.customer} numberOfLines={1} variant="rowTitle">
                {deriveJobLabel(row.quote)}
              </AppText>
              <AppText style={styles.address} numberOfLines={1} variant="rowSubtitle">
                {customerSubtitle(row)}
              </AppText>
            </View>
            <View style={styles.amountBlock}>
              <AppText style={styles.amount} variant="amount">
                {formatMoney(amountCents)}
                {partial ? "+" : ""}
              </AppText>
              <AppText style={styles.status} variant="statusPill">
                {cardStatusLabel(row)}
              </AppText>
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
            <AppText style={[styles.alertText, { color: alert.color }]} numberOfLines={1} variant="button">
              {alert.label}
            </AppText>
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

function customerSubtitle(row: QuoteRow): string {
  if (row.customer === null) {
    return "Unnamed customer";
  }

  const city = row.customer.city.trim() || deriveCustomerCity(row.customer.address);
  return city.length > 0 ? `${row.customer.name} · ${city}` : row.customer.name;
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
    ...typography.rowTitle,
    lineHeight: 19
  },
  address: {
    ...typography.rowSubtitle
  },
  amountBlock: {
    alignItems: "flex-end",
    gap: 2
  },
  amount: {
    ...typography.amount
  },
  status: {
    ...typography.statusPill,
    color: colors.ink3,
    fontSize: 9
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
    fontSize: 12,
    ...fontStyles.semibold,
  },
  followUp: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    padding: spacing.sm
  }
});
