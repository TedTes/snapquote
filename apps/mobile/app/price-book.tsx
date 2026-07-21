import { useMemo, useState } from "react";
import { BookOpen, Check, CircleAlert, Lock, Plus, Search } from "lucide-react-native";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { quoteUnits, type PriceBookItem, type QuoteLineItem } from "@snapquote/shared";
import { AnimatedCard } from "../src/ui/AnimatedCard";
import { AnimatedSheetContent, SheetModal } from "../src/ui/AnimatedSheet";
import { BottomTabBar } from "../src/ui/BottomTabBar";
import { Field, PrimaryButton, Screen, SegmentedControl } from "../src/ui/components";
import { colors, radius, shadowLg, spacing } from "../src/ui/theme";
import { centsToDollars, dollarsToCents, useMvpStore } from "../src/state/mvp";
import { formatMoney } from "../src/lib/format";

const searchThreshold = 10;

export default function PriceBookScreen() {
  const priceBookItems = useMvpStore((state) => state.priceBookItems);
  const confirmPriceBookItem = useMvpStore((state) => state.confirmPriceBookItem);
  const addPriceBookItem = useMvpStore((state) => state.addPriceBookItem);

  const [query, setQuery] = useState("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const showSearch = priceBookItems.length > searchThreshold;

  const filtered = useMemo(() => {
    const term = showSearch ? query.trim().toLowerCase() : "";

    if (term.length === 0) {
      return priceBookItems;
    }

    return priceBookItems.filter(
      (item) => item.name.toLowerCase().includes(term) || item.description.toLowerCase().includes(term)
    );
  }, [priceBookItems, query, showSearch]);

  const active = filtered.filter((item) => item.confirmedAt !== null);
  const inactive = filtered.filter((item) => item.confirmedAt === null);
  const editingItem = priceBookItems.find((item) => item.id === editingItemId) ?? null;
  const confirmedCount = priceBookItems.filter((item) => item.confirmedAt !== null).length;
  const starterCount = priceBookItems.filter((item) => item.confirmedAt === null).length;
  const hasItems = priceBookItems.length > 0;

  return (
    <Screen edges={["top"]}>
      {hasItems ? (
        <View style={styles.screen}>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
              <View style={styles.titleRow}>
                <Text style={styles.title}>Price book</Text>
                <Text style={styles.itemCount}>{priceBookItems.length} items</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => setShowAddModal(true)}
                style={styles.addButton}
              >
                <Plus color={colors.ink} size={18} strokeWidth={2.3} />
              </Pressable>
            </View>

            <BookStrengthCard
              confirmedCount={confirmedCount}
              starterCount={starterCount}
              totalCount={priceBookItems.length}
            />

            {showSearch ? (
              <View style={styles.searchBox}>
                <Search color={colors.ink3} size={15} />
                <TextInput
                  accessibilityLabel="Search price book items"
                  onChangeText={setQuery}
                  placeholder="Search items"
                  placeholderTextColor={colors.ink3}
                  style={styles.searchInput}
                  value={query}
                />
              </View>
            ) : null}

            {active.length === 0 && inactive.length === 0 ? <NoPriceBookMatches /> : null}

            {active.length > 0 ? (
              <PriceBookSection count={active.length} label="Active — matches green">
                {active.map((item) => (
                  <ActivePriceItem key={item.id} item={item} onPress={() => setEditingItemId(item.id)} />
                ))}
              </PriceBookSection>
            ) : null}

            {inactive.length > 0 ? (
              <PriceBookSection count={inactive.length} label="Starters to confirm">
                {inactive.map((item) => (
                  <StarterPriceItem key={item.id} item={item} onPress={() => setEditingItemId(item.id)} />
                ))}
              </PriceBookSection>
            ) : null}
          </ScrollView>
        </View>
      ) : (
        <View style={styles.emptyScreen}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>Price book</Text>
              <Text style={styles.itemCount}>0 items</Text>
            </View>
          </View>

          <EmptyPriceBookState
            onAddManual={() => setShowAddModal(true)}
            onStarterSetup={() => router.push("/onboarding")}
          />
        </View>
      )}
      <BottomTabBar />

      <SheetModal onDismiss={() => setEditingItemId(null)} style={styles.modalBackdrop} visible={editingItem !== null}>
        {editingItem ? (
          <PriceItemModal
            item={editingItem}
            onClose={() => setEditingItemId(null)}
            onSave={(pricing) => {
              confirmPriceBookItem(editingItem.id, pricing);
              setEditingItemId(null);
            }}
          />
        ) : null}
      </SheetModal>

      <SheetModal onDismiss={() => setShowAddModal(false)} style={styles.modalBackdrop} visible={showAddModal}>
        <AddItemModal
          onClose={() => setShowAddModal(false)}
          onSave={(input) => {
            addPriceBookItem(input);
            setShowAddModal(false);
          }}
        />
      </SheetModal>
    </Screen>
  );
}

