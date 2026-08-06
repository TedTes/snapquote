import { useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  TextInput,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ChevronLeft,
  Edit3,
  Mail,
  MoreHorizontal,
  Phone,
  Plus,
  Send,
  X
} from "lucide-react-native";
import { deriveCustomerCity, deriveJobLabel, type Customer, type QuoteStatus } from "@snapquote/shared";
import { AnimatedSheetContent, SheetModal } from "../../shared-ui/AnimatedSheet";
import { EmptyState, Screen } from "../../shared-ui/base";
import { AppText } from "../../shared-ui/text";
import { apiBaseUrl, snapquoteApi, userFacingErrorMessage, type CreateCustomerInput } from "../../api/client";
import { colors, fontStyles, radius, typography } from "../../shared-ui/theme";
import { useAuthStore } from "../../state/authStore";
import {
  getQuoteBlockers,
  getQuoteIsStale,
  getQuoteStatus,
  getQuoteTotals,
  useQuoteStore,
  type CustomerFormInput,
  type QuoteRecord
} from "../../state/quoteStore";
import { formatMoney, formatRelativeToNow, formatShortDate, initials } from "../../utils/format";

type QuoteAction = "archive" | "delete" | "follow-up" | "resend" | "send";

type CustomerQuoteRow = {
  quote: QuoteRecord;
  status: QuoteStatus;
  stale: boolean;
};

