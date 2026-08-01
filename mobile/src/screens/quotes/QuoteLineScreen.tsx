import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { quoteUnits, type QuoteLineItem } from "@snapquote/shared";
import { snapquoteApi, userFacingErrorMessage } from "../../api/client";
import { useAuthStore } from "../../state/authStore";
import {
  Card,
  Chip,
  EmptyState,
  Field,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for a possible future re-add of the remove-line action
  GhostButton,
  PrimaryButton,
  Screen,
  SwatchTab,
  ToggleRow,
  TopBar,
} from "../../shared-ui/base";
import { colors, radius, spacing } from "../../shared-ui/theme";
import { describeQuantity, formatMoney } from "../../utils/format";
import {
  centsToDollars,
  dollarsToCents,
  useQuoteStore,
} from "../../state/quoteStore";

type QuoteUnit = (typeof quoteUnits)[number];

export default function EditLineScreen() {
  const { id, lineId } = useLocalSearchParams<{ id: string; lineId: string }>();
  const quote = useQuoteStore((state) =>
    state.quotes.find((candidate) => candidate.id === id),
  );
  const priceBookItems = useQuoteStore((state) => state.priceBookItems);
  const authStatus = useAuthStore((state) => state.status);
  const addManualLine = useQuoteStore((state) => state.addManualLine);
  const confirmYellowLine = useQuoteStore((state) => state.confirmYellowLine);
  const removeLine = useQuoteStore((state) => state.removeLine);
  const saveLineToPriceBook = useQuoteStore((state) => state.saveLineToPriceBook);
  const updateLineItem = useQuoteStore((state) => state.updateLineItem);
  const upsertPriceBookItem = useQuoteStore((state) => state.upsertPriceBookItem);
  const upsertRemoteQuote = useQuoteStore((state) => state.upsertRemoteQuote);

  const isNew = lineId === "new";
  const existingLine = quote?.lineItems.find((line) => line.id === lineId);
  const suggestedItem =
    existingLine?.priceBookItemId !== null &&
    existingLine?.priceBookItemId !== undefined
      ? priceBookItems.find((item) => item.id === existingLine.priceBookItemId)
      : undefined;

  const [overriding, setOverriding] = useState(false);
  const [description, setDescription] = useState(
    existingLine?.description ?? "",
  );
  const [quantity, setQuantity] = useState(String(existingLine?.quantity ?? 1));
  const [unit, setUnit] = useState<QuoteUnit>(existingLine?.unit ?? "flat");
  const kind: QuoteLineItem["kind"] = existingLine?.kind ?? "labour";
  const [price, setPrice] = useState(
    existingLine?.unitPriceCents !== null &&
      existingLine?.unitPriceCents !== undefined
      ? centsToDollars(existingLine.unitPriceCents)
      : "",
  );
  const [saveToPriceBook, setSaveToPriceBook] = useState(true);
  const [saving, setSaving] = useState(false);

  if (!id || !quote || (!isNew && !existingLine)) {
    return (
      <Screen>
        <TopBar title="Line" onBack={() => router.back()} />
        <View style={styles.notFound}>
          <EmptyState
            text="It may have already been removed."
            title="Line not found"
          />
        </View>
      </Screen>
    );
  }

  const activeQuote = quote;
  const quoteId = quote.id;

  function close() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace({ pathname: "/quote/[id]", params: { id: quoteId } });
    }
  }

  const isYellowConfirmMode =
    existingLine !== undefined &&
    existingLine.matchState === "yellow" &&
    !overriding;

  async function handleConfirm() {
    if (!existingLine) {
      return;
    }

    setSaving(true);

    try {
      if (authStatus !== "signed_in") {
        confirmYellowLine(quoteId, existingLine.id);
        close();
        return;
      }

      const response = await snapquoteApi.confirmLine(quoteId, existingLine.id);
      upsertPriceBookItem(response.item);
      upsertRemoteQuote(response.quote);
      close();
    } catch (error) {
      Alert.alert("Could not confirm price", userFacingErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  const quantityNumber = Number(quantity);
  const priceCents = price.trim().length > 0 ? dollarsToCents(price) : null;
  const hasValidQtyPrice =
    Number.isFinite(quantityNumber) &&
    quantityNumber > 0 &&
    priceCents !== null &&
    priceCents > 0;
  const previewTotalCents =
    hasValidQtyPrice && priceCents !== null ? Math.round(quantityNumber * priceCents) : null;
  const canSave = description.trim().length > 0 && hasValidQtyPrice;
  const lineTotalCents = canSave ? previewTotalCents : null;

  async function handleSave() {
    if (!canSave || priceCents === null) {
      return;
    }

    setSaving(true);

    const input: QuoteLineItem = {
      id: existingLine?.id,
      position: existingLine?.position ?? activeQuote.lineItems.length,
      description: description.trim(),
      quantity: quantityNumber,
      unit,
      unitPriceCents: priceCents,
      kind,
      source: "manual",
      priceBookItemId: null,
      priceBookItemKey: null,
      matchConfidence: null,
      matchState: "green",
    };

    try {
      if (authStatus !== "signed_in") {
        const lineInput = {
          description: input.description,
          quantity: input.quantity,
          unit,
          unitPriceCents: priceCents,
          kind: input.kind,
        };
        const targetLineId = isNew
          ? addManualLine(quoteId, lineInput)
          : existingLine?.id;

        if (!isNew && existingLine) {
          updateLineItem(quoteId, existingLine.id, lineInput);
        }

        if (saveToPriceBook && targetLineId) {
          saveLineToPriceBook(quoteId, targetLineId);
        }

        close();
        return;
      }

      const lineItems = isNew
        ? [...activeQuote.lineItems, input]
        : activeQuote.lineItems.map((line) =>
            line.id === existingLine?.id ? input : line,
          );
      let updated = await snapquoteApi.patchQuote(quoteId, { lineItems });

      if (saveToPriceBook) {
        const targetLine = findPatchedLine(updated.lineItems, input);

        if (targetLine) {
          const response = await snapquoteApi.saveLineToPriceBook(
            quoteId,
            targetLine.id,
          );
          upsertPriceBookItem(response.item);
          updated = response.quote;
        }
      }

      upsertRemoteQuote(updated);
      close();
    } catch (error) {
      Alert.alert("Could not save line", userFacingErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for a possible future re-add of the remove-line action
  function handleRemove() {
    if (!existingLine) {
      return;
    }

    Alert.alert("Remove line?", "This line will be removed from the quote.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          void removeRemoteLine();
        },
      },
    ]);
  }

  async function removeRemoteLine() {
    if (!existingLine) {
      return;
    }

    setSaving(true);

    try {
      if (authStatus !== "signed_in") {
        removeLine(quoteId, existingLine.id);
        close();
        return;
      }

      const updated = await snapquoteApi.patchQuote(quoteId, {
        lineItems: activeQuote.lineItems
          .filter((line) => line.id !== existingLine.id)
          .map((line, index) => ({ ...line, position: index })),
      });
      upsertRemoteQuote(updated);
      close();
    } catch (error) {
      Alert.alert("Could not remove line", userFacingErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  if (isYellowConfirmMode && existingLine) {
    const suggestedCents = existingLine.unitPriceCents;

    return (
      <Screen>
        <TopBar title="Confirm price" onBack={close} />
        <ScrollView contentContainerStyle={styles.content}>
          <Chip label="Suggested starter price" tone="yellow" />
          <Text style={styles.description}>{existingLine.description}</Text>
          <Card style={styles.suggestedCard}>
            <Text style={styles.suggestedLabel}>
              {suggestedItem?.name ?? "Starter price"}
            </Text>
            <Text style={styles.suggestedPrice}>
              {formatMoney(suggestedCents)}
            </Text>
            <Text style={styles.suggestedHelper}>
              This price comes from your starter price book and hasn't been
              confirmed yet.
            </Text>
          </Card>
          <PrimaryButton
            disabled={saving}
            label={saving ? "Confirming..." : "Confirm starter price"}
            onPress={() => void handleConfirm()}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => setOverriding(true)}
            style={styles.overrideLink}
          >
            <Text style={styles.overrideLinkText}>
              Override with a different price instead
            </Text>
          </Pressable>
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <TopBar title={isNew ? "Add line" : "Edit line"} onBack={close} />
      <ScrollView contentContainerStyle={styles.content}>
        {existingLine ? (
          <Chip
            label={chipLabel(existingLine.matchState)}
            tone={existingLine.matchState}
          />
        ) : null}

        <Field
          label="Description"
          onChangeText={setDescription}
          placeholder="e.g. Remove wallpaper — hallway"
          value={description}
        />

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Unit</Text>
          <ScrollView
            contentContainerStyle={styles.unitRow}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {quoteUnits.map((option) => (
              <Pressable
                accessibilityRole="button"
                key={option}
                onPress={() => setUnit(option)}
                style={[
                  styles.unitChip,
                  unit === option ? styles.unitChipActive : null,
                ]}
              >
                <Text
                  style={[
                    styles.unitChipText,
                    unit === option ? styles.unitChipTextActive : null,
                  ]}
                >
                  {unitChipLabel(option)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.row}>
          <View style={styles.rowItem}>
            <Field
              keyboardType="decimal-pad"
              label="Qty"
              onChangeText={setQuantity}
              value={quantity}
            />
          </View>
          <View style={styles.rowItemWide}>
            <Text style={styles.fieldLabel}>{`Price per ${unitChipLabel(unit)}`}</Text>
            <View style={styles.priceInputWrap}>
              <Text style={styles.priceCurrency}>$</Text>
              <TextInput
                keyboardType="decimal-pad"
                onChangeText={setPrice}
                placeholder="0"
                placeholderTextColor={colors.ink3}
                style={styles.priceInput}
                value={price}
              />
            </View>
          </View>
        </View>

        <View style={styles.totalCard}>
          <View>
            <Text style={styles.totalLabel}>Line total</Text>
            <Text style={styles.totalFormula}>
              {quantity || 0} × {price ? formatMoney(dollarsToCents(price)) : "$0"}
            </Text>
          </View>
          <Text style={styles.totalAmount}>
            {previewTotalCents !== null ? formatMoney(previewTotalCents) : "$0"}
          </Text>
        </View>

        <Card>
          <ToggleRow
            helper={`Next time "${description || "this item"}" matches automatically.`}
            label="Save to price book"
            onChange={setSaveToPriceBook}
            value={saveToPriceBook}
          />
        </Card>

        {canSave ? (
          <View style={styles.previewSection}>
            <Text style={styles.fieldLabel}>How it'll look</Text>
            <View style={styles.previewCard}>
              <SwatchTab tone="green" />
              <View style={styles.previewBody}>
                <View style={styles.previewTextBlock}>
                  <Text numberOfLines={1} style={styles.previewTitle}>
                    {description.trim()}
                  </Text>
                  <Text numberOfLines={1} style={styles.previewSub}>
                    {describeQuantity(quantityNumber, unit)} · you priced this
                  </Text>
                </View>
                <Text style={styles.previewAmount}>
                  {formatMoney(lineTotalCents)}
                </Text>
              </View>
            </View>
          </View>
        ) : null}
      </ScrollView>
      <View style={styles.footer}>
        <PrimaryButton
          disabled={!canSave || saving}
          label={
            saving
              ? "Saving..."
              : lineTotalCents !== null
                ? `${isNew ? "Add line" : "Save line"} · ${formatMoney(lineTotalCents)}`
                : isNew
                  ? "Add line"
                  : "Save line"
          }
          onPress={() => void handleSave()}
        />
      </View>
    </Screen>
  );
}

function findPatchedLine(
  lines: Array<QuoteLineItem & { id: string }>,
  target: QuoteLineItem,
): (QuoteLineItem & { id: string }) | undefined {
  if (target.id) {
    const byId = lines.find((line) => line.id === target.id);

    if (byId) {
      return byId;
    }
  }

  return lines.find(
    (line) =>
      line.position === target.position &&
      line.description === target.description &&
      line.quantity === target.quantity &&
      line.unitPriceCents === target.unitPriceCents,
  );
}

function unitChipLabel(unit: QuoteUnit): string {
  if (unit === "sqft") {
    return "sq ft";
  }

  if (unit === "lnft") {
    return "linear ft";
  }

  return unit;
}

function chipLabel(matchState: "green" | "yellow" | "red"): string {
  if (matchState === "green") {
    return "Priced";
  }

  if (matchState === "yellow") {
    return "Suggested starter price";
  }

  return "Needs price";
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  notFound: {
    padding: spacing.lg,
  },
  description: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "700",
  },
  suggestedCard: {
    gap: 3,
  },
  suggestedLabel: {
    color: colors.ink2,
    fontSize: 13,
    fontWeight: "600",
  },
  suggestedPrice: {
    color: colors.ink,
    fontSize: 26,
    fontWeight: "800",
  },
  suggestedHelper: {
    color: colors.ink3,
    fontSize: 12,
    lineHeight: 16,
  },
  overrideLink: {
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  overrideLinkText: {
    color: colors.ink2,
    fontSize: 13,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  rowItem: {
    width: 90,
  },
  rowItemWide: {
    flex: 1,
    gap: 5,
  },
  field: {
    gap: 5,
  },
  fieldLabel: {
    color: colors.ink2,
    fontSize: 13,
    fontWeight: "600",
  },
  unitRow: {
    flexDirection: "row",
    gap: 5,
    paddingRight: spacing.lg,
  },
  unitChip: {
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  unitChipActive: {
    backgroundColor: colors.dark,
    borderColor: colors.dark,
  },
  unitChipText: {
    color: colors.ink2,
    fontSize: 12,
    fontWeight: "600",
  },
  unitChipTextActive: {
    color: colors.onDark,
  },
  priceInputWrap: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  priceCurrency: {
    color: colors.ink3,
    fontSize: 16,
    fontWeight: "700",
    marginRight: 4,
  },
  priceInput: {
    color: colors.ink,
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    paddingVertical: 0,
  },
  totalCard: {
    alignItems: "center",
    backgroundColor: colors.dark,
    borderRadius: radius.md,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
  },
  totalLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  totalFormula: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 3,
  },
  totalAmount: {
    color: colors.onDark,
    fontSize: 22,
    fontWeight: "900",
  },
  previewSection: {
    gap: 6,
  },
  previewCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 58,
    overflow: "hidden",
  },
  previewBody: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.sm,
  },
  previewTextBlock: {
    flex: 1,
    gap: 2,
    minWidth: 0,
    paddingRight: spacing.sm,
  },
  previewTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800",
  },
  previewSub: {
    color: colors.ink3,
    fontSize: 11,
    fontWeight: "600",
  },
  previewAmount: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900",
  },
  footer: {
    padding: spacing.lg,
    paddingTop: 0,
  },
});