function BookStrengthCard(props: { confirmedCount: number; starterCount: number; totalCount: number }) {
  const segments = Array.from({ length: props.totalCount }, (_, index) => index);

  return (
    <View style={styles.strengthCard}>
      <View style={styles.strengthTop}>
        <Text style={styles.strengthLabel}>Book strength</Text>
        <Text style={styles.strengthCount}>
          {props.confirmedCount} of {props.totalCount} confirmed
        </Text>
      </View>
      <View style={styles.strengthBars}>
        {segments.map((index) => (
          <View
            key={index}
            style={[
              styles.strengthBar,
              { backgroundColor: index < props.confirmedCount ? colors.green : colors.amber }
            ]}
          />
        ))}
      </View>
      <Text style={styles.strengthCopy}>
        {props.starterCount > 0
          ? `Confirm the ${props.starterCount} starters below so they auto-match on your next quote.`
          : "Every item is confirmed and ready to match green on your next quote."}
      </Text>
    </View>
  );
}

function EmptyPriceBookState(props: { onStarterSetup: () => void; onAddManual: () => void }) {
  return (
    <View style={styles.emptyFull}>
      <View style={styles.emptyIconCard}>
        <BookOpen color={colors.ink} size={42} strokeWidth={1.9} />
      </View>

      <Text style={styles.emptyHeadline}>Build your price book</Text>
      <Text style={styles.emptyCopy}>
        This is where your prices live. SnapQuote drafts the scope of a job, but pulls every dollar from here — so it never guesses.
      </Text>

      <Pressable accessibilityRole="button" onPress={props.onStarterSetup} style={styles.emptyPrimary}>
        <Plus color={colors.onDark} size={16} strokeWidth={2.8} />
        <Text style={styles.emptyPrimaryText}>Set up starter prices</Text>
      </Pressable>

      <Pressable accessibilityRole="button" hitSlop={10} onPress={props.onAddManual}>
        <Text style={styles.manualLink}>Or add an item manually</Text>
      </Pressable>

      <View style={styles.emptyLock}>
        <Lock color={colors.ink3} size={11} />
        <Text style={styles.emptyLockText}>Prices come only from your book or you</Text>
      </View>
    </View>
  );
}

function PriceBookSection(props: { count: number; label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>{props.label}</Text>
        <Text style={styles.sectionCount}>{props.count}</Text>
      </View>
      <View style={styles.sectionCards}>{props.children}</View>
    </View>
  );
}

function ActivePriceItem(props: { item: PriceBookItem; onPress: () => void }) {
  return (
    <AnimatedCard>
      <Pressable accessibilityRole="button" onPress={props.onPress} style={styles.priceCard}>
        <View style={styles.checkBadge}>
          <Check color={colors.green} size={15} strokeWidth={2.8} />
        </View>
        <View style={styles.priceBody}>
          <Text style={styles.itemName} numberOfLines={1}>
            {props.item.name}
          </Text>
          <View style={styles.itemMetaRow}>
            <Text style={styles.unitBadge}>{unitBadgeLabel(props.item)}</Text>
            {props.item.pricing.type === "room_size" ? (
              <Text style={styles.itemSub} numberOfLines={1}>
                {roomSizeSummary(props.item.pricing)}
              </Text>
            ) : null}
            {!props.item.starter ? (
              <Text style={styles.savedText} numberOfLines={1}>
                + Saved from a quote
              </Text>
            ) : null}
          </View>
        </View>
        <Text style={styles.itemPrice}>{priceAmountLabel(props.item)}</Text>
      </Pressable>
    </AnimatedCard>
  );
}

