import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { quoteUnits, type QuoteLineItem } from "@snapquote/shared";
import {
  Banner,
  Card,
  Chip,
  EmptyState,
  Field,
  GhostButton,
  PrimaryButton,
  Screen,
  SegmentedControl,
  ToggleRow,
  TopBar
} from "../../../../src/ui/components";
import { colors, radius, spacing } from "../../../../src/ui/theme";
import { formatMoney } from "../../../../src/lib/format";
import { centsToDollars, dollarsToCents, useMvpStore } from "../../../../src/state/mvp";

type QuoteUnit = (typeof quoteUnits)[number];

export default function EditLineScreen() {
  const { id, lineId } = useLocalSearchParams<{ id: string; lineId: string }>();
  const quote = useMvpStore((state) => state.quotes.find((candidate) => candidate.id === id));
  const priceBookItems = useMvpStore((state) => state.priceBookItems);
  const updateLineItem = useMvpStore((state) => state.updateLineItem);
  const addManualLine = useMvpStore((state) => state.addManualLine);
  const removeLine = useMvpStore((state) => state.removeLine);
  const confirmYellowLine = useMvpStore((state) => state.confirmYellowLine);
  const saveLineToPriceBook = useMvpStore((state) => state.saveLineToPriceBook);

  const isNew = lineId === "new";
  const existingLine = quote?.lineItems.find((line) => line.id === lineId);
  const suggestedItem =
    existingLine?.priceBookItemId !== null && existingLine?.priceBookItemId !== undefined
      ? priceBookItems.find((item) => item.id === existingLine.priceBookItemId)
      : undefined;

  const [overriding, setOverriding] = useState(false);
  const [description, setDescription] = useState(existingLine?.description ?? "");
  const [quantity, setQuantity] = useState(String(existingLine?.quantity ?? 1));
  const [unit, setUnit] = useState<QuoteUnit>(existingLine?.unit ?? "flat");
  const [kind, setKind] = useState<QuoteLineItem["kind"]>(existingLine?.kind ?? "labour");
  const [price, setPrice] = useState(
    existingLine?.unitPriceCents !== null && existingLine?.unitPriceCents !== undefined
      ? centsToDollars(existingLine.unitPriceCents)
      : ""
  );
  const [saveToPriceBook, setSaveToPriceBook] = useState(false);

  if (!id || !quote || (!isNew && !existingLine)) {
    return (
      <Screen>
        <TopBar title="Line" onBack={() => router.back()} />
        <View style={styles.notFound}>
          <EmptyState text="It may have already been removed." title="Line not found" />
        </View>
      </Screen>
    );
  }

  const quoteId = quote.id;

  function close() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace({ pathname: "/quote/[id]", params: { id: quoteId } });
    }
  }

  const isYellowConfirmMode = existingLine !== undefined && existingLine.matchState === "yellow" && !overriding;

  function handleConfirm() {
    if (!existingLine) {
      return;
    }

    confirmYellowLine(quoteId, existingLine.id);
    close();
  }

  const quantityNumber = Number(quantity);
  const priceCents = price.trim().length > 0 ? dollarsToCents(price) : null;
  const canSave =
    description.trim().length > 0 && Number.isFinite(quantityNumber) && quantityNumber > 0 && priceCents !== null;

  function handleSave() {
    if (!canSave || priceCents === null) {
      return;
    }

    const input = {
      description: description.trim(),
      quantity: quantityNumber,
      unit,
      unitPriceCents: priceCents,
      kind
    };

    let targetLineId: string | null = null;

    if (isNew) {
      targetLineId = addManualLine(quoteId, input);
    } else if (existingLine) {
      updateLineItem(quoteId, existingLine.id, input);
      targetLineId = existingLine.id;
    }

    if (saveToPriceBook && targetLineId) {
      saveLineToPriceBook(quoteId, targetLineId);
    }

    close();
  }

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
          removeLine(quoteId, existingLine.id);
          close();
        }
      }
    ]);
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
            <Text style={styles.suggestedLabel}>{suggestedItem?.name ?? "Starter price"}</Text>
            <Text style={styles.suggestedPrice}>{formatMoney(suggestedCents)}</Text>
            <Text style={styles.suggestedHelper}>
              This price comes from your starter price book and hasn't been confirmed yet.
            </Text>
          </Card>
          <PrimaryButton label="Confirm starter price" onPress={handleConfirm} />
          <Pressable accessibilityRole="button" onPress={() => setOverriding(true)} style={styles.overrideLink}>
            <Text style={styles.overrideLinkText}>Override with a different price instead</Text>
          </Pressable>
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <TopBar title={isNew ? "Add line" : "Edit line"} onBack={close} />
      <ScrollView contentContainerStyle={styles.content}>
        {existingLine ? <Chip label={chipLabel(existingLine.matchState)} tone={existingLine.matchState} /> : null}

        <Field label="Description" onChangeText={setDescription} placeholder="What's this line for?" value={description} />

        <View style={styles.row}>
          <View style={styles.rowItem}>
            <Field keyboardType="decimal-pad" label="Qty" onChangeText={setQuantity} value={quantity} />
          </View>
          <View style={styles.rowItemWide}>
            <Text style={styles.fieldLabel}>Unit</Text>
            <View style={styles.unitRow}>
              {quoteUnits.map((option) => (
                <Pressable
                  accessibilityRole="button"
                  key={option}
                  onPress={() => setUnit(option)}
                  style={[styles.unitChip, unit === option ? styles.unitChipActive : null]}
                >
                  <Text style={[styles.unitChipText, unit === option ? styles.unitChipTextActive : null]}>
                    {option}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        <Field keyboardType="decimal-pad" label="Price ($)" onChangeText={setPrice} placeholder="0" value={price} />

        <View>
          <Text style={styles.fieldLabel}>Line type</Text>
          <SegmentedControl
            onChange={setKind}
            options={[
              { label: "Labour", value: "labour" },
              { label: "Material", value: "material" }
            ]}
            value={kind}
          />
        </View>

        <Card>
          <ToggleRow
            helper={`Next time "${description || "this item"}" matches automatically as green.`}
            label="Save to price book"
            onChange={setSaveToPriceBook}
            value={saveToPriceBook}
          />
        </Card>

        <Banner tone="neutral">Line total updates the quote instantly.</Banner>

        {existingLine ? <GhostButton label="Remove line" onPress={handleRemove} tone="danger" /> : null}
      </ScrollView>
      <View style={styles.footer}>
        <PrimaryButton disabled={!canSave} label="Save line" onPress={handleSave} />
      </View>
    </Screen>
  );
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
    gap: spacing.lg,
    padding: spacing.lg
  },
  notFound: {
    padding: spacing.lg
  },
  description: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "700"
  },
  suggestedCard: {
    gap: 4
  },
  suggestedLabel: {
    color: colors.ink2,
    fontSize: 13,
    fontWeight: "600"
  },
  suggestedPrice: {
    color: colors.ink,
    fontSize: 26,
    fontWeight: "800"
  },
  suggestedHelper: {
    color: colors.ink3,
    fontSize: 12,
    lineHeight: 16
  },
  overrideLink: {
    alignItems: "center",
    paddingVertical: spacing.sm
  },
  overrideLinkText: {
    color: colors.ink2,
    fontSize: 13,
    fontWeight: "600",
    textDecorationLine: "underline"
  },
  row: {
    flexDirection: "row",
    gap: spacing.md
  },
  rowItem: {
    width: 90
  },
  rowItemWide: {
    flex: 1,
    gap: 6
  },
  fieldLabel: {
    color: colors.ink2,
    fontSize: 13,
    fontWeight: "600"
  },
  unitRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  unitChip: {
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6
  },
  unitChipActive: {
    backgroundColor: colors.dark,
    borderColor: colors.dark
  },
  unitChipText: {
    color: colors.ink2,
    fontSize: 12,
    fontWeight: "600"
  },
  unitChipTextActive: {
    color: colors.onDark
  },
  footer: {
    padding: spacing.lg,
    paddingTop: 0
  }
});
