import { useState } from "react";
import {
  Archive,
  BookOpen,
  Check,
  ChevronRight,
  Lock,
  Plus,
  X,
} from "lucide-react-native";
import { router } from "expo-router";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import {
  quoteUnits,
  type PriceBookItem,
} from "@snapquote/shared";
import { AnimatedSheetContent, SheetModal } from "../../shared-ui/AnimatedSheet";
import { BottomTabBar } from "../../shared-ui/BottomTabBar";
import {
  Screen,
  SwatchTab,
} from "../../shared-ui/base";
import { SectionHeader } from "../../shared-ui/layout";
import { AppText } from "../../shared-ui/text";
import { colors, fontStyles, radius, shadowLg, spacing, typography } from "../../shared-ui/theme";
import { centsToDollars, dollarsToCents, useQuoteStore } from "../../state/quoteStore";
import { useAuthStore } from "../../state/authStore";
import { formatMoney } from "../../utils/format";
import { snapquoteApi, userFacingErrorMessage } from "../../api/client";

type RoomSize = "small" | "medium" | "large";

export default function PriceBookScreen() {
  const priceBookItems = useQuoteStore((state) => state.priceBookItems);
  const authStatus = useAuthStore((state) => state.status);
  const addPriceBookItem = useQuoteStore((state) => state.addPriceBookItem);
  const confirmPriceBookItem = useQuoteStore(
    (state) => state.confirmPriceBookItem,
  );
  const updatePriceBookItem = useQuoteStore((state) => state.updatePriceBookItem);
  const archivePriceBookItem = useQuoteStore(
    (state) => state.archivePriceBookItem,
  );
  const upsertPriceBookItem = useQuoteStore((state) => state.upsertPriceBookItem);

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [archivingItemId, setArchivingItemId] = useState<string | null>(null);
  const [savingNewItem, setSavingNewItem] = useState(false);

  const active = priceBookItems.filter((item) => item.confirmedAt !== null);
  const inactive = priceBookItems.filter((item) => item.confirmedAt === null);
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
      unit: PriceBookItem["unit"];
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
              <View style={styles.headerStatus}>
                <View
                  style={[
                    styles.headerStatusDot,
                    starterCount > 0 ? styles.headerStatusDotReview : null,
                  ]}
                />
                <AppText style={styles.headerStatusText} variant="headerSummary">
                  {priceBookHeaderSummary({
                    confirmedCount,
                    starterCount,
                    totalCount: priceBookItems.length,
                  })}
                </AppText>
              </View>
              <View style={styles.headerActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setShowAddModal(true)}
                  style={styles.iconButton}
                >
                  <Plus color={colors.ink} size={18} strokeWidth={2.3} />
                </Pressable>
              </View>
            </View>

            <BookStrengthCard
              confirmedCount={confirmedCount}
              starterCount={starterCount}
              totalCount={priceBookItems.length}
            />

            {!hasConfirmedPrices ? (
              <ZeroRealPricesCard
                onAddManual={() => setShowAddModal(true)}
                onStarterSetup={() => router.push("/onboarding")}
              />
            ) : null}

            {active.length > 0 ? (
              <PriceBookSection
                count={active.length}
                label="Active — matches green"
              >
                {active.map((item, index) => (
                  <ActivePriceItem
                    key={item.id}
                    item={item}
                    isLast={index === active.length - 1}
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
                {inactive.map((item, index) => (
                  <StarterPriceItem
                    key={item.id}
                    item={item}
                    isLast={index === inactive.length - 1}
                    onEdit={() => setEditingItemId(item.id)}
                    onConfirm={(pricing) => {
                      void saveExistingPrice(item, {
                        name: item.name,
                        description: item.description,
                        unit: item.unit,
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
            <View style={styles.headerStatus}>
              <View style={[styles.headerStatusDot, styles.headerStatusDotEmpty]} />
              <AppText style={styles.headerStatusText} variant="headerSummary">
                {priceBookHeaderSummary({
                  confirmedCount: 0,
                  starterCount: 0,
                  totalCount: 0,
                })}
              </AppText>
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
            key={editingItem.id}
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
        <AppText style={styles.strengthLabel} variant="sectionLabel">
          Book strength
        </AppText>
        <AppText style={styles.strengthCount} variant="rowTitle">
          {props.confirmedCount} of {props.totalCount} confirmed
        </AppText>
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

      <AppText style={styles.emptyHeadline} variant="rowTitle">
        Build your price book
      </AppText>
      <AppText style={styles.emptyCopy} variant="body">
        This is where your prices live. QuoteVan drafts the scope of a job, but
        pulls every dollar from here — so it never guesses or uses market-rate estimates.
      </AppText>

      <Pressable
        accessibilityRole="button"
        onPress={props.onStarterSetup}
        style={styles.emptyPrimary}
      >
        <Plus color={colors.onDark} size={16} strokeWidth={2.8} />
        <AppText style={styles.emptyPrimaryText} tone="onDark" variant="button">
          Set up starter prices
        </AppText>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        hitSlop={10}
        onPress={props.onAddManual}
      >
        <AppText style={styles.manualLink} variant="button">
          Or add an item manually
        </AppText>
      </Pressable>

      <View style={styles.emptyLock}>
        <Lock color={colors.ink3} size={11} />
        <AppText style={styles.emptyLockText} variant="meta">
          Prices come only from your book or you
        </AppText>
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
        <AppText style={styles.zeroRealTitle} variant="rowTitle">
          No confirmed prices yet
        </AppText>
        <AppText style={styles.zeroRealText} variant="body">
          Starter prices are editable defaults, not market rates. Confirm or
          edit them before they match green on quotes.
        </AppText>
      </View>
      <View style={styles.zeroRealActions}>
        <Pressable
          accessibilityRole="button"
          onPress={props.onStarterSetup}
          style={styles.zeroRealPrimary}
        >
          <AppText style={styles.zeroRealPrimaryText} tone="onDark" variant="button">
            Setup
          </AppText>
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
      <SectionHeader count={props.count} label={props.label} />
      <View style={styles.sectionCards}>{props.children}</View>
    </View>
  );
}

function ActivePriceItem(props: {
  item: PriceBookItem;
  isLast: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onPress}
      style={[styles.priceRow, !props.isLast ? styles.groupRowDivider : null]}
    >
      <View style={[styles.rowStripe, { backgroundColor: colors.green }]} />
      <View style={styles.priceBody}>
        <AppText style={styles.itemName} numberOfLines={1} variant="rowTitle">
          {props.item.name}
        </AppText>
        <AppText style={styles.itemSub} numberOfLines={1} variant="rowSubtitle">
          {itemMetaSummary(props.item)}
        </AppText>
      </View>
      <AppText style={styles.itemPrice} variant="amount">
        {priceAmountLabel(props.item)}
      </AppText>
      <ChevronRight color={colors.ink3} size={15} strokeWidth={2.2} />
    </Pressable>
  );
}

function StarterPriceItem(props: {
  item: PriceBookItem;
  isLast: boolean;
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
    <View
      style={[
        styles.starterRow,
        !props.isLast ? styles.groupRowDivider : null,
      ]}
    >
      <View style={[styles.rowStripe, { backgroundColor: colors.amber }]} />
      <Pressable
        accessibilityRole="button"
        onPress={props.onEdit}
        style={styles.priceBody}
      >
        <AppText style={styles.itemName} numberOfLines={1} variant="rowTitle">
          {props.item.name}
        </AppText>
        <AppText style={styles.itemSub} numberOfLines={1} variant="rowSubtitle">
          {itemMetaSummary(props.item)}
        </AppText>
      </Pressable>
      <View style={styles.starterPriceInline}>
        <AppText style={styles.starterCurrency} tone="amber" variant="amount">
          $
        </AppText>
        <TextInput
          accessibilityLabel={`${props.item.name} starter price`}
          editable={!props.saving}
          keyboardType="decimal-pad"
          onChangeText={setPrice}
          placeholder="0"
          placeholderTextColor={colors.amber}
          style={styles.starterInlineInput}
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
        <Check color={colors.onDark} size={14} strokeWidth={2.5} />
      </Pressable>
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

function itemMetaSummary(item: PriceBookItem): string {
  if (item.pricing.type === "room_size") {
    return `${unitDisplayLabel(item)} · ${roomSizeSummary(item.pricing)}`;
  }

  return unitDisplayLabel(item);
}

function unitDisplayLabel(item: PriceBookItem): string {
  if (item.pricing.type === "room_size") {
    return "Per room";
  }

  if (item.unit === "each") {
    return "Each";
  }

  if (item.unit === "hour") {
    return "Per hour";
  }

  if (item.unit === "sqft") {
    return "Per sq ft";
  }

  if (item.unit === "lnft") {
    return "Per linear ft";
  }

  return item.unit.charAt(0).toUpperCase() + item.unit.slice(1);
}

function PriceItemModal(props: {
  item: PriceBookItem;
  archiving: boolean;
  onArchive: () => void;
  onClose: () => void;
  onSave: (input: {
    name: string;
    description: string;
    unit: PriceBookItem["unit"];
    pricing: PriceBookItem["pricing"];
  }) => void;
  saving: boolean;
}) {
  const { item } = props;
  const pricing = item.pricing;
  const initialMediumCents = pricing.type === "room_size" ? pricing.prices.medium : pricing.unitPriceCents;
  const initialRoomPrices =
    pricing.type === "room_size" ? pricing.prices : roomSizePricesFromActive("medium", initialMediumCents);
  const [name, setName] = useState(() => shortPriceItemLabel(item));
  const [description, setDescription] = useState(() => {
    const trimmedDescription = item.description.trim();
    return trimmedDescription.length > 0 ? item.description : item.name;
  });
  const [unit, setUnit] = useState<(typeof quoteUnits)[number]>(item.unit);
  const [activeSize, setActiveSize] = useState<RoomSize>("medium");
  const [small, setSmall] = useState(centsToDollars(initialRoomPrices.small));
  const [medium, setMedium] = useState(centsToDollars(initialRoomPrices.medium));
  const [large, setLarge] = useState(centsToDollars(initialRoomPrices.large));
  const trimmedName = name.trim();
  const isRoomSize = unit === "room";
  const activePrice = isRoomSize
    ? activeSize === "small"
      ? small
      : activeSize === "large"
        ? large
        : medium
    : medium;
  const roomPrices = {
    small: dollarsToCents(small),
    medium: dollarsToCents(medium),
    large: dollarsToCents(large),
  };
  const primaryLabel = props.saving ? (props.archiving ? "Archiving..." : "Saving...") : "Save changes";
  const canSave =
    trimmedName.length > 0 &&
    trimmedName.length <= editItemNameMaxLength &&
    (isRoomSize
      ? small.trim().length > 0 && medium.trim().length > 0 && large.trim().length > 0
      : medium.trim().length > 0);

  function selectUnit(nextUnit: (typeof quoteUnits)[number]) {
    if (nextUnit === unit) {
      return;
    }

    if (nextUnit === "room") {
      const nextRoomPrices = roomSizePricesFromActive("medium", dollarsToCents(medium));
      setSmall(centsToDollars(nextRoomPrices.small));
      setMedium(centsToDollars(nextRoomPrices.medium));
      setLarge(centsToDollars(nextRoomPrices.large));
      setActiveSize("medium");
    }

    setUnit(nextUnit);
  }

  function updateActivePrice(value: string) {
    if (!isRoomSize) {
      setMedium(value);
      return;
    }

    if (activeSize === "small") {
      setSmall(value);
      return;
    }

    if (activeSize === "large") {
      setLarge(value);
      return;
    }

    setMedium(value);
  }

  function selectSize(size: RoomSize) {
    setActiveSize(size);
  }

  function save() {
    if (!canSave || props.saving) {
      return;
    }

    if (isRoomSize) {
      props.onSave({
        name: trimmedName,
        description: description.trim(),
        unit,
        pricing: {
          type: "room_size",
          prices: roomPrices,
        },
      });
      return;
    }

    props.onSave({
      name: trimmedName,
      description: description.trim(),
      unit,
      pricing: { type: "fixed", unitPriceCents: dollarsToCents(medium) },
    });
  }

  return (
    <AnimatedSheetContent style={styles.editSheet}>
      <View style={styles.grabber} />

      <ScrollView contentContainerStyle={styles.editSheetScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.editHeader}>
          <AppText style={styles.editSheetTitle} variant="panelTitle">
            Edit price
          </AppText>
          <AppText style={styles.editSheetSubtitle} variant="body">
            Keep the name and price current so it auto-matches on future quotes.
          </AppText>
        </View>

        <View style={styles.editSection}>
          <View style={styles.editFieldHeader}>
            <AppText style={styles.editFieldLabel} variant="sectionLabel">
              Item name
            </AppText>
            <AppText style={styles.editCharCount} variant="meta">
              {trimmedName.length} / {editItemNameMaxLength}
            </AppText>
          </View>
          <TextInput
            accessibilityLabel="Price book item name"
            autoCorrect={false}
            maxLength={editItemNameMaxLength}
            onChangeText={setName}
            placeholder="Surface prep"
            placeholderTextColor={colors.ink3}
            returnKeyType="done"
            style={styles.editNameInput}
            value={name}
          />
        </View>

        <View style={styles.editSection}>
          <AppText style={styles.editFieldLabel} variant="sectionLabel">
            Unit
          </AppText>
          <View style={styles.editUnitRowWrap}>
            <ScrollView contentContainerStyle={styles.editUnitRow} horizontal showsHorizontalScrollIndicator={false}>
              {quoteUnits.map((option) => (
                <EditUnitChip
                  active={unit === option}
                  key={option}
                  label={unitChipDisplay(option)}
                  onPress={() => selectUnit(option)}
                />
              ))}
            </ScrollView>
            <View pointerEvents="none" style={styles.editUnitScrollHint}>
              <ChevronRight color={colors.ink3} size={14} strokeWidth={2.4} />
            </View>
          </View>

          <AppText style={styles.editFieldLabel} variant="sectionLabel">
            {priceInputLabel(unit, activeSize)}
          </AppText>
          <View style={styles.editPriceInputWrap}>
            <AppText style={styles.editCurrency} variant="rowSubtitle">
              $
            </AppText>
            <TextInput
              accessibilityLabel="Price"
              keyboardType="decimal-pad"
              onChangeText={updateActivePrice}
              placeholder="300"
              placeholderTextColor={colors.ink3}
              style={styles.editPriceInput}
              value={activePrice}
            />
          </View>

          {isRoomSize ? (
            <RoomSizePricingCard
              activeSize={activeSize}
              onSelectSize={selectSize}
              prices={roomPrices}
            />
          ) : null}
        </View>

        <View style={styles.editSection}>
          <View style={styles.editDescriptionHeader}>
            <AppText style={styles.editFieldLabel} variant="sectionLabel">
              Description
            </AppText>
            <AppText style={styles.editDescriptionHint} variant="meta">
              optional · shown on quote
            </AppText>
          </View>
          <TextInput
            accessibilityLabel="Price book item description"
            multiline
            onChangeText={setDescription}
            placeholder="Clean, sand, and patch minor imperfections before painting."
            placeholderTextColor={colors.ink3}
            style={styles.editDescriptionInput}
            value={description}
          />
        </View>
      </ScrollView>

      <View style={styles.editFooter}>
        <Pressable
          accessibilityRole="button"
          disabled={!canSave || props.saving}
          onPress={save}
          style={[styles.editPrimary, !canSave || props.saving ? styles.editPrimaryDisabled : null]}
        >
          <AppText style={styles.editPrimaryText} tone="onDark" variant="primaryAction">
            {primaryLabel}
          </AppText>
        </Pressable>
        <View style={styles.editFooterSecondary}>
          <Pressable
            accessibilityRole="button"
            disabled={props.saving}
            onPress={props.onArchive}
            style={styles.archiveTextButton}
          >
            <Archive color={colors.red} size={14} strokeWidth={2.4} />
            <AppText style={styles.archiveLinkText} tone="red" variant="button">
              Archive item
            </AppText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={props.saving}
            onPress={props.onClose}
            style={styles.cancelTextButton}
          >
            <AppText style={styles.cancelLinkText} variant="button">
              Cancel
            </AppText>
          </Pressable>
        </View>
      </View>
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
        <AppText style={styles.addSheetTitle} variant="panelTitle">
          Add price book item
        </AppText>
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
          <AppText style={styles.addFieldLabel} variant="sectionLabel">
            Name
          </AppText>
          <AppText style={styles.charCount} variant="meta">
            {trimmedName.length} / 60
          </AppText>
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

        <AppText style={styles.addFieldLabel} variant="sectionLabel">
          Unit
        </AppText>
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

        <AppText style={styles.addFieldLabel} variant="sectionLabel">
          {isRoomSize ? `Price per ${activeSize} room` : `Price per ${unitChipDisplay(unit)}`}
        </AppText>
        <View style={styles.addPriceInputWrap}>
          <AppText style={styles.addCurrency} variant="rowSubtitle">
            $
          </AppText>
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
          <AppText style={styles.addSheetPrimaryText} tone="onDark" variant="primaryAction">
            {props.saving ? "Adding..." : "Add to price book"}
          </AppText>
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
      <AppText
        style={[styles.addUnitChipText, props.active ? styles.addUnitChipTextActive : null]}
        tone={props.active ? "onDark" : "secondary"}
        variant="button"
      >
        {props.label}
      </AppText>
    </Pressable>
  );
}

function EditUnitChip(props: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onPress}
      style={[styles.editUnitChip, props.active ? styles.editUnitChipActive : null]}
    >
      <AppText
        style={[styles.editUnitChipText, props.active ? styles.editUnitChipTextActive : null]}
        tone={props.active ? "onDark" : "secondary"}
        variant="button"
      >
        {props.label}
      </AppText>
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
        <AppText style={styles.roomPricingTitle} tone="secondary" variant="button">
          Room size pricing
        </AppText>
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
      <AppText style={styles.roomPricingHelp} variant="meta">
        Tap any size to set it directly. Small and large follow your usual ratios until you change them.
      </AppText>
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
      <AppText style={styles.addFieldLabel} variant="sectionLabel">
        How it'll look in your book
      </AppText>
      <View style={styles.addPreviewCard}>
        <SwatchTab tone="green" />
        <View style={styles.addPreviewBody}>
          <View style={styles.addPreviewText}>
            <AppText numberOfLines={1} style={styles.addPreviewTitle} variant="rowTitle">
              {props.name}
            </AppText>
            <View style={styles.itemMetaRow}>
              <AppText style={styles.unitBadge} variant="statusPill">
                {props.isRoomSize ? "PER ROOM" : unitBadgeFromUnit(props.unit)}
              </AppText>
              {props.isRoomSize ? (
                <AppText numberOfLines={1} style={styles.itemSub} variant="rowSubtitle">
                  S {formatMoney(props.roomPrices.small)} · L {formatMoney(props.roomPrices.large)}
                </AppText>
              ) : null}
            </View>
          </View>
          <AppText style={styles.addPreviewAmount} variant="amount">
            {formatMoney(props.priceCents)}
          </AppText>
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
      <AppText
        style={[styles.roomSizeLabel, props.active ? styles.roomSizeLabelActive : null]}
        tone={props.active ? "onDark" : "muted"}
        variant="statusPill"
      >
        {props.label}
      </AppText>
      <AppText
        style={[styles.roomSizeValue, props.active ? styles.roomSizeValueActive : null]}
        tone={props.active ? "onDark" : "primary"}
        variant="amount"
      >
        {formatMoney(props.value)}
      </AppText>
    </Pressable>
  );
}

const smallRatio = 0.7;
const largeRatio = 1.6;
const editItemNameMaxLength = 40;

function shortPriceItemLabel(item: PriceBookItem): string {
  const original = item.name.trim();

  if (original.length <= editItemNameMaxLength) {
    return original;
  }

  const haystack = `${item.name} ${item.description} ${item.key}`.toLowerCase();
  const knownLabels: Array<{ label: string; patterns: string[] }> = [
    {
      label: "Surface prep",
      patterns: [
        "surface prep",
        "surface preparation",
        "prepare surfaces",
        "patch minor",
        "sand and patch",
      ],
    },
    { label: "Paint ceilings", patterns: ["paint ceilings", "painting ceilings"] },
    { label: "Paint walls", patterns: ["paint walls", "painting walls"] },
    { label: "Paint trim", patterns: ["paint trim", "painting trim"] },
    { label: "Paint doors", patterns: ["paint doors", "painting doors", "paint 2 doors", "paint two doors"] },
    { label: "Primer coat", patterns: ["primer coat", "primer"] },
    { label: "Remove wallpaper", patterns: ["remove wallpaper", "wallpaper"] },
    { label: "Material allowance", patterns: ["material allowance", "materials"] },
  ];

  for (const entry of knownLabels) {
    if (entry.patterns.some((pattern) => haystack.includes(pattern))) {
      return entry.label;
    }
  }

  const withoutParenthetical = original.replace(/\s*\([^)]*\)/g, "").trim();
  const beforeClause =
    withoutParenthetical.split(/\s+(?:in|for|with|including|after|before|on)\s+/i)[0]?.trim() ??
    withoutParenthetical;
  const fallback = titleCaseShortLabel(beforeClause.length > 0 ? beforeClause : original);

  return truncateLabel(fallback);
}

function titleCaseShortLabel(value: string): string {
  const words = value
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .split(" ")
    .filter(Boolean);

  return words
    .map((word, index) => (index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(" ");
}

function truncateLabel(value: string): string {
  const trimmed = value.trim();

  if (trimmed.length <= editItemNameMaxLength) {
    return trimmed;
  }

  return trimmed.slice(0, editItemNameMaxLength - 1).trimEnd();
}

function priceBookHeaderSummary(props: {
  confirmedCount: number;
  starterCount: number;
  totalCount: number;
}): string {
  if (props.totalCount === 0) {
    return "No prices yet";
  }

  if (props.starterCount === 0) {
    return `${props.confirmedCount} ${props.confirmedCount === 1 ? "price" : "prices"} ready`;
  }

  return `${props.confirmedCount} ready · ${props.starterCount} to confirm`;
}

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

function priceInputLabel(unit: (typeof quoteUnits)[number], activeSize: RoomSize) {
  if (unit === "room") {
    return `Price per ${activeSize} room`;
  }

  return `Price per ${unitChipDisplay(unit)}`;
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
    gap: 11,
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
  headerStatus: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
  },
  headerStatusDot: {
    backgroundColor: colors.green,
    borderRadius: 5,
    height: 9,
    width: 9,
  },
  headerStatusDotReview: {
    backgroundColor: colors.amber,
  },
  headerStatusDotEmpty: {
    backgroundColor: colors.ink3,
  },
  headerStatusText: {
    ...typography.headerSummary,
  },
  headerActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 11,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  strengthCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: 9,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  strengthTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  strengthLabel: {
    ...typography.sectionLabel,
    letterSpacing: 1.7,
  },
  strengthCount: {
    color: colors.ink,
    fontSize: 15,
    ...fontStyles.semibold,
  },
  strengthBars: {
    flexDirection: "row",
    gap: 5,
  },
  strengthBar: {
    borderRadius: 4,
    flex: 1,
    height: 10,
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
    ...typography.sectionLabel,
    letterSpacing: 1.7,
  },
  sectionCount: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    color: colors.ink3,
    fontSize: 11,
    ...fontStyles.medium,
    minWidth: 23,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 2,
    textAlign: "center",
  },
  sectionCards: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 15,
    borderWidth: 1,
    overflow: "hidden",
  },
  priceRow: {
    alignItems: "center",
    backgroundColor: colors.surface,
    flexDirection: "row",
    gap: 8,
    minHeight: 60,
    overflow: "hidden",
    paddingLeft: 24,
    paddingRight: 12,
  },
  starterRow: {
    alignItems: "center",
    backgroundColor: colors.surface,
    flexDirection: "row",
    gap: 8,
    minHeight: 62,
    overflow: "hidden",
    paddingLeft: 24,
    paddingRight: 12,
  },
  groupRowDivider: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  rowStripe: {
    bottom: 0,
    left: 0,
    position: "absolute",
    top: 0,
    width: 5,
  },
  priceBody: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  itemName: {
    ...typography.rowTitle,
    fontSize: 15,
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
    ...fontStyles.semibold,
    overflow: "hidden",
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  itemSub: {
    ...typography.rowSubtitle,
    flexShrink: 1,
  },
  itemPrice: {
    ...typography.amount,
    fontSize: 14,
    textAlign: "right",
  },
  starterPriceInline: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "flex-end",
    minWidth: 60,
  },
  starterCurrency: {
    color: colors.amber,
    fontSize: 13,
    ...fontStyles.semibold,
    marginRight: 3,
  },
  starterInlineInput: {
    color: colors.amber,
    fontSize: 14,
    ...fontStyles.semibold,
    maxWidth: 52,
    minWidth: 30,
    paddingVertical: 0,
    textAlign: "right",
  },
  confirmButton: {
    alignItems: "center",
    backgroundColor: colors.amber,
    borderRadius: 9,
    height: 34,
    justifyContent: "center",
    width: 34,
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
    ...fontStyles.semibold,
  },
  noMatchesText: {
    color: colors.ink2,
    fontSize: 13,
    ...fontStyles.regular,
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
    fontSize: 18,
    ...fontStyles.semibold,
    marginBottom: 9,
    textAlign: "center",
  },
  emptyCopy: {
    color: colors.ink2,
    fontSize: 13,
    ...fontStyles.regular,
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
    ...fontStyles.semibold,
  },
  manualLink: {
    color: colors.ink2,
    fontSize: 13,
    ...fontStyles.semibold,
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
    ...fontStyles.medium,
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
    ...fontStyles.semibold,
  },
  zeroRealText: {
    color: colors.ink2,
    fontSize: 12,
    ...fontStyles.regular,
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
    ...fontStyles.semibold,
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
    gap: 14,
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
    ...typography.panelTitle,
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
    ...typography.sectionLabel,
    fontSize: 11,
    letterSpacing: 1.45,
  },
  charCount: {
    color: colors.ink3,
    fontSize: 11,
    ...fontStyles.medium,
  },
  addNameInput: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 13,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    ...fontStyles.regular,
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
    height: 42,
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
    fontSize: 13,
    ...fontStyles.medium,
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
    fontSize: 16,
    ...fontStyles.medium,
    marginRight: 8,
  },
  addPriceInput: {
    color: colors.ink,
    flex: 1,
    fontSize: 17,
    ...fontStyles.semibold,
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
    ...fontStyles.medium,
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
    ...fontStyles.medium,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  roomSizeLabelActive: {
    color: "rgba(255,255,255,0.72)",
  },
  roomSizeValue: {
    color: colors.ink,
    fontSize: 15,
    ...fontStyles.semibold,
  },
  roomSizeValueActive: {
    color: colors.onDark,
  },
  roomPricingHelp: {
    color: colors.ink3,
    fontSize: 12,
    ...fontStyles.regular,
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
    ...typography.rowTitle,
  },
  addPreviewAmount: {
    ...typography.amount,
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
    height: 52,
    justifyContent: "center",
  },
  addSheetPrimaryDisabled: {
    opacity: 0.45,
  },
  addSheetPrimaryText: {
    ...typography.primaryAction,
  },
  modalBackdrop: {
    backgroundColor: "rgba(18,22,28,0.35)",
    flex: 1,
    justifyContent: "flex-end",
  },
  editSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "88%",
    overflow: "hidden",
    paddingTop: 10,
  },
  grabber: {
    alignSelf: "center",
    backgroundColor: colors.border,
    borderRadius: 999,
    height: 4,
    marginBottom: spacing.xs,
    width: 38,
  },
  editSheetScroll: {
    gap: 18,
    paddingBottom: 18,
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  editHeader: {
    gap: 4,
  },
  editSection: {
    gap: 10,
  },
  editSheetTitle: {
    ...typography.panelTitle,
  },
  editSheetSubtitle: {
    color: colors.ink2,
    fontSize: 13,
    ...fontStyles.regular,
    lineHeight: 17,
  },
  editFieldHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  editFieldLabel: {
    ...typography.sectionLabel,
    fontSize: 11,
    letterSpacing: 1.45,
  },
  editCharCount: {
    color: colors.ink3,
    fontSize: 11,
    ...fontStyles.medium,
  },
  editNameInput: {
    backgroundColor: colors.surface,
    borderColor: colors.dark,
    borderRadius: 13,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    ...fontStyles.regular,
    height: 48,
    paddingHorizontal: 16,
    paddingVertical: 0,
  },
  editUnitRowWrap: {
    position: "relative",
  },
  editUnitRow: {
    gap: 8,
    paddingRight: 24,
  },
  editUnitScrollHint: {
    alignItems: "center",
    backgroundColor: colors.surface,
    bottom: 0,
    justifyContent: "center",
    position: "absolute",
    right: 0,
    top: 0,
    width: 26,
  },
  editUnitChip: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 11,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    minWidth: 72,
    paddingHorizontal: 14,
  },
  editUnitChipActive: {
    backgroundColor: colors.dark,
    borderColor: colors.dark,
  },
  editUnitChipText: {
    color: colors.ink2,
    fontSize: 13,
    ...fontStyles.medium,
  },
  editUnitChipTextActive: {
    color: colors.onDark,
  },
  editPriceInputWrap: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 13,
    borderWidth: 1,
    flexDirection: "row",
    height: 48,
    paddingHorizontal: 16,
  },
  editCurrency: {
    color: colors.ink3,
    fontSize: 16,
    ...fontStyles.medium,
    marginRight: 8,
  },
  editPriceInput: {
    color: colors.ink,
    flex: 1,
    fontSize: 17,
    ...fontStyles.semibold,
    paddingVertical: 0,
  },
  editDescriptionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  editDescriptionHint: {
    color: colors.ink3,
    fontSize: 11,
    ...fontStyles.regular,
  },
  editDescriptionInput: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 13,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 15,
    ...fontStyles.regular,
    lineHeight: 21,
    minHeight: 82,
    paddingHorizontal: 16,
    paddingTop: 14,
    textAlignVertical: "top",
  },
  editFooter: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: 16,
    paddingBottom: 16,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  editPrimary: {
    alignItems: "center",
    backgroundColor: colors.dark,
    borderRadius: 14,
    height: 52,
    justifyContent: "center",
  },
  editPrimaryDisabled: {
    opacity: 0.45,
  },
  editPrimaryText: {
    ...typography.primaryAction,
  },
  editFooterSecondary: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  cancelTextButton: {
    paddingVertical: 2,
  },
  cancelLinkText: {
    color: colors.ink3,
    fontSize: 14,
    ...fontStyles.medium,
  },
  archiveTextButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
    paddingVertical: 2,
  },
  archiveLinkText: {
    color: colors.red,
    fontSize: 14,
    ...fontStyles.medium,
  },
});