function StarterPriceItem(props: { item: PriceBookItem; onPress: () => void }) {
  return (
    <AnimatedCard>
      <Pressable accessibilityRole="button" onPress={props.onPress} style={styles.starterCard}>
        <View style={styles.alertBadge}>
          <CircleAlert color={colors.amber} size={14} strokeWidth={2.5} />
        </View>
        <View style={styles.priceBody}>
          <Text style={styles.starterName} numberOfLines={1}>
            {props.item.name}
          </Text>
          <Text style={styles.starterSub} numberOfLines={1}>
            {priceAmountLabel(props.item)} suggested
          </Text>
        </View>
        <View style={styles.confirmButton}>
          <Check color={colors.amber} size={13} strokeWidth={2.5} />
          <Text style={styles.confirmButtonText}>Confirm</Text>
        </View>
      </Pressable>
    </AnimatedCard>
  );
}

function NoPriceBookMatches() {
  return (
    <View style={styles.noMatches}>
      <Text style={styles.noMatchesTitle}>Nothing matches</Text>
      <Text style={styles.noMatchesText}>Try another item name or clear the search.</Text>
    </View>
  );
}

function priceAmountLabel(item: PriceBookItem): string {
  if (item.pricing.type === "fixed") {
    return formatMoney(item.pricing.unitPriceCents);
  }

  return formatMoney(item.pricing.prices.medium);
}

function roomSizeSummary(pricing: Extract<PriceBookItem["pricing"], { type: "room_size" }>): string {
  const { small, medium, large } = pricing.prices;

  if (medium <= 0) {
    return `S ${formatMoney(small)} · L ${formatMoney(large)}`;
  }

  return `S ×${(small / medium).toFixed(1)} · L ×${(large / medium).toFixed(1)}`;
}

function unitBadgeLabel(item: PriceBookItem): string {
  if (item.pricing.type === "room_size") {
    return "PER ROOM";
  }

  if (item.unit === "each") {
    return "EACH";
  }

  if (item.unit === "hour") {
    return "PER HOUR";
  }

  return item.unit.toUpperCase();
}

function PriceItemModal(props: {
  item: PriceBookItem;
  onClose: () => void;
  onSave: (pricing: PriceBookItem["pricing"]) => void;
}) {
  const { item } = props;
  const pricing = item.pricing;
  const isRoomSize = pricing.type === "room_size";
  const [small, setSmall] = useState(pricing.type === "room_size" ? centsToDollars(pricing.prices.small) : "");
  const [medium, setMedium] = useState(
    pricing.type === "room_size" ? centsToDollars(pricing.prices.medium) : centsToDollars(pricing.unitPriceCents)
  );
  const [large, setLarge] = useState(pricing.type === "room_size" ? centsToDollars(pricing.prices.large) : "");

  function save() {
    if (isRoomSize) {
      props.onSave({
        type: "room_size",
        prices: { small: dollarsToCents(small), medium: dollarsToCents(medium), large: dollarsToCents(large) }
      });
      return;
    }

    props.onSave({ type: "fixed", unitPriceCents: dollarsToCents(medium) });
  }

  return (
    <AnimatedSheetContent style={styles.sheet}>
      <View style={styles.grabber} />
      <Text style={styles.sheetTitle}>{item.name}</Text>
      <Text style={styles.sheetSubtitle}>{item.description}</Text>

      {isRoomSize ? (
        <View style={styles.row}>
          <View style={styles.rowItem}>
            <Field keyboardType="decimal-pad" label="Small $" onChangeText={setSmall} value={small} />
          </View>
          <View style={styles.rowItem}>
            <Field keyboardType="decimal-pad" label="Medium $" onChangeText={setMedium} value={medium} />
          </View>
          <View style={styles.rowItem}>
            <Field keyboardType="decimal-pad" label="Large $" onChangeText={setLarge} value={large} />
          </View>
        </View>
      ) : (
        <Field keyboardType="decimal-pad" label={`Price ($ / ${item.unit})`} onChangeText={setMedium} value={medium} />
      )}

      <PrimaryButton label="Save price" onPress={save} />
      <Pressable accessibilityRole="button" onPress={props.onClose} style={styles.cancelLink}>
        <Text style={styles.cancelLinkText}>Cancel</Text>
      </Pressable>
    </AnimatedSheetContent>
  );
}