export default function CustomerProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const customers = useQuoteStore((state) => state.customers);
  const quotes = useQuoteStore((state) => state.quotes);
  const events = useQuoteStore((state) => state.events);
  const updateLocalCustomer = useQuoteStore((state) => state.updateCustomer);
  const deleteLocalDraft = useQuoteStore((state) => state.deleteDraftQuote);
  const archiveLocalQuote = useQuoteStore((state) => state.archiveQuote);
  const recordLocalFollowUp = useQuoteStore((state) => state.followUpQuote);
  const recordLocalResend = useQuoteStore((state) => state.recordQuoteResend);
  const startNewQuoteWizard = useQuoteStore((state) => state.startNewQuoteWizard);
  const updateWizard = useQuoteStore((state) => state.updateWizard);
  const upsertCustomer = useQuoteStore((state) => state.upsertCustomer);
  const upsertRemoteQuote = useQuoteStore((state) => state.upsertRemoteQuote);
  const authStatus = useAuthStore((state) => state.status);
  const insets = useSafeAreaInsets();

  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);

  const customer = id ? customers.find((candidate) => candidate.id === id) ?? null : null;
  const quoteRows = useMemo<CustomerQuoteRow[]>(
    () =>
      quotes
        .filter((quote) => quote.customerId === id)
        .map((quote) => ({
          quote,
          status: getQuoteStatus(quote, events),
          stale: getQuoteIsStale(quote),
        }))
        .sort((a, b) => b.quote.updatedAt.localeCompare(a.quote.updatedAt)),
    [events, id, quotes],
  );
  const activeQuoteCount = quoteRows.filter((row) => row.status === "draft" || row.status === "sent" || row.status === "viewed").length;
  const acceptedTotal = quoteRows.reduce((sum, row) => {
    if (row.status !== "accepted") {
      return sum;
    }

    return sum + (getQuoteTotals(row.quote)?.totalCents ?? 0);
  }, 0);

  const refreshProfile = useCallback(async () => {
    if (authStatus !== "signed_in") {
      return;
    }

    setRefreshing(true);

    try {
      const [customerResponse, quoteResponse] = await Promise.all([
        snapquoteApi.listCustomers(),
        snapquoteApi.listQuotes(),
      ]);

      for (const refreshedCustomer of customerResponse.customers) {
        upsertCustomer(refreshedCustomer);
      }

      for (const refreshedQuote of quoteResponse.quotes) {
        upsertRemoteQuote(refreshedQuote);
      }
    } catch (error) {
      console.warn("QuoteVan customer profile refresh skipped", error);
    } finally {
      setRefreshing(false);
    }
  }, [authStatus, upsertCustomer, upsertRemoteQuote]);

  useFocusEffect(
    useCallback(() => {
      void refreshProfile();
    }, [refreshProfile]),
  );

  if (!id || !customer) {
    return (
      <Screen>
        <View style={styles.notFound}>
          <EmptyState title="Customer not found" text="This customer may have been merged or deleted." />
        </View>
      </Screen>
    );
  }

  const currentCustomer = customer;

  function goBack() {
    router.back();
  }

  function callCustomer() {
    const phone = currentCustomer.phone?.replace(/[^\d+]/g, "") ?? "";

    if (phone.length === 0) {
      Alert.alert("No phone number", "Add a phone number before calling this customer.");
      return;
    }

    void Linking.openURL(`tel:${phone}`);
  }

  function emailCustomer() {
    const email = currentCustomer.email ?? "";

    if (email.length === 0) {
      Alert.alert("No email address", "Add an email address before emailing this customer.");
      return;
    }

    void Linking.openURL(`mailto:${email}?subject=${encodeURIComponent("Quote from QuoteVan")}`);
  }

  function startQuoteForCustomer() {
    startNewQuoteWizard();
    updateWizard({
      customerId: currentCustomer.id,
      customerName: currentCustomer.name,
      customerPhone: currentCustomer.phone ?? "",
      customerEmail: currentCustomer.email ?? "",
      address: currentCustomer.address,
      jobTitle: "",
    });
    router.push("/new-quote/checklist");
  }

  async function saveCustomer(input: CustomerFormInput) {
    if (savingCustomer) {
      return;
    }

    setSavingCustomer(true);

    try {
      if (authStatus !== "signed_in" || isLocalCustomer(currentCustomer)) {
        updateLocalCustomer(currentCustomer.id, input);
        setEditing(false);
        return;
      }

      const updated = await snapquoteApi.updateCustomer(currentCustomer.id, apiCustomerInput(input));
      upsertCustomer(updated);
      setEditing(false);
    } catch (error) {
      Alert.alert("Could not save customer", userFacingErrorMessage(error));
    } finally {
      setSavingCustomer(false);
    }
  }

  function actionKey(quoteId: string, action: QuoteAction) {
    return `${quoteId}:${action}`;
  }

  function requireSignedIn(message: string) {
    if (authStatus === "signed_in") {
      return true;
    }

    Alert.alert("Sign in required", message);
    return false;
  }

  function sendDraft(quote: QuoteRecord) {
    const blockers = getQuoteBlockers(quote);

    if (blockers.reasons.length > 0) {
      Alert.alert("Quote is not ready", blockers.reasons.join("\n"));
      return;
    }

    router.push({ pathname: "/quote/[id]/preview", params: { id: quote.id } });
  }

  async function resendQuote(quote: QuoteRecord) {
    if (!requireSignedIn("Sign in to resend quote links.")) {
      return;
    }

    if (isLocalQuote(quote)) {
      Alert.alert("Sync required", "Open this quote and send it once before resending the customer link.");
      return;
    }

    if (currentCustomer.email === null || currentCustomer.email.trim().length === 0) {
      Alert.alert("Add customer email", "An email address is required before resending this quote.");
      return;
    }

    const key = actionKey(quote.id, "resend");

    if (activeAction !== null) {
      return;
    }

    setActiveAction(key);

    try {
      const updated = await snapquoteApi.resendQuote(quote.id, ["email"]);
      upsertRemoteQuote(updated);
      recordLocalResend(quote.id);
      Alert.alert("Quote link resent", `QuoteVan resent the link to ${currentCustomer.email}.`);
    } catch (error) {
      Alert.alert("Could not resend link", userFacingErrorMessage(error));
    } finally {
      setActiveAction(null);
    }
  }

  async function followUpQuote(quote: QuoteRecord) {
    if (!requireSignedIn("Sign in to send follow-ups and track customer responses.")) {
      return;
    }

    if (isLocalQuote(quote)) {
      Alert.alert("Sync required", "Open this quote and send it once before sending a follow-up.");
      return;
    }

    if (!getQuoteIsStale(quote)) {
      Alert.alert("Follow-up not due yet", followUpAvailability(quote));
      return;
    }

    const key = actionKey(quote.id, "follow-up");

    if (activeAction !== null) {
      return;
    }

    setActiveAction(key);

    try {
      const updated = await snapquoteApi.followUpQuote(quote.id, ["email"]);
      upsertRemoteQuote(updated);
      recordLocalFollowUp(quote.id);
      Alert.alert("Follow-up sent", `QuoteVan sent a follow-up to ${currentCustomer.email ?? "this customer"}.`);
    } catch (error) {
      Alert.alert("Could not send follow-up", userFacingErrorMessage(error));
    } finally {
      setActiveAction(null);
    }
  }

  function copyQuoteLink(quote: QuoteRecord) {
    const url = publicQuoteUrl(quote);

    if (url === null) {
      Alert.alert("No quote link yet", "Send or sync this quote before sharing the customer link.");
      return;
    }

    void Share.share({ message: url, url });
  }

  function confirmArchiveQuote(row: CustomerQuoteRow) {
    const isDraft = row.status === "draft";

    Alert.alert(
      isDraft ? "Delete draft?" : "Close quote?",
      isDraft
        ? "This removes the draft from this customer history."
        : "This archives the quote and hides it from active quote lists. Customer links stay available.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: isDraft ? "Delete" : "Close",
          style: "destructive",
          onPress: () => {
            void archiveQuote(row);
          },
        },
      ],
    );
  }

  function openQuoteOverflow(row: CustomerQuoteRow) {
    const isDraft = row.status === "draft";
    const hasPublicLink = publicQuoteUrl(row.quote) !== null;
    const actions: Array<{
      text: string;
      onPress?: (() => void) | undefined;
      style?: "cancel" | "default" | "destructive" | undefined;
    }> = [];

    if (hasPublicLink) {
      actions.push({ text: "Copy link", onPress: () => copyQuoteLink(row.quote) });
    }

    if (canFollowUp(row.status)) {
      actions.push({ text: "Resend link", onPress: () => void resendQuote(row.quote) });
      actions.push({
        text: row.stale ? "Send follow-up" : "Follow-up not due",
        onPress: row.stale ? () => void followUpQuote(row.quote) : undefined,
      });
    }

    actions.push({
      text: isDraft ? "Delete draft" : "Close quote",
      onPress: () => confirmArchiveQuote(row),
      style: "destructive",
    });
    actions.push({ text: "Cancel", style: "cancel" });

    Alert.alert("Quote actions", deriveJobLabel(row.quote), actions);
  }

  async function archiveQuote(row: CustomerQuoteRow) {
    const action = row.status === "draft" ? "delete" : "archive";
    const key = actionKey(row.quote.id, action);

    if (activeAction !== null) {
      return;
    }

    setActiveAction(key);

    try {
      if (row.status === "draft") {
        if (authStatus !== "signed_in" && !isLocalQuote(row.quote)) {
          Alert.alert("Sign in required", "Sign in to delete this synced draft.");
          return;
        }

        if (authStatus === "signed_in" && !isLocalQuote(row.quote)) {
          await snapquoteApi.deleteDraftQuote(row.quote.id);
        }

        deleteLocalDraft(row.quote.id);
        return;
      }

      if (authStatus !== "signed_in" && !isLocalQuote(row.quote)) {
        Alert.alert("Sign in required", "Sign in to close this synced quote.");
        return;
      }

      if (authStatus === "signed_in" && !isLocalQuote(row.quote)) {
        await snapquoteApi.archiveQuote(row.quote.id);
      }

      archiveLocalQuote(row.quote.id);
    } catch (error) {
      Alert.alert(row.status === "draft" ? "Could not delete draft" : "Could not close quote", userFacingErrorMessage(error));
    } finally {
      setActiveAction(null);
    }
  }

  return (
    <Screen edges={["top"]}>
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 18 }]}
          refreshControl={<RefreshControl onRefresh={() => void refreshProfile()} refreshing={refreshing} tintColor={colors.ink3} />}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.nav}>
            <Pressable accessibilityRole="button" onPress={goBack} style={styles.navButton}>
              <ChevronLeft color={colors.ink} size={18} strokeWidth={2.5} />
            </Pressable>
            <View style={styles.navTitleWrap}>
              <AppText style={styles.navEyebrow} variant="sectionLabel">Customer</AppText>
            </View>
            <Pressable accessibilityRole="button" onPress={() => setEditing(true)} style={styles.navButton}>
              <Edit3 color={colors.ink} size={17} strokeWidth={2.4} />
            </Pressable>
          </View>

          <View style={styles.profileHero}>
            <View style={styles.avatar}>
              <AppText style={styles.avatarText} tone="onDark" variant="statValue">{initials(currentCustomer.name)}</AppText>
            </View>
            <View style={styles.profileCopy}>
              <AppText numberOfLines={2} style={styles.customerName} variant="panelTitle">{currentCustomer.name}</AppText>
              <AppText numberOfLines={1} style={styles.customerLocation} variant="headerSummary">{customerSubtitle(currentCustomer)}</AppText>
            </View>
          </View>

          <View style={styles.contactActions}>
            <ContactButton icon={<Phone color={colors.ink2} size={15} strokeWidth={2.3} />} label="Call" onPress={callCustomer} />
            <ContactButton icon={<Mail color={colors.ink2} size={15} strokeWidth={2.3} />} label="Email" onPress={emailCustomer} />
          </View>

          <View style={styles.profileStats}>
            <ProfileStat label="Quotes" value={String(quoteRows.length)} />
            <ProfileStat label="Active" value={String(activeQuoteCount)} />
            <ProfileStat label="Won" last tone="green" value={formatMoney(acceptedTotal)} />
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <AppText style={styles.sectionLabel} variant="sectionLabel">Quotes</AppText>
              <AppText style={styles.sectionCount} variant="meta">{quoteRows.length}</AppText>
            </View>
            <Pressable accessibilityRole="button" onPress={startQuoteForCustomer} style={styles.newQuoteButton}>
              <Plus color={colors.ink2} size={15} strokeWidth={2.5} />
              <AppText numberOfLines={1} style={styles.newQuoteText} variant="button">New quote for {currentCustomer.name}</AppText>
            </Pressable>
            {quoteRows.length === 0 ? (
              <View style={styles.emptyHistory}>
                <AppText style={styles.emptyHistoryTitle} variant="rowTitle">No quotes yet</AppText>
                <AppText style={styles.emptyHistoryText} variant="body">Start a quote and pick this customer to build their history.</AppText>
              </View>
            ) : (
              <View style={styles.historyList}>
                {quoteRows.map((row) => (
                  <QuoteHistoryCard
                    key={row.quote.id}
                    actionLabel={actionLabel(activeAction, row.quote.id)}
                    onMore={() => openQuoteOverflow(row)}
                    onOpen={() => router.push({ pathname: "/quote/[id]", params: { id: row.quote.id } })}
                    onSend={() => sendDraft(row.quote)}
                    row={row}
                  />
                ))}
              </View>
            )}
          </View>
        </ScrollView>

        <SheetModal onDismiss={() => setEditing(false)} style={styles.modalBackdrop} visible={editing}>
          <CustomerEditSheet
            customer={currentCustomer}
            onClose={() => setEditing(false)}
            onSave={saveCustomer}
            saving={savingCustomer}
          />
        </SheetModal>
      </View>
    </Screen>
  );
}

