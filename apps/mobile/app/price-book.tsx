import { useMemo, useState } from "react";
import {
  Archive,
  BookOpen,
  Check,
  ChevronRight,
  Lock,
  Plus,
  Search,
  X,
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
} from "@snapquote/shared";
import { AnimatedCard } from "../src/ui/AnimatedCard";
import { AnimatedSheetContent, SheetModal } from "../src/ui/AnimatedSheet";
import { BottomTabBar } from "../src/ui/BottomTabBar";
import {
  Field,
  PrimaryButton,
  Screen,
  SwatchTab,
} from "../src/ui/components";
import { colors, radius, shadowLg, spacing } from "../src/ui/theme";
import { centsToDollars, dollarsToCents, useMvpStore } from "../src/state/mvp";
import { useAuthStore } from "../src/state/auth";
import { formatMoney } from "../src/lib/format";
import { snapquoteApi, userFacingErrorMessage } from "../src/lib/api";

const searchThreshold = 10;

type RoomSize = "small" | "medium" | "large";

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
                    onEdit={() => setEditingItemId(item.id)}
                    onConfirm={(pricing) => {
                      void saveExistingPrice(item, {
                        name: item.name,
                        description: item.description,
                        pricing,
                      });
                    }}
                    saving={savingItemId === item.id}
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
        <SwatchTab tone="green" />
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
          </View>
        </View>
        <Text style={styles.itemPrice}>{priceAmountLabel(props.item)}</Text>
        <ChevronRight color={colors.ink3} size={16} strokeWidth={2.2} />
      </Pressable>
    </AnimatedCard>
  );
}

