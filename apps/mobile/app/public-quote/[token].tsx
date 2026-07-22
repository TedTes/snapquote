import { useEffect, useMemo, useState } from "react";
import { Check, X } from "lucide-react-native";
import { useLocalSearchParams } from "expo-router";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import type { ApiQuote } from "../../src/lib/api";
import { snapquoteApi, userFacingErrorMessage } from "../../src/lib/api";
import { Banner, Card, Divider, EmptyState, GhostButton, KeyValueRow, PrimaryButton, Screen } from "../../src/ui/components";
import { formatLongDate, formatMoney } from "../../src/lib/format";
import { colors, spacing } from "../../src/ui/theme";

export default function PublicQuoteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [quote, setQuote] = useState<ApiQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState<"accept" | "decline" | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!token) {
        return;
      }

      try {
        const loaded = await snapquoteApi.getPublicQuote(token);

        if (mounted) {
          setQuote(loaded);
        }
      } catch (error) {
        Alert.alert("Could not load quote", userFacingErrorMessage(error));
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, [token]);

  const sortedLines = useMemo(
    () => (quote ? [...quote.lineItems].sort((a, b) => a.position - b.position) : []),
    [quote]
  );

  async function respond(action: "accept" | "decline") {
    if (!token || responding !== null) {
      return;
    }

    setResponding(action);

    try {
      const updated = await snapquoteApi.respondToPublicQuote(token, action);
      setQuote(updated);
    } catch (error) {
      Alert.alert("Could not respond", userFacingErrorMessage(error));
    } finally {
      setResponding(null);
    }
  }

  if (loading) {
    return (
      <Screen>
        <View style={styles.center}>
          <EmptyState title="Loading quote" text="One moment." />
        </View>
      </Screen>
    );
  }

  if (!quote) {
    return (
      <Screen>
        <View style={styles.center}>
          <EmptyState title="Quote unavailable" text="The link may be expired or revoked." />
        </View>
      </Screen>
    );
  }

  const total = quote.totals?.totalCents ?? null;
  const responded = quote.status === "accepted" || quote.status === "declined";

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Quote</Text>
          <Text style={styles.title}>{quote.customer?.name ?? "Customer"}</Text>
          <Text style={styles.meta}>
            {quote.address}
            {quote.jobTitle ? ` · ${quote.jobTitle}` : ""}
          </Text>
        </View>

        {responded ? (
          <Banner tone={quote.status === "accepted" ? "green" : "red"}>
            {quote.status === "accepted" ? "Quote accepted." : "Quote declined."}
          </Banner>
        ) : null}

        {quote.scopeSummary.trim().length > 0 ? (
          <Card>
            <Text style={styles.cardTitle}>Scope</Text>
            <Text style={styles.bodyText}>{quote.scopeSummary}</Text>
          </Card>
        ) : null}

        <Card>
          {sortedLines.map((line, index) => (
            <View key={line.id}>
              <KeyValueRow
                label={line.description}
                value={formatMoney(line.unitPriceCents === null ? null : Math.round(line.quantity * line.unitPriceCents))}
              />
              {index < sortedLines.length - 1 ? <Divider /> : null}
            </View>
          ))}
        </Card>

        <Card>
          <KeyValueRow label="Subtotal" value={quote.totals ? formatMoney(quote.totals.subtotalCents) : "$--"} />
          {quote.totals && quote.totals.discountCents > 0 ? (
            <>
              <View style={styles.spacer} />
              <KeyValueRow label="Discount" value={`-${formatMoney(quote.totals.discountCents)}`} />
            </>
          ) : null}
          <View style={styles.spacer} />
          <KeyValueRow label={`Tax (${Math.round(quote.taxRate * 100)}%)`} value={quote.totals ? formatMoney(quote.totals.taxCents) : "$--"} />
          <Divider />
          <KeyValueRow label="Total" strong value={formatMoney(total)} />
        </Card>

        {quote.terms.trim().length > 0 ? (
          <Card>
            <Text style={styles.cardTitle}>Terms</Text>
            <Text style={styles.bodyText}>{quote.terms}</Text>
          </Card>
        ) : null}

        <Text style={styles.finePrint}>Valid until {formatLongDate(`${quote.validUntil}T00:00:00.000Z`)}</Text>

        {!responded ? (
          <View style={styles.actions}>
            <PrimaryButton
              disabled={responding !== null}
              label={responding === "accept" ? "Accepting..." : "Accept quote"}
              onPress={() => void respond("accept")}
            />
            <GhostButton
              label={responding === "decline" ? "Declining..." : "Decline"}
              onPress={() => void respond("decline")}
              tone="danger"
            />
          </View>
        ) : (
          <View style={styles.result}>
            {quote.status === "accepted" ? (
              <Check color={colors.green} size={18} strokeWidth={2.8} />
            ) : (
              <X color={colors.red} size={18} strokeWidth={2.8} />
            )}
            <Text style={styles.resultText}>Response saved.</Text>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg
  },
  content: {
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.xxl
  },
  header: {
    gap: 4
  },
  eyebrow: {
    color: colors.ink3,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.8,
    textTransform: "uppercase"
  },
  title: {
    color: colors.ink,
    fontSize: 31,
    fontWeight: "900",
    letterSpacing: 0
  },
  meta: {
    color: colors.ink2,
    fontSize: 14,
    fontWeight: "700"
  },
  spacer: {
    height: spacing.sm
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 6
  },
  bodyText: {
    color: colors.ink2,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19
  },
  finePrint: {
    color: colors.ink3,
    fontSize: 12,
    fontWeight: "600"
  },
  actions: {
    gap: spacing.sm
  },
  result: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    paddingVertical: spacing.md
  },
  resultText: {
    color: colors.ink2,
    fontSize: 14,
    fontWeight: "800"
  }
});