function ProfileStat(props: { label: string; last?: boolean | undefined; tone?: "green" | undefined; value: string }) {
  return (
    <View style={[styles.profileStat, props.last ? styles.profileStatLast : null]}>
      <AppText style={[styles.profileStatValue, props.tone === "green" ? styles.profileStatValueGreen : null]} variant="statValue">{props.value}</AppText>
      <AppText style={styles.profileStatLabel} variant="sectionLabel">{props.label}</AppText>
    </View>
  );
}

function ContactButton(props: { icon: ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={props.onPress} style={styles.contactButton}>
      {props.icon}
      <AppText style={styles.contactButtonText} variant="button">{props.label}</AppText>
    </Pressable>
  );
}

function QuoteHistoryCard(props: {
  actionLabel: string | null;
  onMore: () => void;
  onOpen: () => void;
  onSend: () => void;
  row: CustomerQuoteRow;
}) {
  const { quote, status, stale } = props.row;
  const totals = getQuoteTotals(quote);
  const blockers = getQuoteBlockers(quote);
  const isDraft = status === "draft";
  const canSendDraft = isDraft && blockers.reasons.length === 0;
  const awaitingResponse = canFollowUp(status);
  const sendDisabled = !canSendDraft || props.actionLabel !== null;

  return (
    <View style={styles.quoteCard}>
      <Pressable accessibilityRole="button" onPress={props.onOpen} style={styles.quoteMain}>
        <View style={[styles.quoteStripe, quoteStripeStyle(status)]} />
        <View style={styles.quoteBody}>
          <View style={styles.quoteTop}>
            <View style={styles.quoteTitleBlock}>
              <AppText numberOfLines={1} style={styles.quoteTitle} variant="rowTitle">{deriveJobLabel(quote)}</AppText>
              <AppText numberOfLines={1} style={styles.quoteMeta} variant="rowSubtitle">{quoteMeta(quote, status, stale)}</AppText>
            </View>
            <View style={styles.quoteRight}>
              <AppText style={styles.quoteAmount} variant="amount">{formatMoney(totals?.totalCents ?? null)}</AppText>
              <View style={[styles.statusPill, statusPillStyle(status)]}>
                <AppText style={[styles.statusText, statusTextStyle(status)]} variant="statusPill">{quoteStatusLabel(status)}</AppText>
              </View>
            </View>
          </View>
          {isDraft && blockers.reasons.length > 0 ? (
            <AppText numberOfLines={1} style={styles.blockerText} tone="red" variant="button">{blockers.reasons[0]}</AppText>
          ) : null}
          {awaitingResponse && !stale ? (
            <AppText numberOfLines={1} style={styles.reminderText} variant="meta">{followUpAvailability(quote)}</AppText>
          ) : null}
        </View>
      </Pressable>

      <View style={styles.quoteFooter}>
        <QuoteFooterAction
          disabled={sendDisabled}
          icon={<Send color={sendDisabled ? colors.ink3 : colors.green} size={14} strokeWidth={2.4} />}
          label={props.actionLabel === "send" ? "Sending" : "Send"}
          onPress={props.onSend}
        />
        <QuoteFooterAction
          icon={<Edit3 color={colors.ink2} size={14} strokeWidth={2.4} />}
          label="Open"
          onPress={props.onOpen}
        />
        <QuoteFooterAction
          icon={<MoreHorizontal color={colors.ink2} size={15} strokeWidth={2.6} />}
          last
          label="More"
          onPress={props.onMore}
        />
      </View>
    </View>
  );
}