function AddItemModal(props: {
  onClose: () => void;
  onSave: (input: {
    name: string;
    description: string;
    unit: PriceBookItem["unit"];
    kind: PriceBookItem["kind"];
    pricing: PriceBookItem["pricing"];
  }) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [unit, setUnit] = useState<(typeof quoteUnits)[number]>("flat");
  const [kind, setKind] = useState<QuoteLineItem["kind"]>("labour");

  const canSave = name.trim().length > 0 && price.trim().length > 0;

  function save() {
    if (!canSave) {
      return;
    }

    props.onSave({
      name: name.trim(),
      description: description.trim(),
      unit,
      kind,
      pricing: { type: "fixed", unitPriceCents: dollarsToCents(price) }
    });
    setName("");
    setDescription("");
    setPrice("");
  }

  return (
    <AnimatedSheetContent style={styles.sheet}>
      <View style={styles.grabber} />
      <Text style={styles.sheetTitle}>Add price book item</Text>
      <Field label="Name" onChangeText={setName} placeholder="e.g. Pressure wash siding" value={name} />
      <Field label="Description" onChangeText={setDescription} placeholder="Optional" value={description} />
      <Field keyboardType="decimal-pad" label="Price ($)" onChangeText={setPrice} value={price} />

      <Text style={styles.fieldLabel}>Unit</Text>
      <View style={styles.unitRow}>
        {quoteUnits.map((option) => (
          <Pressable
            accessibilityRole="button"
            key={option}
            onPress={() => setUnit(option)}
            style={[styles.unitChip, unit === option ? styles.unitChipActive : null]}
          >
            <Text style={[styles.unitChipText, unit === option ? styles.unitChipTextActive : null]}>{option}</Text>
          </Pressable>
        ))}
      </View>

      <SegmentedControl
        onChange={setKind}
        options={[
          { label: "Labour", value: "labour" },
          { label: "Material", value: "material" }
        ]}
        value={kind}
      />

      <PrimaryButton disabled={!canSave} label="Add item" onPress={save} />
      <Pressable accessibilityRole="button" onPress={props.onClose} style={styles.cancelLink}>
        <Text style={styles.cancelLinkText}>Cancel</Text>
      </Pressable>
    </AnimatedSheetContent>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1
  },
  content: {
    gap: 12,
    padding: 18,
    paddingBottom: 92
  },
  emptyScreen: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 22
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
  itemCount: {
    color: colors.ink3,
    fontSize: 13,
    fontWeight: "800"
  },
  addButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 38
  },
  strengthCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 11,
    borderWidth: 1,
    gap: 9,
    padding: 14
  },
  strengthTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  strengthLabel: {
    color: colors.ink2,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.4,
    textTransform: "uppercase"
  },
  strengthCount: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900"
  },
  strengthBars: {
    flexDirection: "row",
    gap: 4
  },
  strengthBar: {
    borderRadius: 2,
    flex: 1,
    height: 11
  },
  strengthCopy: {
    color: colors.ink3,
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 14
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
  section: {
    gap: 8,
    marginTop: 10
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8
  },
  sectionLabel: {
    color: colors.ink3,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.45,
    textTransform: "uppercase"
  },
  sectionCount: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    color: colors.ink3,
    fontSize: 9,
    fontWeight: "900",
    minWidth: 17,
    overflow: "hidden",
    paddingHorizontal: 5,
    paddingVertical: 1,
    textAlign: "center"
  },
  sectionCards: {
    gap: 8
  },
  priceCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 11,
    minHeight: 67,
    paddingHorizontal: 13
  },
  starterCard: {
    alignItems: "center",
    backgroundColor: "rgba(255,254,250,0.55)",
    borderColor: colors.border,
    borderRadius: 10,
    borderStyle: "dashed",
    borderWidth: 1,
    flexDirection: "row",
    gap: 11,
    minHeight: 67,
    paddingHorizontal: 13
  },
  checkBadge: {
    alignItems: "center",
    backgroundColor: colors.greenBg,
    borderRadius: 8,
    height: 25,
    justifyContent: "center",
    width: 25
  },
  alertBadge: {
    alignItems: "center",
    backgroundColor: colors.amberBg,
    borderRadius: 8,
    height: 25,
    justifyContent: "center",
    width: 25
  },
  priceBody: {
    flex: 1,
    gap: 6,
    minWidth: 0
  },
  itemName: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900"
  },
  starterName: {
    color: colors.ink2,
    fontSize: 14,
    fontWeight: "900"
  },
  itemMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
    minWidth: 0
  },
  unitBadge: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 4,
    borderWidth: 1,
    color: colors.ink2,
    fontSize: 9,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 6,
    paddingVertical: 3
  },
  itemSub: {
    color: colors.ink3,
    flexShrink: 1,
    fontSize: 10,
    fontWeight: "800"
  },
  savedText: {
    color: colors.green,
    flexShrink: 1,
    fontSize: 10,
    fontWeight: "800"
  },
  starterSub: {
    color: colors.amber,
    fontSize: 11,
    fontWeight: "800"
  },
  itemPrice: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900",
    textAlign: "right"
  },
  confirmButton: {
    alignItems: "center",
    backgroundColor: colors.amberBg,
    borderColor: colors.amberBorder,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    height: 34,
    justifyContent: "center",
    paddingHorizontal: 12
  },
  confirmButtonText: {
    color: colors.amber,
    fontSize: 12,
    fontWeight: "900"
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
  emptyFull: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingBottom: 86,
    paddingHorizontal: 34
  },
  emptyIconCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 21,
    borderWidth: 1,
    height: 96,
    justifyContent: "center",
    marginBottom: 24,
    width: 96,
    ...shadowLg
  },
  emptyHeadline: {
    color: colors.ink,
    fontSize: 21,
    fontWeight: "900",
    marginBottom: 9,
    textAlign: "center"
  },
  emptyCopy: {
    color: colors.ink2,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
    marginBottom: 26,
    maxWidth: 290,
    textAlign: "center"
  },
  emptyPrimary: {
    alignItems: "center",
    backgroundColor: colors.dark,
    borderRadius: 12,
    flexDirection: "row",
    gap: 8,
    height: 47,
    justifyContent: "center",
    marginBottom: 13,
    paddingHorizontal: 25,
    ...shadowLg
  },
  emptyPrimaryText: {
    color: colors.onDark,
    fontSize: 15,
    fontWeight: "900"
  },
  manualLink: {
    color: colors.ink2,
    fontSize: 13,
    fontWeight: "900"
  },
  emptyLock: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    marginTop: 28
  },
  emptyLockText: {
    color: colors.ink3,
    fontSize: 12,
    fontWeight: "600"
  },
  modalBackdrop: {
    backgroundColor: "rgba(18,22,28,0.35)",
    flex: 1,
    justifyContent: "flex-end"
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    gap: spacing.sm,
    padding: spacing.lg
  },
  grabber: {
    alignSelf: "center",
    backgroundColor: colors.border,
    borderRadius: 999,
    height: 4,
    marginBottom: spacing.xs,
    width: 38
  },
  sheetTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "800"
  },
  sheetSubtitle: {
    color: colors.ink2,
    fontSize: 13,
    marginBottom: spacing.xs
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm
  },
  rowItem: {
    flex: 1
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
  cancelLink: {
    alignItems: "center",
    paddingVertical: spacing.xs
  },
  cancelLinkText: {
    color: colors.ink3,
    fontSize: 13,
    fontWeight: "600"
  }
});