function StarterPriceItem(props: {
  item: PriceBookItem;
  onConfirm: (pricing: PriceBookItem["pricing"]) => void;
  onEdit: () => void;
  saving: boolean;
}) {
  const [price, setPrice] = useState(centsToDollars(basePriceCents(props.item)));
  const priceCents = price.trim().length > 0 ? dollarsToCents(price) : null;
  const canConfirm = priceCents !== null && priceCents > 0 && !props.saving;

  function confirm() {
    if (!canConfirm || priceCents === null) {
      return;
    }

    props.onConfirm(pricingWithBasePrice(props.item, priceCents));
  }

  return (
    <AnimatedCard>
      <View style={styles.starterCard}>
        <SwatchTab tone="yellow" />
        <View style={styles.starterEditor}>
          <Pressable
            accessibilityRole="button"
            onPress={props.onEdit}
            style={styles.starterTopRow}
          >
            <View style={styles.priceBody}>
              <Text style={styles.starterName} numberOfLines={1}>
                {props.item.name}
              </Text>
              <View style={styles.itemMetaRow}>
                <Text style={styles.unitBadge}>{unitBadgeLabel(props.item)}</Text>
                {props.item.pricing.type === "room_size" ? (
                  <Text style={styles.itemSub} numberOfLines={1}>
                    {roomSizeSummary(props.item.pricing)}
                  </Text>
                ) : null}
              </View>
            </View>
            <ChevronRight color={colors.ink3} size={16} strokeWidth={2.2} />
          </Pressable>

          <View style={styles.starterPriceRow}>
            <View style={styles.starterInputWrap}>
              <Text style={styles.starterCurrency}>$</Text>
              <TextInput
                accessibilityLabel={`${props.item.name} starter price`}
                editable={!props.saving}
                keyboardType="decimal-pad"
                onChangeText={setPrice}
                placeholder="0"
                placeholderTextColor={colors.amber}
                style={styles.starterInput}
                value={price}
              />
            </View>
            <Pressable
              accessibilityLabel={
                props.saving ? "Saving starter price" : "Confirm starter price"
              }
              accessibilityRole="button"
              disabled={!canConfirm}
              onPress={confirm}
              style={[
                styles.confirmButton,
                !canConfirm ? styles.confirmButtonDisabled : null,
              ]}
            >
              <Check color={colors.onDark} size={13} strokeWidth={2.5} />
            </Pressable>
          </View>
        </View>
      </View>
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
  return formatMoney(basePriceCents(item));
}

function basePriceCents(item: PriceBookItem): number {
  if (item.pricing.type === "fixed") {
    return item.pricing.unitPriceCents;
  }

  return item.pricing.prices.medium;
}

function pricingWithBasePrice(
  item: PriceBookItem,
  baseCents: number,
): PriceBookItem["pricing"] {
  if (item.pricing.type === "fixed") {
    return { type: "fixed", unitPriceCents: baseCents };
  }

  const currentMedium = item.pricing.prices.medium;

  if (currentMedium <= 0) {
    return {
      type: "room_size",
      prices: {
        small: baseCents,
        medium: baseCents,
        large: baseCents,
      },
    };
  }

  return {
    type: "room_size",
    prices: {
      small: Math.round(baseCents * (item.pricing.prices.small / currentMedium)),
      medium: baseCents,
      large: Math.round(baseCents * (item.pricing.prices.large / currentMedium)),
    },
  };
}

function roomSizeSummary(
  pricing: Extract<PriceBookItem["pricing"], { type: "room_size" }>,
): string {
  const { small, medium, large } = pricing.prices;

  if (medium <= 0) {
    return `S ${formatMoney(small)} · L ${formatMoney(large)}`;
  }

  return `S ${formatMoney(small)} · L ${formatMoney(large)}`;
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
  const [price, setPrice] = useState("");
  const [unit, setUnit] = useState<(typeof quoteUnits)[number]>("room");
  const [activeSize, setActiveSize] = useState<RoomSize>("medium");

  const trimmedName = name.trim();
  const isRoomSize = unit === "room";
  const activeCentsValue = price.trim().length > 0 ? dollarsToCents(price) : 0;
  const roomSizePrices = isRoomSize
    ? roomSizePricesFromActive(activeSize, activeCentsValue)
    : { small: 0, medium: 0, large: 0 };
  const basePriceCentsValue = isRoomSize ? roomSizePrices.medium : activeCentsValue;
  const canSave = trimmedName.length > 0 && trimmedName.length <= 60 && basePriceCentsValue > 0;

  function selectSize(size: RoomSize) {
    if (size === activeSize) {
      return;
    }

    const nextCents = roomSizePrices[size];
    setActiveSize(size);
    setPrice(nextCents > 0 ? centsToDollars(nextCents) : "");
  }

  function selectUnit(nextUnit: (typeof quoteUnits)[number]) {
    setUnit(nextUnit);
    setActiveSize("medium");
  }

  function save() {
    if (!canSave || props.saving) {
      return;
    }

    props.onSave({
      name: trimmedName,
      description: "",
      unit,
      kind: "labour",
      pricing: isRoomSize
        ? { type: "room_size", prices: roomSizePrices }
        : { type: "fixed", unitPriceCents: basePriceCentsValue },
    });
    setName("");
    setPrice("");
    setUnit("room");
    setActiveSize("medium");
  }

  return (
    <AnimatedSheetContent style={styles.addItemSheet}>
      <View style={styles.grabber} />
      <View style={styles.addSheetHeader}>
        <Text style={styles.addSheetTitle}>Add price book item</Text>
        <Pressable
          accessibilityLabel="Close add price book item"
          accessibilityRole="button"
          disabled={props.saving}
          onPress={props.onClose}
          style={styles.addSheetClose}
        >
          <X color={colors.ink2} size={16} strokeWidth={2.4} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.addSheetScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.addFieldHeader}>
          <Text style={styles.addFieldLabel}>Name</Text>
          <Text style={styles.charCount}>{trimmedName.length} / 60</Text>
        </View>
        <TextInput
          accessibilityLabel="Price book item name"
          autoCorrect={false}
          maxLength={60}
          onChangeText={setName}
          placeholder="Paint accent wall"
          placeholderTextColor={colors.ink3}
          returnKeyType="done"
          style={styles.addNameInput}
          value={name}
        />

        <Text style={styles.addFieldLabel}>Unit</Text>
        <ScrollView
          contentContainerStyle={styles.addUnitRow}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {quoteUnits.map((option) => (
            <UnitChip
              active={unit === option}
              key={option}
              label={unitChipDisplay(option)}
              onPress={() => selectUnit(option)}
            />
          ))}
        </ScrollView>

        <Text style={styles.addFieldLabel}>
          {isRoomSize ? `Price per ${activeSize} room` : `Price per ${unitChipDisplay(unit)}`}
        </Text>
        <View style={styles.addPriceInputWrap}>
          <Text style={styles.addCurrency}>$</Text>
          <TextInput
            accessibilityLabel="Price"
            keyboardType="decimal-pad"
            onChangeText={setPrice}
            placeholder="240"
            placeholderTextColor={colors.ink3}
            style={styles.addPriceInput}
            value={price}
          />
        </View>

        {isRoomSize ? (
          <RoomSizePricingCard
            activeSize={activeSize}
            onSelectSize={selectSize}
            prices={roomSizePrices}
          />
        ) : null}

        {canSave ? (
          <AddItemPreview
            isRoomSize={isRoomSize}
            name={trimmedName}
            priceCents={basePriceCentsValue}
            roomPrices={roomSizePrices}
            unit={unit}
          />
        ) : null}
      </ScrollView>

      <View style={styles.addSheetFooter}>
        <Pressable
          accessibilityRole="button"
          disabled={!canSave || props.saving}
          onPress={save}
          style={[styles.addSheetPrimary, !canSave || props.saving ? styles.addSheetPrimaryDisabled : null]}
        >
          <Text style={styles.addSheetPrimaryText}>
            {props.saving ? "Adding..." : "Add to price book"}
          </Text>
        </Pressable>
      </View>
    </AnimatedSheetContent>
  );
}

