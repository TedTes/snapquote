import { useMemo, useState } from "react";
import {
  Archive,
  BookOpen,
  Check,
  CircleAlert,
  Lock,
  Plus,
  Search,
} from "lucide-react-native";
import { router } from "expo-router";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  quoteUnits,
  type PriceBookItem,
  type QuoteLineItem,
} from "@snapquote/shared";
import { AnimatedCard } from "../src/ui/AnimatedCard";
import { AnimatedSheetContent, SheetModal } from "../src/ui/AnimatedSheet";
import { BottomTabBar } from "../src/ui/BottomTabBar";
import {
  Field,
  PrimaryButton,
  Screen,
  SegmentedControl,
} from "../src/ui/components";
import { colors, radius, shadowLg, spacing } from "../src/ui/theme";
import { centsToDollars, dollarsToCents, useMvpStore } from "../src/state/mvp";
import { useAuthStore } from "../src/state/auth";
import { formatMoney } from "../src/lib/format";
import { snapquoteApi, userFacingErrorMessage } from "../src/lib/api";

const searchThreshold = 10;

export default function PriceBookScreen() {
  const priceBookItems = useMvpStore((state) => state.priceBookItems);
  const authStatus = useAuthStore((state) => state.status);
  const addPriceBookItem = useMvpStore((state) => state.addPriceBookItem);
  const confirmPriceBookItem = useMvpStore(
    (state) => state.confirmPriceBookItem,
  );
  const updatePriceBookItem = useMvpStore((state) => state.updatePriceBookItem);
  const archivePriceBookItem = useMvpStore(
    (state) => state.archivePriceBookItem,
  );
  const upsertPriceBookItem = useMvpStore((state) => state.upsertPriceBookItem);

  const [query, setQuery] = useState("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [archivingItemId, setArchivingItemId] = useState<string | null>(null);
  const [savingNewItem, setSavingNewItem] = useState(false);
  const showSearch = priceBookItems.length > searchThreshold;

  const filtered = useMemo(() => {
    const term = showSearch ? query.trim().toLowerCase() : "";

    if (term.length === 0) {
      return priceBookItems;
    }

    return priceBookItems.filter(
      (item) =>
        item.name.toLowerCase().includes(term) ||
        item.description.toLowerCase().includes(term),
    );
  }, [priceBookItems, query, showSearch]);

  const active = filtered.filter((item) => item.confirmedAt !== null);
  const inactive = filtered.filter((item) => item.confirmedAt === null);
  const editingItem =
    priceBookItems.find((item) => item.id === editingItemId) ?? null;
  const confirmedCount = priceBookItems.filter(
    (item) => item.confirmedAt !== null,
  ).length;
  const starterCount = priceBookItems.filter(
    (item) => item.confirmedAt === null,
  ).length;
  const hasItems = priceBookItems.length > 0;
  const hasConfirmedPrices = confirmedCount > 0;

  async function saveExistingPrice(
    item: PriceBookItem,
    input: {
      name: string;
      description: string;
      pricing: PriceBookItem["pricing"];
    },
  ) {
    if (savingItemId !== null) {
      return;
    }

    setSavingItemId(item.id);

    try {
      if (authStatus !== "signed_in") {
        confirmPriceBookItem(item.id, input.pricing);
        updatePriceBookItem(item.id, input);
        setEditingItemId(null);
        return;
      }

      const updated = await snapquoteApi.updatePriceBookItem(item.id, {
        ...input,
        confirmed: true,
      });
      upsertPriceBookItem(updated);
      setEditingItemId(null);
    } catch (error) {
      Alert.alert("Could not save price", userFacingErrorMessage(error));
    } finally {
      setSavingItemId(null);
    }
  }

  async function archiveExistingPrice(item: PriceBookItem) {
    if (archivingItemId !== null || savingItemId !== null) {
      return;
    }

    setArchivingItemId(item.id);

    try {
      if (authStatus !== "signed_in") {
        archivePriceBookItem(item.id);
        setEditingItemId(null);
        return;
      }

      await snapquoteApi.archivePriceBookItem(item.id);
      archivePriceBookItem(item.id);
      setEditingItemId(null);
    } catch (error) {
      Alert.alert("Could not archive item", userFacingErrorMessage(error));
    } finally {
      setArchivingItemId(null);
    }
  }

  function confirmArchive(item: PriceBookItem) {
    Alert.alert(
      "Archive price item?",
      `${item.name} will stop matching future quotes. Existing quotes keep their saved line prices.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Archive",
          style: "destructive",
          onPress: () => void archiveExistingPrice(item),
        },
      ],
    );
  }

  async function saveNewItem(input: {
    name: string;
    description: string;
    unit: PriceBookItem["unit"];
    kind: PriceBookItem["kind"];
    pricing: PriceBookItem["pricing"];
  }) {
    if (savingNewItem) {
      return;
    }

    setSavingNewItem(true);

    try {
      if (authStatus !== "signed_in") {
        addPriceBookItem(input);
        setShowAddModal(false);
        return;
      }

      const created = await snapquoteApi.createPriceBookItem({
        ...input,
        confirmed: true,
      });
      upsertPriceBookItem(created);
      setShowAddModal(false);
    } catch (error) {
      Alert.alert("Could not add price", userFacingErrorMessage(error));
    } finally {
      setSavingNewItem(false);
    }
  }

  return (
    <Screen edges={["top"]}>
      {hasItems ? (
        <View style={styles.screen}>
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.header}>
              <View style={styles.titleRow}>
                <Text style={styles.title}>Price book</Text>
                <Text style={styles.itemCount}>
                  {priceBookItems.length} items
                </Text>
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

            {!hasConfirmedPrices && query.trim().length === 0 ? (
              <ZeroRealPricesCard
                onAddManual={() => setShowAddModal(true)}
                onStarterSetup={() => router.push("/onboarding")}
              />
            ) : null}

            {active.length === 0 && inactive.length === 0 ? (
              <NoPriceBookMatches />
            ) : null}

            {active.length > 0 ? (
              <PriceBookSection
                count={active.length}
                label="Active — matches green"
              >
                {active.map((item) => (
                  <ActivePriceItem
                    key={item.id}
                    item={item}
                    onPress={() => setEditingItemId(item.id)}
                  />
                ))}
              </PriceBookSection>
            ) : null}

            {inactive.length > 0 ? (
              <PriceBookSection
                count={inactive.length}
                label="Starters to confirm"
              >
                {inactive.map((item) => (
                  <StarterPriceItem
                    key={item.id}
                    item={item}
                    onPress={() => setEditingItemId(item.id)}
                  />
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

      <SheetModal
        onDismiss={() => setEditingItemId(null)}
        style={styles.modalBackdrop}
        visible={editingItem !== null}
      >
        {editingItem ? (
          <PriceItemModal
            item={editingItem}
            onClose={() => setEditingItemId(null)}
            archiving={archivingItemId === editingItem.id}
            saving={
              savingItemId === editingItem.id ||
              archivingItemId === editingItem.id
            }
            onArchive={() => confirmArchive(editingItem)}
            onSave={(input) => {
              void saveExistingPrice(editingItem, input);
            }}
          />
        ) : null}
      </SheetModal>

      <SheetModal
        onDismiss={() => setShowAddModal(false)}
        style={styles.modalBackdrop}
        visible={showAddModal}
      >
        <AddItemModal
          onClose={() => setShowAddModal(false)}
          onSave={(input) => void saveNewItem(input)}
          saving={savingNewItem}
        />
      </SheetModal>
    </Screen>
  );
}

function BookStrengthCard(props: {
  confirmedCount: number;
  starterCount: number;
  totalCount: number;
}) {
  const segments = Array.from(
    { length: props.totalCount },
    (_, index) => index,
  );

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
              {
                backgroundColor:
                  index < props.confirmedCount ? colors.green : colors.amber,
              },
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

function EmptyPriceBookState(props: {
  onStarterSetup: () => void;
  onAddManual: () => void;
}) {
  return (
    <View style={styles.emptyFull}>
      <View style={styles.emptyIconCard}>
        <BookOpen color={colors.ink} size={42} strokeWidth={1.9} />
      </View>

      <Text style={styles.emptyHeadline}>Build your price book</Text>
      <Text style={styles.emptyCopy}>
        This is where your prices live. SnapQuote drafts the scope of a job, but
        pulls every dollar from here — so it never guesses.
      </Text>

      <Pressable
        accessibilityRole="button"
        onPress={props.onStarterSetup}
        style={styles.emptyPrimary}
      >
        <Plus color={colors.onDark} size={16} strokeWidth={2.8} />
        <Text style={styles.emptyPrimaryText}>Set up starter prices</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        hitSlop={10}
        onPress={props.onAddManual}
      >
        <Text style={styles.manualLink}>Or add an item manually</Text>
      </Pressable>

      <View style={styles.emptyLock}>
        <Lock color={colors.ink3} size={11} />
        <Text style={styles.emptyLockText}>
          Prices come only from your book or you
        </Text>
      </View>
    </View>
  );
}

function ZeroRealPricesCard(props: {
  onStarterSetup: () => void;
  onAddManual: () => void;
}) {
  return (
    <View style={styles.zeroRealCard}>
      <View style={styles.zeroRealIcon}>
        <BookOpen color={colors.green} size={22} strokeWidth={2} />
      </View>
      <View style={styles.zeroRealBody}>
        <Text style={styles.zeroRealTitle}>No confirmed prices yet</Text>
        <Text style={styles.zeroRealText}>
          Confirm starter prices or add one custom item. Only confirmed prices
          can match green on quotes.
        </Text>
      </View>
      <View style={styles.zeroRealActions}>
        <Pressable
          accessibilityRole="button"
          onPress={props.onStarterSetup}
          style={styles.zeroRealPrimary}
        >
          <Text style={styles.zeroRealPrimaryText}>Setup</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={props.onAddManual}
          style={styles.zeroRealSecondary}
        >
          <Plus color={colors.ink2} size={14} strokeWidth={2.4} />
        </Pressable>
      </View>
    </View>
  );
}

function PriceBookSection(props: {
  count: number;
  label: string;
  children: React.ReactNode;
}) {
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
      <Pressable
        accessibilityRole="button"
        onPress={props.onPress}
        style={styles.priceCard}
      >
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
      <Pressable
        accessibilityRole="button"
        onPress={props.onPress}
        style={styles.starterCard}
      >
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
      <Text style={styles.noMatchesText}>
        Try another item name or clear the search.
      </Text>
    </View>
  );
}

function priceAmountLabel(item: PriceBookItem): string {
  if (item.pricing.type === "fixed") {
    return formatMoney(item.pricing.unitPriceCents);
  }

  return formatMoney(item.pricing.prices.medium);
}

function roomSizeSummary(
  pricing: Extract<PriceBookItem["pricing"], { type: "room_size" }>,
): string {
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
  archiving: boolean;
  onArchive: () => void;
  onClose: () => void;
  onSave: (input: {
    name: string;
    description: string;
    pricing: PriceBookItem["pricing"];
  }) => void;
  saving: boolean;
}) {
  const { item } = props;
  const pricing = item.pricing;
  const isRoomSize = pricing.type === "room_size";
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description);
  const [small, setSmall] = useState(
    pricing.type === "room_size" ? centsToDollars(pricing.prices.small) : "",
  );
  const [medium, setMedium] = useState(
    pricing.type === "room_size"
      ? centsToDollars(pricing.prices.medium)
      : centsToDollars(pricing.unitPriceCents),
  );
  const [large, setLarge] = useState(
    pricing.type === "room_size" ? centsToDollars(pricing.prices.large) : "",
  );
  const canSave = name.trim().length > 0 && medium.trim().length > 0;

  function save() {
    if (!canSave || props.saving) {
      return;
    }

    if (isRoomSize) {
      props.onSave({
        name: name.trim(),
        description: description.trim(),
        pricing: {
          type: "room_size",
          prices: {
            small: dollarsToCents(small),
            medium: dollarsToCents(medium),
            large: dollarsToCents(large),
          },
        },
      });
      return;
    }

    props.onSave({
      name: name.trim(),
      description: description.trim(),
      pricing: { type: "fixed", unitPriceCents: dollarsToCents(medium) },
    });
  }

  return (
    <AnimatedSheetContent style={styles.sheet}>
      <View style={styles.grabber} />
      <Text style={styles.sheetTitle}>
        {item.confirmedAt === null ? "Confirm starter price" : "Edit price"}
      </Text>
      <Text style={styles.sheetSubtitle}>
        {item.confirmedAt === null
          ? "Review the details once. Confirmed items match green next time."
          : "Keep the item name and price current for future quotes."}
      </Text>

      <Field label="Item name" onChangeText={setName} value={name} />
      <Field
        label="Description"
        onChangeText={setDescription}
        placeholder="Optional note for matching and context"
        value={description}
      />

      {isRoomSize ? (
        <View style={styles.row}>
          <View style={styles.rowItem}>
            <Field
              keyboardType="decimal-pad"
              label="Small $"
              onChangeText={setSmall}
              value={small}
            />
          </View>
          <View style={styles.rowItem}>
            <Field
              keyboardType="decimal-pad"
              label="Medium $"
              onChangeText={setMedium}
              value={medium}
            />
          </View>
          <View style={styles.rowItem}>
            <Field
              keyboardType="decimal-pad"
              label="Large $"
              onChangeText={setLarge}
              value={large}
            />
          </View>
        </View>
      ) : (
        <Field
          keyboardType="decimal-pad"
          label={`Price ($ / ${item.unit})`}
          onChangeText={setMedium}
          value={medium}
        />
      )}

      <PrimaryButton
        disabled={!canSave || props.saving}
        label={
          props.saving
            ? props.archiving
              ? "Archiving..."
              : "Saving..."
            : item.confirmedAt === null
              ? "Confirm price"
              : "Save changes"
        }
        onPress={save}
      />
      <Pressable
        accessibilityRole="button"
        disabled={props.saving}
        onPress={props.onArchive}
        style={styles.archiveLink}
      >
        <Archive color={colors.red} size={14} strokeWidth={2.4} />
        <Text style={styles.archiveLinkText}>Archive item</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        disabled={props.saving}
        onPress={props.onClose}
        style={styles.cancelLink}
      >
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
  saving: boolean;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [unit, setUnit] = useState<(typeof quoteUnits)[number]>("flat");
  const [kind, setKind] = useState<QuoteLineItem["kind"]>("labour");

  const canSave = name.trim().length > 0 && price.trim().length > 0;

  function save() {
    if (!canSave || props.saving) {
      return;
    }

    props.onSave({
      name: name.trim(),
      description: description.trim(),
      unit,
      kind,
      pricing: { type: "fixed", unitPriceCents: dollarsToCents(price) },
    });
    setName("");
    setDescription("");
    setPrice("");
  }

  return (
    <AnimatedSheetContent style={styles.sheet}>
      <View style={styles.grabber} />
      <Text style={styles.sheetTitle}>Add price book item</Text>
      <Field
        label="Name"
        onChangeText={setName}
        placeholder="e.g. Pressure wash siding"
        value={name}
      />
      <Field
        label="Description"
        onChangeText={setDescription}
        placeholder="Optional"
        value={description}
      />
      <Field
        keyboardType="decimal-pad"
        label="Price ($)"
        onChangeText={setPrice}
        value={price}
      />

      <Text style={styles.fieldLabel}>Unit</Text>
      <View style={styles.unitRow}>
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
              {option}
            </Text>
          </Pressable>
        ))}
      </View>

      <SegmentedControl
        onChange={setKind}
        options={[
          { label: "Labour", value: "labour" },
          { label: "Material", value: "material" },
        ]}
        value={kind}
      />

      <PrimaryButton
        disabled={!canSave || props.saving}
        label={props.saving ? "Adding..." : "Add item"}
        onPress={save}
      />
      <Pressable
        accessibilityRole="button"
        disabled={props.saving}
        onPress={props.onClose}
        style={styles.cancelLink}
      >
        <Text style={styles.cancelLinkText}>Cancel</Text>
      </Pressable>
    </AnimatedSheetContent>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    gap: 12,
    padding: 20,
    paddingBottom: 92,
  },
  emptyScreen: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  titleRow: {
    alignItems: "baseline",
    flexDirection: "row",
    gap: 10,
  },
  title: {
    color: colors.ink,
    fontSize: 25,
    fontWeight: "900",
    letterSpacing: 0,
  },
  itemCount: {
    color: colors.ink3,
    fontSize: 13,
    fontWeight: "800",
  },
  addButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  strengthCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 11,
    borderWidth: 1,
    gap: 9,
    padding: 14,
  },
  strengthTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  strengthLabel: {
    color: colors.ink2,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  strengthCount: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900",
  },
  strengthBars: {
    flexDirection: "row",
    gap: 4,
  },
  strengthBar: {
    borderRadius: 2,
    flex: 1,
    height: 11,
  },
  strengthCopy: {
    color: colors.ink3,
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 14,
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
    paddingHorizontal: 12,
  },
  searchInput: {
    color: colors.ink,
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
  },
  section: {
    gap: 8,
    marginTop: 10,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  sectionLabel: {
    color: colors.ink3,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.45,
    textTransform: "uppercase",
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
    textAlign: "center",
  },
  sectionCards: {
    gap: 8,
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
    paddingHorizontal: 13,
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
    paddingHorizontal: 13,
  },
  checkBadge: {
    alignItems: "center",
    backgroundColor: colors.greenBg,
    borderRadius: 8,
    height: 25,
    justifyContent: "center",
    width: 25,
  },
  alertBadge: {
    alignItems: "center",
    backgroundColor: colors.amberBg,
    borderRadius: 8,
    height: 25,
    justifyContent: "center",
    width: 25,
  },
  priceBody: {
    flex: 1,
    gap: 6,
    minWidth: 0,
  },
  itemName: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  starterName: {
    color: colors.ink2,
    fontSize: 14,
    fontWeight: "900",
  },
  itemMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
    minWidth: 0,
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
    paddingVertical: 3,
  },
  itemSub: {
    color: colors.ink3,
    flexShrink: 1,
    fontSize: 10,
    fontWeight: "800",
  },
  savedText: {
    color: colors.green,
    flexShrink: 1,
    fontSize: 10,
    fontWeight: "800",
  },
  starterSub: {
    color: colors.amber,
    fontSize: 11,
    fontWeight: "800",
  },
  itemPrice: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900",
    textAlign: "right",
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
    paddingHorizontal: 12,
  },
  confirmButtonText: {
    color: colors.amber,
    fontSize: 12,
    fontWeight: "900",
  },
  noMatches: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 5,
    padding: 16,
  },
  noMatchesTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900",
  },
  noMatchesText: {
    color: colors.ink2,
    fontSize: 13,
    fontWeight: "600",
  },
  emptyFull: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingBottom: 86,
    paddingHorizontal: 34,
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
    ...shadowLg,
  },
  emptyHeadline: {
    color: colors.ink,
    fontSize: 21,
    fontWeight: "900",
    marginBottom: 9,
    textAlign: "center",
  },
  emptyCopy: {
    color: colors.ink2,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
    marginBottom: 26,
    maxWidth: 290,
    textAlign: "center",
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
    ...shadowLg,
  },
  emptyPrimaryText: {
    color: colors.onDark,
    fontSize: 15,
    fontWeight: "900",
  },
  manualLink: {
    color: colors.ink2,
    fontSize: 13,
    fontWeight: "900",
  },
  emptyLock: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    marginTop: 28,
  },
  emptyLockText: {
    color: colors.ink3,
    fontSize: 12,
    fontWeight: "600",
  },
  zeroRealCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 14,
  },
  zeroRealIcon: {
    alignItems: "center",
    backgroundColor: colors.greenBg,
    borderRadius: 10,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  zeroRealBody: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  zeroRealTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900",
  },
  zeroRealText: {
    color: colors.ink2,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
  },
  zeroRealActions: {
    alignItems: "center",
    gap: 8,
  },
  zeroRealPrimary: {
    alignItems: "center",
    backgroundColor: colors.dark,
    borderRadius: 8,
    height: 32,
    justifyContent: "center",
    paddingHorizontal: 13,
  },
  zeroRealPrimaryText: {
    color: colors.onDark,
    fontSize: 12,
    fontWeight: "900",
  },
  zeroRealSecondary: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  modalBackdrop: {
    backgroundColor: "rgba(18,22,28,0.35)",
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  grabber: {
    alignSelf: "center",
    backgroundColor: colors.border,
    borderRadius: 999,
    height: 4,
    marginBottom: spacing.xs,
    width: 38,
  },
  sheetTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "800",
  },
  sheetSubtitle: {
    color: colors.ink2,
    fontSize: 13,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  rowItem: {
    flex: 1,
  },
  fieldLabel: {
    color: colors.ink2,
    fontSize: 13,
    fontWeight: "600",
  },
  unitRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  unitChip: {
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
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
  cancelLink: {
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  cancelLinkText: {
    color: colors.ink3,
    fontSize: 13,
    fontWeight: "600",
  },
  archiveLink: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    paddingTop: spacing.xs,
  },
  archiveLinkText: {
    color: colors.red,
    fontSize: 13,
    fontWeight: "800",
  },
});
