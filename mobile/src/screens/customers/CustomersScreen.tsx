import { useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { router, useFocusEffect } from "expo-router";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from "react-native";
import { ChevronRight, Merge, Plus, Search, Trash2, Users, X } from "lucide-react-native";
import { deriveCustomerCity, deriveJobLabel, type Customer } from "@snapquote/shared";
import { AnimatedSheetContent, SheetModal } from "../../shared-ui/AnimatedSheet";
import { BottomTabBar } from "../../shared-ui/BottomTabBar";
import { Screen } from "../../shared-ui/base";
import { AppText } from "../../shared-ui/text";
import { colors, fontStyles, radius, shadowLg, typography } from "../../shared-ui/theme";
import { useAuthStore } from "../../state/authStore";
import { snapquoteApi, userFacingErrorMessage, type CreateCustomerInput } from "../../api/client";
import {
  getQuoteStatus,
  useQuoteStore,
  type CustomerFormInput,
  type QuoteRecord,
} from "../../state/quoteStore";
import { initials } from "../../utils/format";

type CustomerStats = {
  quoteCount: number;
  activeQuoteCount: number;
  latestQuote: QuoteRecord | null;
};

const emptyStats: CustomerStats = {
  quoteCount: 0,
  activeQuoteCount: 0,
  latestQuote: null,
};

const CUSTOMER_ROW_HEIGHT_ESTIMATE = 76;
const DUPLICATE_ROW_HEIGHT_ESTIMATE = 62;
const CUSTOMER_SCREEN_FIXED_HEIGHT_ESTIMATE = 284;

export default function CustomersScreen() {
  const { height: screenHeight } = useWindowDimensions();
  const customers = useQuoteStore((state) => state.customers);
  const quotes = useQuoteStore((state) => state.quotes);
  const events = useQuoteStore((state) => state.events);
  const addCustomer = useQuoteStore((state) => state.addCustomer);
  const updateLocalCustomer = useQuoteStore((state) => state.updateCustomer);
  const removeLocalCustomer = useQuoteStore((state) => state.removeCustomer);
  const mergeLocalCustomers = useQuoteStore((state) => state.mergeCustomers);
  const upsertCustomer = useQuoteStore((state) => state.upsertCustomer);
  const upsertRemoteQuote = useQuoteStore((state) => state.upsertRemoteQuote);
  const authStatus = useAuthStore((state) => state.status);

  const [query, setQuery] = useState("");
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [mergeSourceId, setMergeSourceId] = useState<string | null>(null);
  const [duplicateGroup, setDuplicateGroup] = useState<Customer[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [mergingId, setMergingId] = useState<string | null>(null);

  const statsByCustomerId = useMemo(() => customerStats(customers, quotes, events), [customers, quotes, events]);
  const sortedCustomers = useMemo(() => sortCustomers(customers, statsByCustomerId), [customers, statsByCustomerId]);
  const trimmedQuery = query.trim();
  const hasSearchQuery = trimmedQuery.length > 0;
  const filteredCustomers = useMemo(
    () => sortedCustomers.filter((customer) => matchesCustomerSearch(customer, query)),
    [query, sortedCustomers],
  );
  const duplicateGroups = useMemo(() => possibleDuplicateGroups(sortedCustomers), [sortedCustomers]);
  const visibleListHeightEstimate =
    sortedCustomers.length * CUSTOMER_ROW_HEIGHT_ESTIMATE +
    (!hasSearchQuery ? duplicateGroups.length * DUPLICATE_ROW_HEIGHT_ESTIMATE : 0);
  const availableListHeightEstimate = Math.max(
    CUSTOMER_ROW_HEIGHT_ESTIMATE * 3,
    screenHeight - CUSTOMER_SCREEN_FIXED_HEIGHT_ESTIMATE,
  );
  const shouldShowCustomerSearch =
    customers.length > 0 && (hasSearchQuery || visibleListHeightEstimate > availableListHeightEstimate);
  const editingCustomer = editingCustomerId !== null
    ? customers.find((customer) => customer.id === editingCustomerId) ?? null
    : null;
  const mergeSource = mergeSourceId !== null
    ? customers.find((customer) => customer.id === mergeSourceId) ?? null
    : null;

  const refreshCustomers = useCallback(async () => {
    if (authStatus !== "signed_in") {
      return;
    }

    setRefreshing(true);

    try {
      const [customerResponse, quoteResponse] = await Promise.all([
        snapquoteApi.listCustomers(),
        snapquoteApi.listQuotes(),
      ]);

      for (const customer of customerResponse.customers) {
        upsertCustomer(customer);
      }

      for (const quote of quoteResponse.quotes) {
        upsertRemoteQuote(quote);
      }
    } catch (error) {
      console.warn("QuoteVan customer refresh skipped", error);
    } finally {
      setRefreshing(false);
    }
  }, [authStatus, upsertCustomer, upsertRemoteQuote]);

  useFocusEffect(
    useCallback(() => {
      void refreshCustomers();
    }, [refreshCustomers]),
  );

  async function saveNewCustomer(input: CustomerFormInput) {
    if (savingId !== null) {
      return;
    }

    setSavingId("new");

    try {
      if (authStatus !== "signed_in") {
        addCustomer(input);
        setShowAddSheet(false);
        return;
      }

      const created = await snapquoteApi.createCustomer(apiCustomerInput(input));
      upsertCustomer(created);
      setShowAddSheet(false);
    } catch (error) {
      Alert.alert("Could not add customer", userFacingErrorMessage(error));
    } finally {
      setSavingId(null);
    }
  }

  async function saveExistingCustomer(customer: Customer, input: CustomerFormInput) {
    if (savingId !== null) {
      return;
    }

    setSavingId(customer.id);

    try {
      if (authStatus !== "signed_in" || isLocalCustomer(customer)) {
        updateLocalCustomer(customer.id, input);
        setEditingCustomerId(null);
        return;
      }

      const updated = await snapquoteApi.updateCustomer(customer.id, apiCustomerInput(input));
      upsertCustomer(updated);
      setEditingCustomerId(null);
    } catch (error) {
      Alert.alert("Could not save customer", userFacingErrorMessage(error));
    } finally {
      setSavingId(null);
    }
  }

  function confirmDeleteCustomer(customer: Customer) {
    const stats = statsByCustomerId.get(customer.id) ?? emptyStats;

    if (stats.quoteCount > 0) {
      Alert.alert("Customer has quotes", "Merge this customer into another record before deleting.");
      return;
    }

    Alert.alert("Delete customer?", `${customer.name} has no quotes linked.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => void deleteCustomer(customer),
      },
    ]);
  }

  async function deleteCustomer(customer: Customer) {
    if (deletingId !== null) {
      return;
    }

    setDeletingId(customer.id);

    try {
      if (authStatus === "signed_in" && !isLocalCustomer(customer)) {
        await snapquoteApi.deleteCustomer(customer.id);
      }

      removeLocalCustomer(customer.id);
      setEditingCustomerId(null);
    } catch (error) {
      Alert.alert("Could not delete customer", userFacingErrorMessage(error));
    } finally {
      setDeletingId(null);
    }
  }

  function confirmMerge(source: Customer, target: Customer) {
    const stats = statsByCustomerId.get(source.id) ?? emptyStats;

    Alert.alert(
      "Merge customers?",
      `${stats.quoteCount} ${stats.quoteCount === 1 ? "quote" : "quotes"} will move from ${source.name} to ${target.name}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Merge",
          style: "destructive",
          onPress: () => void mergeCustomer(source, target),
        },
      ],
    );
  }

  async function mergeCustomer(source: Customer, target: Customer) {
    if (mergingId !== null) {
      return;
    }

    setMergingId(source.id);

    try {
      await performMergeCustomer(source, target);
      setMergeSourceId(null);
      setEditingCustomerId(null);
      setDuplicateGroup(null);
    } catch (error) {
      Alert.alert("Could not merge customers", userFacingErrorMessage(error));
    } finally {
      setMergingId(null);
    }
  }

  function confirmMergeDuplicateGroup(target: Customer, group: Customer[]) {
    const sources = group.filter((customer) => customer.id !== target.id);
    const hasRemoteIntoLocal = authStatus === "signed_in" && isLocalCustomer(target) && sources.some((source) => !isLocalCustomer(source));

    if (hasRemoteIntoLocal) {
      Alert.alert("Choose a synced customer", "A synced customer cannot be merged into a local-only customer.");
      return;
    }

    const quoteCount = sources.reduce((total, source) => total + (statsByCustomerId.get(source.id)?.quoteCount ?? 0), 0);

    Alert.alert(
      "Merge duplicate group?",
      `${sources.length} ${sources.length === 1 ? "record" : "records"} and ${quoteCount} ${quoteCount === 1 ? "quote" : "quotes"} will move into ${target.name}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Merge",
          style: "destructive",
          onPress: () => void mergeDuplicateGroup(sources, target),
        },
      ],
    );
  }

  async function mergeDuplicateGroup(sources: Customer[], target: Customer) {
    if (mergingId !== null) {
      return;
    }

    setMergingId(target.id);

    try {
      for (const source of sources) {
        await performMergeCustomer(source, target);
      }

      setDuplicateGroup(null);
    } catch (error) {
      Alert.alert("Could not merge customers", userFacingErrorMessage(error));
    } finally {
      setMergingId(null);
    }
  }

  async function performMergeCustomer(source: Customer, target: Customer) {
    if (authStatus === "signed_in" && !isLocalCustomer(source) && isLocalCustomer(target)) {
      throw new Error("A synced customer cannot be merged into a local-only customer.");
    }

    if (authStatus === "signed_in" && !isLocalCustomer(source) && !isLocalCustomer(target)) {
      const result = await snapquoteApi.mergeCustomer(source.id, target.id);
      upsertCustomer(result.targetCustomer);
    }

    mergeLocalCustomers(source.id, target.id);
  }

  return (
    <Screen edges={["top"]}>
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl onRefresh={() => void refreshCustomers()} refreshing={refreshing} tintColor={colors.ink3} />}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <AppText style={styles.customerCount} variant="headerSummary">{customers.length} total</AppText>
            <Pressable
              accessibilityLabel="Add customer"
              accessibilityRole="button"
              onPress={() => setShowAddSheet(true)}
              style={styles.iconButton}
            >
              <Plus color={colors.ink} size={18} strokeWidth={2.4} />
            </Pressable>
          </View>

          {shouldShowCustomerSearch ? (
            <View style={styles.searchBox}>
              <Search color={colors.ink3} size={15} />
              <TextInput
                accessibilityLabel="Search customers"
                autoCapitalize="none"
                onChangeText={setQuery}
                placeholder="Search name, address, email, phone"
                placeholderTextColor={colors.ink3}
                style={styles.searchInput}
                value={query}
              />
            </View>
          ) : null}

          {duplicateGroups.length > 0 && !hasSearchQuery ? (
            <CustomerSection count={duplicateGroups.length} label="Possible duplicates">
              {duplicateGroups.map((group, index) => (
                <DuplicateGroupRow
                  group={group}
                  key={group.map((customer) => customer.id).join("-")}
                  onPress={() => setDuplicateGroup(group)}
                  statsByCustomerId={statsByCustomerId}
                  withDivider={index < duplicateGroups.length - 1}
                />
              ))}
            </CustomerSection>
          ) : null}

          {customers.length === 0 ? (
            <EmptyCustomersState onAdd={() => setShowAddSheet(true)} />
          ) : filteredCustomers.length === 0 ? (
            <NoMatchesState />
          ) : (
            <CustomerSection count={filteredCustomers.length} label={hasSearchQuery ? "Matches" : "All customers"}>
              {filteredCustomers.map((customer, index) => (
                <CustomerRow
                  duplicate={duplicateGroups.some((group) => group.some((candidate) => candidate.id === customer.id))}
                  key={customer.id}
                  onPress={() => router.push({ pathname: "/customers/[id]", params: { id: customer.id } })}
                  stats={statsByCustomerId.get(customer.id) ?? emptyStats}
                  customer={customer}
                  withDivider={index < filteredCustomers.length - 1}
                />
              ))}
            </CustomerSection>
          )}
        </ScrollView>
      </View>
      <BottomTabBar />

      <SheetModal onDismiss={() => setShowAddSheet(false)} style={styles.modalBackdrop} visible={showAddSheet}>
        <CustomerFormSheet
          onClose={() => setShowAddSheet(false)}
          onSave={saveNewCustomer}
          saving={savingId === "new"}
          title="Add customer"
        />
      </SheetModal>

      <SheetModal onDismiss={() => setEditingCustomerId(null)} style={styles.modalBackdrop} visible={editingCustomer !== null}>
        {editingCustomer ? (
          <CustomerFormSheet
            customer={editingCustomer}
            deleting={deletingId === editingCustomer.id}
            onClose={() => setEditingCustomerId(null)}
            onDelete={() => confirmDeleteCustomer(editingCustomer)}
            onMerge={() => {
              setMergeSourceId(editingCustomer.id);
              setEditingCustomerId(null);
            }}
            onSave={(input) => saveExistingCustomer(editingCustomer, input)}
            quoteCount={(statsByCustomerId.get(editingCustomer.id) ?? emptyStats).quoteCount}
            saving={savingId === editingCustomer.id}
            title="Customer"
          />
        ) : null}
      </SheetModal>

      <SheetModal onDismiss={() => setMergeSourceId(null)} style={styles.modalBackdrop} visible={mergeSource !== null}>
        {mergeSource ? (
          <MergeCustomerSheet
            customers={customers}
            merging={mergingId !== null}
            onClose={() => setMergeSourceId(null)}
            onSelectTarget={(target) => confirmMerge(mergeSource, target)}
            source={mergeSource}
            statsByCustomerId={statsByCustomerId}
          />
        ) : null}
      </SheetModal>

      <SheetModal onDismiss={() => setDuplicateGroup(null)} style={styles.modalBackdrop} visible={duplicateGroup !== null}>
        {duplicateGroup ? (
          <DuplicateGroupSheet
            group={duplicateGroup}
            merging={mergingId !== null}
            onClose={() => setDuplicateGroup(null)}
            onKeep={(target) => confirmMergeDuplicateGroup(target, duplicateGroup)}
            statsByCustomerId={statsByCustomerId}
          />
        ) : null}
      </SheetModal>
    </Screen>
  );
}

function CustomerSection(props: { children: ReactNode; count: number; label: string }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <AppText style={styles.sectionLabel} variant="sectionLabel">{props.label}</AppText>
        <AppText style={styles.sectionCount} variant="meta">{props.count}</AppText>
      </View>
      <View style={styles.sectionCards}>{props.children}</View>
    </View>
  );
}

function CustomerRow(props: {
  customer: Customer;
  duplicate: boolean;
  onPress: () => void;
  stats: CustomerStats;
  withDivider: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onPress}
      style={[styles.customerRow, props.withDivider ? styles.rowDivider : null]}
    >
      <View style={styles.avatar}>
        <AppText style={styles.avatarText} variant="meta">{initials(props.customer.name)}</AppText>
      </View>
      <View style={styles.customerBody}>
        <View style={styles.customerNameRow}>
          <AppText numberOfLines={1} style={styles.customerName} variant="rowTitle">{props.customer.name}</AppText>
          {props.duplicate ? <AppText style={styles.duplicatePill} variant="statusPill">DUP</AppText> : null}
        </View>
        <AppText numberOfLines={1} style={styles.customerAddress} variant="rowSubtitle">{customerLocation(props.customer)}</AppText>
        <AppText numberOfLines={1} style={styles.customerMeta} variant="meta">{customerContactSummary(props.customer)}</AppText>
      </View>
      <View style={styles.customerRight}>
        <AppText style={styles.quoteCount} variant="meta">{quoteCountLabel(props.stats.quoteCount)}</AppText>
        {props.stats.latestQuote ? (
          <AppText numberOfLines={1} style={styles.latestQuote} variant="meta">{deriveJobLabel(props.stats.latestQuote)}</AppText>
        ) : (
          <AppText style={styles.latestQuote} variant="meta">No quotes</AppText>
        )}
      </View>
      <ChevronRight color={colors.ink3} size={14} strokeWidth={2.2} />
    </Pressable>
  );
}

function DuplicateGroupRow(props: {
  group: Customer[];
  onPress: () => void;
  statsByCustomerId: Map<string, CustomerStats>;
  withDivider: boolean;
}) {
  const quoteCount = props.group.reduce(
    (total, customer) => total + (props.statsByCustomerId.get(customer.id)?.quoteCount ?? 0),
    0,
  );

  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onPress}
      style={[styles.duplicateRow, props.withDivider ? styles.rowDivider : null]}
    >
      <View style={styles.duplicateIcon}>
        <Merge color={colors.amber} size={16} strokeWidth={2.3} />
      </View>
      <View style={styles.customerBody}>
        <AppText numberOfLines={1} style={styles.customerName} variant="rowTitle">{props.group[0]?.name ?? "Duplicate customers"}</AppText>
        <AppText numberOfLines={1} style={styles.customerAddress} variant="rowSubtitle">
          {props.group.length} records - {quoteCountLabel(quoteCount)}
        </AppText>
      </View>
      <AppText style={styles.reviewText} variant="button">Review</AppText>
      <ChevronRight color={colors.ink3} size={14} strokeWidth={2.2} />
    </Pressable>
  );
}

function EmptyCustomersState(props: { onAdd: () => void }) {
  return (
    <View style={styles.emptyFull}>
      <View style={styles.emptyIconCard}>
        <Users color={colors.ink2} size={31} strokeWidth={2.1} />
      </View>
      <AppText style={styles.emptyHeadline} variant="panelTitle">No customers yet</AppText>
      <AppText style={styles.emptyCopy} variant="body">Create one here, or pick/create a customer while starting a quote.</AppText>
      <Pressable accessibilityRole="button" onPress={props.onAdd} style={styles.emptyPrimary}>
        <Plus color={colors.onDark} size={16} strokeWidth={2.5} />
        <AppText style={styles.emptyPrimaryText} tone="onDark" variant="primaryAction">Add customer</AppText>
      </Pressable>
    </View>
  );
}

function NoMatchesState() {
  return (
    <View style={styles.noMatches}>
      <AppText style={styles.noMatchesTitle} variant="rowTitle">Nothing matches</AppText>
      <AppText style={styles.noMatchesText} variant="body">Try a different customer search.</AppText>
    </View>
  );
}

function CustomerFormSheet(props: {
  customer?: Customer | undefined;
  deleting?: boolean | undefined;
  onClose: () => void;
  onDelete?: (() => void) | undefined;
  onMerge?: (() => void) | undefined;
  onSave: (input: CustomerFormInput) => void | Promise<void>;
  quoteCount?: number | undefined;
  saving: boolean;
  title: string;
}) {
  const [name, setName] = useState(props.customer?.name ?? "");
  const [email, setEmail] = useState(props.customer?.email ?? "");
  const [phone, setPhone] = useState(props.customer?.phone ?? "");
  const [address, setAddress] = useState(props.customer?.address ?? "");
  const [city, setCity] = useState(props.customer?.city ?? "");
  const [error, setError] = useState<string | null>(null);
  const isEditing = props.customer !== undefined;

  function submit() {
    const input = normalizedCustomerInput({ name, email, phone, address, city });
    const validation = validateCustomerInput(input);

    if (validation !== null) {
      setError(validation);
      return;
    }

    setError(null);
    void props.onSave(input);
  }

  return (
    <AnimatedSheetContent style={styles.sheet}>
      <View style={styles.sheetHeader}>
        <View>
          <AppText style={styles.sheetTitle} variant="panelTitle">{props.title}</AppText>
          {isEditing ? (
            <AppText style={styles.sheetSubtitle} variant="meta">{quoteCountLabel(props.quoteCount ?? 0)}</AppText>
          ) : null}
        </View>
        <Pressable accessibilityLabel="Close" accessibilityRole="button" onPress={props.onClose} style={styles.sheetClose}>
          <X color={colors.ink2} size={17} strokeWidth={2.4} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.sheetScroll} keyboardShouldPersistTaps="handled">
        <SheetField label="Name">
          <TextInput onChangeText={setName} placeholder="Customer name" placeholderTextColor={colors.ink3} style={styles.sheetInput} value={name} />
        </SheetField>
        <SheetField label="Phone">
          <TextInput keyboardType="phone-pad" onChangeText={setPhone} placeholder="Mobile" placeholderTextColor={colors.ink3} style={styles.sheetInput} value={phone} />
        </SheetField>
        <SheetField label="Email">
          <TextInput
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="name@email.com"
            placeholderTextColor={colors.ink3}
            style={styles.sheetInput}
            value={email}
          />
        </SheetField>
        <SheetField label="Address">
          <TextInput onChangeText={setAddress} placeholder="Street, city" placeholderTextColor={colors.ink3} style={styles.sheetInput} value={address} />
        </SheetField>
        <SheetField label="City">
          <TextInput onChangeText={setCity} placeholder="Toronto" placeholderTextColor={colors.ink3} style={styles.sheetInput} value={city} />
        </SheetField>

        {error ? <AppText style={styles.formError} tone="red" variant="meta">{error}</AppText> : null}

        <Pressable
          accessibilityRole="button"
          disabled={props.saving}
          onPress={submit}
          style={[styles.primaryAction, props.saving ? styles.actionDisabled : null]}
        >
          <AppText style={styles.primaryActionText} tone="onDark" variant="primaryAction">{props.saving ? "Saving..." : isEditing ? "Save customer" : "Create customer"}</AppText>
        </Pressable>

        {isEditing ? (
          <View style={styles.secondaryActions}>
            <Pressable accessibilityRole="button" onPress={props.onMerge} style={styles.secondaryAction}>
              <Merge color={colors.ink2} size={15} strokeWidth={2.3} />
              <AppText style={styles.secondaryActionText} variant="button">Merge</AppText>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={props.onDelete} style={styles.secondaryAction}>
              <Trash2 color={colors.red} size={15} strokeWidth={2.3} />
              <AppText style={[styles.secondaryActionText, styles.dangerText]} tone="red" variant="button">{props.deleting ? "Deleting..." : "Delete"}</AppText>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </AnimatedSheetContent>
  );
}

function MergeCustomerSheet(props: {
  customers: Customer[];
  merging: boolean;
  onClose: () => void;
  onSelectTarget: (target: Customer) => void;
  source: Customer;
  statsByCustomerId: Map<string, CustomerStats>;
}) {
  const [query, setQuery] = useState("");
  const candidates = useMemo(
    () => sortMergeCandidates(props.source, props.customers, props.statsByCustomerId).filter((customer) => matchesCustomerSearch(customer, query)),
    [props.customers, props.source, props.statsByCustomerId, query],
  );

  return (
    <AnimatedSheetContent style={styles.sheet}>
      <View style={styles.sheetHeader}>
        <View>
          <AppText style={styles.sheetTitle} variant="panelTitle">Merge customer</AppText>
          <AppText numberOfLines={1} style={styles.sheetSubtitle} variant="meta">{props.source.name}</AppText>
        </View>
        <Pressable accessibilityLabel="Close" accessibilityRole="button" onPress={props.onClose} style={styles.sheetClose}>
          <X color={colors.ink2} size={17} strokeWidth={2.4} />
        </Pressable>
      </View>
      <View style={styles.mergeSearch}>
        <Search color={colors.ink3} size={15} />
        <TextInput
          autoCapitalize="none"
          onChangeText={setQuery}
          placeholder="Search customer to keep"
          placeholderTextColor={colors.ink3}
          style={styles.searchInput}
          value={query}
        />
      </View>
      <ScrollView contentContainerStyle={styles.mergeList}>
        {candidates.map((customer, index) => (
          <MergeTargetRow
            customer={customer}
            disabled={props.merging}
            key={customer.id}
            onPress={() => props.onSelectTarget(customer)}
            stats={props.statsByCustomerId.get(customer.id) ?? emptyStats}
            withDivider={index < candidates.length - 1}
          />
        ))}
      </ScrollView>
    </AnimatedSheetContent>
  );
}

function DuplicateGroupSheet(props: {
  group: Customer[];
  merging: boolean;
  onClose: () => void;
  onKeep: (target: Customer) => void;
  statsByCustomerId: Map<string, CustomerStats>;
}) {
  return (
    <AnimatedSheetContent style={styles.sheet}>
      <View style={styles.sheetHeader}>
        <View>
          <AppText style={styles.sheetTitle} variant="panelTitle">Possible duplicates</AppText>
          <AppText style={styles.sheetSubtitle} variant="meta">{props.group.length} customer records</AppText>
        </View>
        <Pressable accessibilityLabel="Close" accessibilityRole="button" onPress={props.onClose} style={styles.sheetClose}>
          <X color={colors.ink2} size={17} strokeWidth={2.4} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.mergeList}>
        {props.group.map((customer, index) => (
          <DuplicateKeepRow
            customer={customer}
            disabled={props.merging}
            key={customer.id}
            onPress={() => props.onKeep(customer)}
            stats={props.statsByCustomerId.get(customer.id) ?? emptyStats}
            withDivider={index < props.group.length - 1}
          />
        ))}
      </ScrollView>
    </AnimatedSheetContent>
  );
}

function MergeTargetRow(props: {
  customer: Customer;
  disabled: boolean;
  onPress: () => void;
  stats: CustomerStats;
  withDivider: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={props.disabled}
      onPress={props.onPress}
      style={[styles.mergeRow, props.withDivider ? styles.rowDivider : null]}
    >
      <View style={styles.avatarSmall}>
        <AppText style={styles.avatarSmallText} variant="meta">{initials(props.customer.name)}</AppText>
      </View>
      <View style={styles.customerBody}>
        <AppText numberOfLines={1} style={styles.customerName} variant="rowTitle">{props.customer.name}</AppText>
        <AppText numberOfLines={1} style={styles.customerAddress} variant="rowSubtitle">{customerLocation(props.customer)}</AppText>
      </View>
      <AppText style={styles.keepText} variant="button">{quoteCountLabel(props.stats.quoteCount)}</AppText>
    </Pressable>
  );
}

function DuplicateKeepRow(props: {
  customer: Customer;
  disabled: boolean;
  onPress: () => void;
  stats: CustomerStats;
  withDivider: boolean;
}) {
  return (
    <View style={[styles.mergeRow, props.withDivider ? styles.rowDivider : null]}>
      <View style={styles.avatarSmall}>
        <AppText style={styles.avatarSmallText} variant="meta">{initials(props.customer.name)}</AppText>
      </View>
      <View style={styles.customerBody}>
        <AppText numberOfLines={1} style={styles.customerName} variant="rowTitle">{props.customer.name}</AppText>
        <AppText numberOfLines={1} style={styles.customerAddress} variant="rowSubtitle">
          {customerLocation(props.customer)} - {quoteCountLabel(props.stats.quoteCount)}
        </AppText>
      </View>
      <Pressable accessibilityRole="button" disabled={props.disabled} onPress={props.onPress} style={styles.keepButton}>
        <AppText style={styles.keepButtonText} variant="button">Keep</AppText>
      </Pressable>
    </View>
  );
}

function SheetField(props: { children: ReactNode; label: string }) {
  return (
    <View style={styles.sheetField}>
      <AppText style={styles.sheetFieldLabel} variant="sectionLabel">{props.label}</AppText>
      {props.children}
    </View>
  );
}

function customerStats(customers: Customer[], quotes: QuoteRecord[], events: ReturnType<typeof useQuoteStore.getState>["events"]) {
  const stats = new Map<string, CustomerStats>();

  for (const customer of customers) {
    stats.set(customer.id, { ...emptyStats });
  }

  for (const quote of quotes) {
    const existing = stats.get(quote.customerId) ?? { ...emptyStats };
    const status = getQuoteStatus(quote, events);
    const latestQuote =
      existing.latestQuote === null || quote.updatedAt.localeCompare(existing.latestQuote.updatedAt) > 0
        ? quote
        : existing.latestQuote;

    stats.set(quote.customerId, {
      quoteCount: existing.quoteCount + 1,
      activeQuoteCount: existing.activeQuoteCount + (status === "draft" || status === "sent" || status === "viewed" ? 1 : 0),
      latestQuote,
    });
  }

  return stats;
}

function sortCustomers(customers: Customer[], statsByCustomerId: Map<string, CustomerStats>) {
  return [...customers].sort((a, b) => {
    const aLatest = statsByCustomerId.get(a.id)?.latestQuote?.updatedAt ?? a.createdAt;
    const bLatest = statsByCustomerId.get(b.id)?.latestQuote?.updatedAt ?? b.createdAt;
    return bLatest.localeCompare(aLatest);
  });
}

function matchesCustomerSearch(customer: Customer, query: string) {
  const term = normalizeText(query);

  if (term.length === 0) {
    return true;
  }

  return [
    customer.name,
    customer.email ?? "",
    customer.phone ?? "",
    customer.address,
    customer.city,
  ].some((value) => normalizeText(value).includes(term));
}

function possibleDuplicateGroups(customers: Customer[]) {
  const groups = new Map<string, Customer[]>();

  for (const customer of customers) {
    for (const key of duplicateKeys(customer)) {
      const group = groups.get(key) ?? [];
      group.push(customer);
      groups.set(key, group);
    }
  }

  const unique = new Map<string, Customer[]>();

  for (const group of groups.values()) {
    if (group.length < 2) {
      continue;
    }

    const key = group.map((customer) => customer.id).sort().join("|");
    unique.set(key, group);
  }

  return [...unique.values()].sort((a, b) => b.length - a.length).slice(0, 8);
}

function duplicateKeys(customer: Customer) {
  const keys: string[] = [];
  const email = normalizeText(customer.email ?? "");
  const phone = normalizePhone(customer.phone ?? "");
  const name = normalizeText(customer.name);
  const city = normalizeText(customer.city || deriveCustomerCity(customer.address));
  const address = normalizeText(customer.address);

  if (email.length > 0) {
    keys.push(`email:${email}`);
  }

  if (phone.length >= 7) {
    keys.push(`phone:${phone}`);
  }

  if (name.length > 0 && address.length > 0) {
    keys.push(`name-address:${name}:${address}`);
  }

  if (name.length > 0 && city.length > 0) {
    keys.push(`name-city:${name}:${city}`);
  }

  return keys;
}

function sortMergeCandidates(source: Customer, customers: Customer[], statsByCustomerId: Map<string, CustomerStats>) {
  const sourceKeys = new Set(duplicateKeys(source));

  return customers
    .filter((customer) => customer.id !== source.id)
    .sort((a, b) => {
      const aDuplicate = duplicateKeys(a).some((key) => sourceKeys.has(key)) ? 1 : 0;
      const bDuplicate = duplicateKeys(b).some((key) => sourceKeys.has(key)) ? 1 : 0;

      if (aDuplicate !== bDuplicate) {
        return bDuplicate - aDuplicate;
      }

      const aQuoteCount = statsByCustomerId.get(a.id)?.quoteCount ?? 0;
      const bQuoteCount = statsByCustomerId.get(b.id)?.quoteCount ?? 0;

      if (aQuoteCount !== bQuoteCount) {
        return bQuoteCount - aQuoteCount;
      }

      return a.name.localeCompare(b.name);
    });
}

function normalizedCustomerInput(input: CustomerFormInput): CustomerFormInput {
  const address = input.address.trim();
  const city = input.city?.trim() ?? "";

  return {
    name: input.name.trim(),
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    address,
    city: city.length > 0 ? city : deriveCustomerCity(address),
  };
}

function validateCustomerInput(input: CustomerFormInput) {
  if (input.name.trim().length === 0) {
    return "Customer name is required.";
  }

  if (input.address.trim().length === 0) {
    return "Address is required.";
  }

  const phone = input.phone?.trim() ?? "";

  if (phone.length > 0 && normalizePhone(phone).length < 7) {
    return "Enter at least 7 phone digits, or leave phone blank.";
  }

  const email = input.email?.trim() ?? "";

  if (email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "Enter a valid email, or leave email blank.";
  }

  return null;
}

function apiCustomerInput(input: CustomerFormInput): CreateCustomerInput {
  return {
    name: input.name,
    email: input.email ?? null,
    phone: input.phone ?? null,
    address: input.address,
    city: input.city,
  };
}

function customerLocation(customer: Customer) {
  const city = customer.city.trim() || deriveCustomerCity(customer.address);
  const address = customer.address.trim();

  if (city.length === 0 || normalizeText(address).includes(normalizeText(city))) {
    return address;
  }

  return `${address} - ${city}`;
}

function customerContactSummary(customer: Customer) {
  const parts = [customer.phone, customer.email].filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  return parts.length > 0 ? parts.join(" - ") : "No contact info";
}

function quoteCountLabel(count: number) {
  return `${count} ${count === 1 ? "quote" : "quotes"}`;
}

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

function isLocalCustomer(customer: Customer) {
  return customer.id.startsWith("cust-");
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
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  customerCount: {
    color: colors.ink3,
    fontSize: 14,
    ...fontStyles.medium,
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
  searchBox: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 9,
    height: 46,
    paddingHorizontal: 13,
  },
  searchInput: {
    color: colors.ink,
    flex: 1,
    fontSize: 14,
    ...fontStyles.regular,
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
    ...typography.sectionLabel,
    fontSize: 11,
    letterSpacing: 1.7,
    textTransform: "uppercase",
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
  customerRow: {
    alignItems: "center",
    backgroundColor: colors.surface,
    flexDirection: "row",
    gap: 10,
    minHeight: 76,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  duplicateRow: {
    alignItems: "center",
    backgroundColor: colors.surface,
    flexDirection: "row",
    gap: 10,
    minHeight: 62,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  rowDivider: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  avatarText: {
    color: colors.ink2,
    fontSize: 13,
    ...fontStyles.semibold,
  },
  avatarSmall: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  avatarSmallText: {
    color: colors.ink2,
    fontSize: 12,
    ...fontStyles.semibold,
  },
  duplicateIcon: {
    alignItems: "center",
    backgroundColor: colors.amberBg,
    borderColor: colors.amberBorder,
    borderRadius: 10,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  customerBody: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  customerNameRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
    minWidth: 0,
  },
  customerName: {
    color: colors.ink,
    flexShrink: 1,
    fontSize: 15,
    ...fontStyles.semibold,
  },
  duplicatePill: {
    backgroundColor: colors.amberBg,
    borderColor: colors.amberBorder,
    borderRadius: 6,
    borderWidth: 1,
    color: colors.amber,
    fontSize: 8,
    ...fontStyles.semibold,
    overflow: "hidden",
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  customerAddress: {
    color: colors.ink3,
    fontSize: 12,
    ...fontStyles.regular,
  },
  customerMeta: {
    color: colors.ink3,
    fontSize: 11,
    ...fontStyles.regular,
  },
  customerRight: {
    alignItems: "flex-end",
    gap: 2,
    maxWidth: 82,
  },
  quoteCount: {
    color: colors.ink,
    fontSize: 12,
    ...fontStyles.semibold,
  },
  latestQuote: {
    color: colors.ink3,
    fontSize: 10.5,
    ...fontStyles.regular,
    maxWidth: 82,
    textAlign: "right",
  },
  reviewText: {
    color: colors.amber,
    fontSize: 12,
    ...fontStyles.semibold,
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
    paddingHorizontal: 34,
    paddingTop: 74,
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
    fontSize: 19,
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
    paddingHorizontal: 25,
    ...shadowLg,
  },
  emptyPrimaryText: {
    color: colors.onDark,
    fontSize: 15,
    ...fontStyles.semibold,
  },
  modalBackdrop: {
    backgroundColor: "rgba(32,31,27,0.18)",
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "88%",
    overflow: "hidden",
    paddingTop: 10,
  },
  sheetHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 16,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  sheetTitle: {
    color: colors.ink,
    fontSize: 19,
    ...fontStyles.semibold,
  },
  sheetSubtitle: {
    color: colors.ink3,
    fontSize: 12,
    ...fontStyles.regular,
    marginTop: 2,
  },
  sheetClose: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  sheetScroll: {
    gap: 14,
    paddingBottom: 18,
    paddingHorizontal: 20,
  },
  sheetField: {
    gap: 7,
  },
  sheetFieldLabel: {
    ...typography.sectionLabel,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  sheetInput: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 15,
    ...fontStyles.regular,
    height: 44,
    paddingHorizontal: 12,
  },
  formError: {
    color: colors.red,
    fontSize: 12,
    ...fontStyles.medium,
    lineHeight: 16,
  },
  primaryAction: {
    alignItems: "center",
    backgroundColor: colors.dark,
    borderRadius: 12,
    height: 48,
    justifyContent: "center",
    marginTop: 4,
  },
  actionDisabled: {
    opacity: 0.55,
  },
  primaryActionText: {
    color: colors.onDark,
    fontSize: 15,
    ...fontStyles.semibold,
  },
  secondaryActions: {
    flexDirection: "row",
    gap: 10,
  },
  secondaryAction: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 7,
    height: 42,
    justifyContent: "center",
  },
  secondaryActionText: {
    color: colors.ink2,
    fontSize: 13,
    ...fontStyles.semibold,
  },
  dangerText: {
    color: colors.red,
  },
  mergeSearch: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 9,
    height: 44,
    marginBottom: 10,
    marginHorizontal: 20,
    paddingHorizontal: 12,
  },
  mergeList: {
    paddingBottom: 18,
    paddingHorizontal: 20,
  },
  mergeRow: {
    alignItems: "center",
    backgroundColor: colors.surface,
    flexDirection: "row",
    gap: 10,
    minHeight: 58,
    paddingVertical: 10,
  },
  keepText: {
    color: colors.ink2,
    fontSize: 12,
    ...fontStyles.semibold,
  },
  keepButton: {
    alignItems: "center",
    backgroundColor: colors.dark,
    borderRadius: 8,
    height: 32,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  keepButtonText: {
    color: colors.onDark,
    fontSize: 12,
    ...fontStyles.semibold,
  },
});