function UnitChip(props: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onPress}
      style={[styles.addUnitChip, props.active ? styles.addUnitChipActive : null]}
    >
      <Text style={[styles.addUnitChipText, props.active ? styles.addUnitChipTextActive : null]}>
        {props.label}
      </Text>
    </Pressable>
  );
}

function RoomSizePricingCard(props: {
  activeSize: RoomSize;
  onSelectSize: (size: RoomSize) => void;
  prices: { small: number; medium: number; large: number };
}) {
  return (
    <View style={styles.roomPricingCard}>
      <View style={styles.roomPricingHeader}>
        <RoomPricingMeterIcon />
        <Text style={styles.roomPricingTitle}>Room size pricing</Text>
      </View>
      <View style={styles.roomSizeRow}>
        <RoomSizePill
          active={props.activeSize === "small"}
          label="Small"
          onPress={() => props.onSelectSize("small")}
          value={props.prices.small}
        />
        <RoomSizePill
          active={props.activeSize === "medium"}
          label="Medium"
          onPress={() => props.onSelectSize("medium")}
          value={props.prices.medium}
        />
        <RoomSizePill
          active={props.activeSize === "large"}
          label="Large"
          onPress={() => props.onSelectSize("large")}
          value={props.prices.large}
        />
      </View>
      <Text style={styles.roomPricingHelp}>
        Tap any size to set it directly. Small and large follow your usual ratios until you change them.
      </Text>
    </View>
  );
}

function RoomPricingMeterIcon() {
  return (
    <View style={styles.meterIcon}>
      <View style={[styles.meterBar, styles.meterBarShort]} />
      <View style={[styles.meterBar, styles.meterBarMedium]} />
      <View style={[styles.meterBar, styles.meterBarTall]} />
    </View>
  );
}

function AddItemPreview(props: {
  isRoomSize: boolean;
  name: string;
  priceCents: number;
  roomPrices: { small: number; large: number };
  unit: (typeof quoteUnits)[number];
}) {
  return (
    <View style={styles.addPreviewSection}>
      <Text style={styles.addFieldLabel}>How it'll look in your book</Text>
      <View style={styles.addPreviewCard}>
        <SwatchTab tone="green" />
        <View style={styles.addPreviewBody}>
          <View style={styles.addPreviewText}>
            <Text numberOfLines={1} style={styles.addPreviewTitle}>
              {props.name}
            </Text>
            <View style={styles.itemMetaRow}>
              <Text style={styles.unitBadge}>
                {props.isRoomSize ? "PER ROOM" : unitBadgeFromUnit(props.unit)}
              </Text>
              {props.isRoomSize ? (
                <Text numberOfLines={1} style={styles.itemSub}>
                  S {formatMoney(props.roomPrices.small)} · L {formatMoney(props.roomPrices.large)}
                </Text>
              ) : null}
            </View>
          </View>
          <Text style={styles.addPreviewAmount}>{formatMoney(props.priceCents)}</Text>
        </View>
      </View>
    </View>
  );
}