function QuoteFooterAction(props: {
  disabled?: boolean | undefined;
  icon: ReactNode;
  last?: boolean | undefined;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={props.disabled}
      onPress={props.onPress}
      style={[
        styles.quoteFooterAction,
        props.last ? styles.quoteFooterActionLast : null,
        props.disabled ? styles.quoteFooterActionDisabled : null,
      ]}
    >
      {props.icon}
      <AppText style={[styles.quoteFooterActionText, props.disabled ? styles.quoteFooterActionTextDisabled : null]} variant="button">{props.label}</AppText>
    </Pressable>
  );
}

function CustomerEditSheet(props: {
  customer: Customer;
  onClose: () => void;
  onSave: (input: CustomerFormInput) => void | Promise<void>;
  saving: boolean;
}) {
  const [name, setName] = useState(props.customer.name);
  const [email, setEmail] = useState(props.customer.email ?? "");
  const [phone, setPhone] = useState(props.customer.phone ?? "");
  const [address, setAddress] = useState(props.customer.address);
  const [city, setCity] = useState(props.customer.city);
  const [error, setError] = useState<string | null>(null);

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
          <AppText style={styles.sheetTitle} variant="panelTitle">Edit customer</AppText>
          <AppText numberOfLines={1} style={styles.sheetSubtitle} variant="meta">{props.customer.name}</AppText>
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
          <AppText style={styles.primaryActionText} tone="onDark" variant="primaryAction">{props.saving ? "Saving..." : "Save customer"}</AppText>
        </Pressable>
      </ScrollView>
    </AnimatedSheetContent>
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

function actionLabel(activeAction: string | null, quoteId: string): QuoteAction | null {
  if (activeAction === null || !activeAction.startsWith(`${quoteId}:`)) {
    return null;
  }

  return activeAction.slice(quoteId.length + 1) as QuoteAction;
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

function canFollowUp(status: QuoteStatus) {
  return status === "sent" || status === "viewed";
}

function publicQuoteUrl(quote: QuoteRecord): string | null {
  if (quote.publicUrl?.startsWith("http")) {
    return quote.publicUrl;
  }

  return quote.publicToken ? `${apiBaseUrl}/public/quotes/${quote.publicToken}` : null;
}

function followUpAvailability(quote: QuoteRecord) {
  const basis = quote.firstViewedAt ?? quote.sentAt;

  if (basis === null) {
    return "Follow-up starts after this quote is sent.";
  }

  const availableAt = new Date(basis);
  availableAt.setDate(availableAt.getDate() + 3);

  if (availableAt.getTime() <= Date.now()) {
    return "Follow-up due now.";
  }

  return `Follow-up available ${formatShortDate(availableAt.toISOString())}.`;
}

function quoteMeta(quote: QuoteRecord, status: QuoteStatus, stale: boolean) {
  if (status === "draft") {
    const blockers = getQuoteBlockers(quote);
    return blockers.reasons.length === 0 ? "Ready to send" : `${blockers.reasons.length} issue${blockers.reasons.length === 1 ? "" : "s"} to fix`;
  }

  if (canFollowUp(status)) {
    if (stale) {
      return "Follow-up due";
    }

    return followUpAvailability(quote);
  }

  if (status === "accepted" && quote.respondedAt !== null) {
    return `Accepted ${formatRelativeToNow(quote.respondedAt)}`;
  }

  if (status === "declined" && quote.respondedAt !== null) {
    return `Declined ${formatRelativeToNow(quote.respondedAt)}`;
  }

  return `Updated ${formatRelativeToNow(quote.updatedAt)}`;
}

function customerSubtitle(customer: Customer) {
  const city = customer.city.trim() || deriveCustomerCity(customer.address);
  const since = formatShortDate(customer.createdAt);

  return `${city || "No city"} - customer since ${since}`;
}

function quoteStatusLabel(status: QuoteStatus) {
  if (status === "draft") {
    return "Draft";
  }

  if (status === "sent") {
    return "Sent";
  }

  if (status === "viewed") {
    return "Viewed";
  }

  if (status === "accepted") {
    return "Accepted";
  }

  if (status === "declined") {
    return "Declined";
  }

  if (status === "superseded") {
    return "Superseded";
  }

  if (status === "expired") {
    return "Expired";
  }

  return status;
}

function quoteStripeStyle(status: QuoteStatus) {
  if (status === "accepted") {
    return styles.quoteStripeGreen;
  }

  if (status === "draft") {
    return styles.quoteStripeRed;
  }

  if (status === "viewed") {
    return styles.quoteStripeAmber;
  }

  return styles.quoteStripeNeutral;
}

function statusPillStyle(status: QuoteStatus) {
  if (status === "accepted") {
    return styles.statusPillGreen;
  }

  if (status === "declined" || status === "expired") {
    return styles.statusPillRed;
  }

  if (status === "draft") {
    return styles.statusPillRed;
  }

  if (status === "viewed") {
    return styles.statusPillAmber;
  }

  return styles.statusPillNeutral;
}

function statusTextStyle(status: QuoteStatus) {
  if (status === "accepted") {
    return styles.statusTextGreen;
  }

  if (status === "declined" || status === "expired" || status === "draft") {
    return styles.statusTextRed;
  }

  if (status === "viewed") {
    return styles.statusTextAmber;
  }

  return styles.statusTextNeutral;
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

function isLocalQuote(quote: QuoteRecord) {
  return quote.id.startsWith("quote-");
}

function isLocalCustomer(customer: Customer) {
  return customer.id.startsWith("cust-");
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  notFound: {
    padding: 20,
  },
  content: {
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  nav: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  navButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 11,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  navTitleWrap: {
    alignItems: "center",
    flex: 1,
    gap: 2,
    minWidth: 0,
    paddingHorizontal: 12,
  },
  navEyebrow: {
    ...typography.sectionLabel,
    fontSize: 10,
    letterSpacing: 1.8,
  },
  profileHero: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
    paddingHorizontal: 4,
    paddingTop: 7,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: colors.dark,
    borderRadius: 18,
    height: 64,
    justifyContent: "center",
    width: 64,
  },
  avatarText: {
    color: colors.onDark,
    fontSize: 20,
    ...fontStyles.semibold,
  },
  profileCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  customerName: {
    color: colors.ink,
    fontSize: 22,
    ...fontStyles.semibold,
    lineHeight: 27,
  },
  customerLocation: {
    color: colors.ink3,
    fontSize: 13,
    ...fontStyles.regular,
  },
  profileStats: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    overflow: "hidden",
  },
  profileStat: {
    alignItems: "center",
    borderRightColor: colors.border,
    borderRightWidth: 1,
    flex: 1,
    gap: 4,
    paddingVertical: 13,
  },
  profileStatLast: {
    borderRightWidth: 0,
  },
  profileStatValue: {
    color: colors.ink,
    fontSize: 17,
    ...fontStyles.semibold,
  },
  profileStatValueGreen: {
    color: colors.green,
  },
  profileStatLabel: {
    ...typography.sectionLabel,
    fontSize: 10,
    letterSpacing: 1.2,
  },
  contactActions: {
    flexDirection: "row",
    gap: 9,
  },
  contactButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 11,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 7,
    height: 40,
    justifyContent: "center",
  },
  contactButtonText: {
    color: colors.ink,
    fontSize: 13,
    ...fontStyles.semibold,
  },
  section: {
    gap: 8,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 1,
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
    minWidth: 22,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 2,
    textAlign: "center",
  },
  newQuoteButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 13,
    borderStyle: "dashed",
    borderWidth: 1.3,
    flexDirection: "row",
    gap: 8,
    minHeight: 46,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  newQuoteText: {
    color: colors.ink2,
    flexShrink: 1,
    fontSize: 13,
    ...fontStyles.semibold,
  },
  historyList: {
    gap: 10,
  },
  quoteCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 15,
    borderWidth: 1,
    overflow: "hidden",
  },
  quoteMain: {
    alignItems: "center",
    flexDirection: "row",
    minHeight: 86,
  },
  quoteStripe: {
    alignSelf: "stretch",
    width: 5,
  },
  quoteStripeGreen: {
    backgroundColor: colors.green,
  },
  quoteStripeAmber: {
    backgroundColor: colors.amber,
  },
  quoteStripeRed: {
    backgroundColor: colors.red,
  },
  quoteStripeNeutral: {
    backgroundColor: colors.ink3,
  },
  quoteBody: {
    flex: 1,
    gap: 7,
    minWidth: 0,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  quoteTop: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  quoteTitleBlock: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  quoteTitle: {
    ...typography.rowTitle,
    fontSize: 15,
  },
  quoteMeta: {
    ...typography.rowSubtitle,
    fontSize: 11.5,
  },
  quoteRight: {
    alignItems: "flex-end",
    gap: 7,
  },
  quoteAmount: {
    ...typography.amount,
  },
  statusPill: {
    borderRadius: 7,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusPillGreen: {
    backgroundColor: colors.greenBg,
    borderColor: colors.greenBorder,
  },
  statusPillAmber: {
    backgroundColor: colors.amberBg,
    borderColor: colors.amberBorder,
  },
  statusPillRed: {
    backgroundColor: colors.redBg,
    borderColor: colors.redBorder,
  },
  statusPillNeutral: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
  },
  statusText: {
    ...typography.statusPill,
    fontSize: 10,
  },
  statusTextGreen: {
    color: colors.green,
  },
  statusTextAmber: {
    color: colors.amber,
  },
  statusTextRed: {
    color: colors.red,
  },
  statusTextNeutral: {
    color: colors.ink2,
  },
  blockerText: {
    color: colors.red,
    fontSize: 12,
    ...fontStyles.semibold,
  },
  reminderText: {
    color: colors.amber,
    fontSize: 12,
    ...fontStyles.semibold,
  },
  quoteFooter: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    minHeight: 46,
  },
  quoteFooterAction: {
    alignItems: "center",
    borderRightColor: colors.border,
    borderRightWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
  },
  quoteFooterActionLast: {
    borderRightWidth: 0,
  },
  quoteFooterActionDisabled: {
    opacity: 0.55,
  },
  quoteFooterActionText: {
    color: colors.ink2,
    fontSize: 12,
    ...fontStyles.semibold,
  },
  quoteFooterActionTextDisabled: {
    color: colors.ink3,
  },
  emptyHistory: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    gap: 5,
    padding: 16,
  },
  emptyHistoryTitle: {
    color: colors.ink,
    fontSize: 16,
    ...fontStyles.semibold,
  },
  emptyHistoryText: {
    color: colors.ink2,
    fontSize: 13,
    ...fontStyles.regular,
    lineHeight: 18,
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
});