function RoomSizePill(props: {
  active?: boolean;
  label: string;
  onPress: () => void;
  value: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onPress}
      style={[styles.roomSizePill, props.active ? styles.roomSizePillActive : null]}
    >
      <Text style={[styles.roomSizeLabel, props.active ? styles.roomSizeLabelActive : null]}>
        {props.label}
      </Text>
      <Text style={[styles.roomSizeValue, props.active ? styles.roomSizeValueActive : null]}>
        {formatMoney(props.value)}
      </Text>
    </Pressable>
  );
}

const smallRatio = 0.7;
const largeRatio = 1.6;

function roomSizePricesFromActive(
  activeSize: RoomSize,
  activeCents: number,
): { small: number; medium: number; large: number } {
  const mediumCents =
    activeSize === "medium"
      ? activeCents
      : activeSize === "small"
        ? Math.round(activeCents / smallRatio)
        : Math.round(activeCents / largeRatio);

  return {
    small: Math.round(mediumCents * smallRatio),
    medium: mediumCents,
    large: Math.round(mediumCents * largeRatio),
  };
}

function unitChipDisplay(unit: (typeof quoteUnits)[number]) {
  if (unit === "sqft") return "sq ft";
  if (unit === "lnft") return "linear ft";
  return unit;
}

function unitBadgeFromUnit(unit: (typeof quoteUnits)[number]) {
  if (unit === "each") return "EACH";
  if (unit === "hour") return "PER HOUR";
  if (unit === "day") return "PER DAY";
  if (unit === "sqft") return "PER SQ FT";
  if (unit === "lnft") return "PER LINEAR FT";
  return unit.toUpperCase();
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    gap: 12,
    padding: 20,
    paddingBottom: 148,
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
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 0,
  },
  itemCount: {
    color: colors.ink3,
    fontSize: 14,
    fontWeight: "700",
  },
  addButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  strengthCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    padding: 16,
  },
  strengthTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  strengthLabel: {
    color: colors.ink2,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.9,
    textTransform: "uppercase",
  },
  strengthCount: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800",
  },
  strengthBars: {
    flexDirection: "row",
    gap: 6,
  },
  strengthBar: {
    borderRadius: 4,
    flex: 1,
    height: 12,
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
    marginTop: 8,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  sectionLabel: {
    color: colors.ink3,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.9,
    textTransform: "uppercase",
  },
  sectionCount: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    color: colors.ink3,
    fontSize: 11,
    fontWeight: "800",
    minWidth: 23,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 2,
    textAlign: "center",
  },
  sectionCards: {
    gap: 8,
  },
  priceCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 76,
    overflow: "hidden",
    paddingRight: 14,
  },
  starterCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.amberBorder,
    borderRadius: 18,
    borderStyle: "dashed",
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 106,
    overflow: "hidden",
  },
  priceBody: {
    flex: 1,
    gap: 6,
    minWidth: 0,
  },
  itemName: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "800",
  },
  starterName: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "800",
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
    borderRadius: 7,
    borderWidth: 1,
    color: colors.ink2,
    fontSize: 10,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  itemSub: {
    color: colors.ink3,
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "700",
  },
  itemPrice: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: "800",
    textAlign: "right",
  },
  starterEditor: {
    flex: 1,
    gap: 8,
    minWidth: 0,
    paddingBottom: 10,
    paddingRight: 14,
    paddingTop: 10,
  },
  starterTopRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  starterPriceRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  starterInputWrap: {
    alignItems: "center",
    borderColor: colors.amberBorder,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    minHeight: 40,
    paddingHorizontal: 14,
  },
  starterCurrency: {
    color: colors.amber,
    fontSize: 16,
    fontWeight: "800",
    marginRight: 8,
  },
  starterInput: {
    color: colors.amber,
    flex: 1,
    fontSize: 18,
    fontWeight: "800",
    paddingVertical: 0,
  },
  confirmButton: {
    alignItems: "center",
    backgroundColor: colors.amber,
    borderRadius: 10,
    height: 40,
    justifyContent: "center",
    width: 52,
  },
  confirmButtonDisabled: {
    opacity: 0.45,
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
  addItemSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "88%",
    overflow: "hidden",
    paddingTop: 10,
  },
  addSheetScroll: {
    gap: 15,
    paddingBottom: 18,
    paddingHorizontal: 20,
    paddingTop: 2,
  },
  addSheetHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  addSheetTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 0,
  },
  addSheetClose: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  addFieldHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  addFieldLabel: {
    color: colors.ink3,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.9,
    textTransform: "uppercase",
  },
  charCount: {
    color: colors.ink3,
    fontSize: 12,
    fontWeight: "700",
  },
  addNameInput: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 13,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 17,
    fontWeight: "600",
    height: 46,
    paddingHorizontal: 16,
    paddingVertical: 0,
  },
  addUnitRow: {
    gap: 8,
    paddingRight: 28,
  },
  addUnitChip: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    height: 46,
    justifyContent: "center",
    minWidth: 84,
    paddingHorizontal: 16,
  },
  addUnitChipActive: {
    backgroundColor: colors.dark,
    borderColor: colors.dark,
  },
  addUnitChipText: {
    color: colors.ink2,
    fontSize: 17,
    fontWeight: "800",
  },
  addUnitChipTextActive: {
    color: colors.onDark,
  },
  addPriceInputWrap: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 13,
    borderWidth: 1,
    flexDirection: "row",
    height: 46,
    paddingHorizontal: 16,
  },
  addCurrency: {
    color: colors.ink3,
    fontSize: 18,
    fontWeight: "800",
    marginRight: 8,
  },
  addPriceInput: {
    color: colors.ink,
    flex: 1,
    fontSize: 20,
    fontWeight: "800",
    paddingVertical: 0,
  },
  roomPricingCard: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 15,
    borderWidth: 1,
    gap: 13,
    padding: 14,
  },
  roomPricingHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  roomPricingTitle: {
    color: colors.ink2,
    fontSize: 13,
    fontWeight: "700",
  },
  meterIcon: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: 2,
    height: 12,
  },
  meterBar: {
    backgroundColor: colors.ink3,
    borderRadius: 1,
    width: 2.5,
  },
  meterBarShort: {
    height: 5,
  },
  meterBarMedium: {
    height: 8,
  },
  meterBarTall: {
    height: 12,
  },
  roomSizeRow: {
    flexDirection: "row",
    gap: 9,
  },
  roomSizePill: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 11,
    borderWidth: 1,
    flex: 1,
    gap: 3,
    minHeight: 52,
    justifyContent: "center",
    paddingVertical: 8,
  },
  roomSizePillActive: {
    backgroundColor: colors.dark,
    borderColor: colors.dark,
  },
  roomSizeLabel: {
    color: colors.ink3,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  roomSizeLabelActive: {
    color: "rgba(255,255,255,0.72)",
  },
  roomSizeValue: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800",
  },
  roomSizeValueActive: {
    color: colors.onDark,
  },
  roomPricingHelp: {
    color: colors.ink3,
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 16,
  },
  addPreviewSection: {
    gap: 8,
  },
  addPreviewCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 74,
    overflow: "hidden",
  },
  addPreviewBody: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    paddingHorizontal: 12,
  },
  addPreviewText: {
    flex: 1,
    gap: 6,
    minWidth: 0,
  },
  addPreviewTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "800",
  },
  addPreviewAmount: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: "800",
  },
  addSheetFooter: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  addSheetPrimary: {
    alignItems: "center",
    backgroundColor: colors.dark,
    borderRadius: 14,
    height: 56,
    justifyContent: "center",
  },
  addSheetPrimaryDisabled: {
    opacity: 0.45,
  },
  addSheetPrimaryText: {
    color: colors.onDark,
    fontSize: 18,
    fontWeight: "900",
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
