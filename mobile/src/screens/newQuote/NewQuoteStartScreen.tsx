import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Mail, MapPin, Phone, User, X } from "lucide-react-native";
import { router } from "expo-router";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { Customer } from "@snapquote/shared";
import { AnimatedScreenContent } from "../../shared-ui/AnimatedScreenContent";
import { Screen } from "../../shared-ui/base";
import { NewQuoteHeader, NewQuoteTitle, SectionKicker, StickyAction } from "./components/NewQuoteScaffold";
import { colors } from "../../shared-ui/theme";
import { useQuoteStore } from "../../state/quoteStore";

const MIN_SEARCH_LENGTH = 2;
const MAX_SUGGESTIONS = 5;

export default function NewQuoteCustomerScreen() {
  const wizard = useQuoteStore((state) => state.wizard);
  const updateWizard = useQuoteStore((state) => state.updateWizard);
  const customers = useQuoteStore((state) => state.customers);

  const [name, setName] = useState(wizard.customerName);
  const [phone, setPhone] = useState(wizard.customerPhone);
  const [email, setEmail] = useState(wizard.customerEmail);
  const [address, setAddress] = useState(wizard.address);
  const [jobTitle, setJobTitle] = useState(wizard.jobTitle);
  const [showNameError, setShowNameError] = useState(false);
  const [showPhoneError, setShowPhoneError] = useState(false);
  const [showAddressError, setShowAddressError] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(wizard.customerId);

  const selectedCustomer = useMemo(
    () => (selectedCustomerId !== null ? customers.find((candidate) => candidate.id === selectedCustomerId) ?? null : null),
    [selectedCustomerId, customers]
  );

  const suggestions = useMemo(() => {
    if (selectedCustomer !== null) {
      return [];
    }

    const term = name.trim().toLowerCase();

    if (term.length < MIN_SEARCH_LENGTH) {
      return [];
    }

    return customers.filter((customer) => customer.name.toLowerCase().includes(term)).slice(0, MAX_SUGGESTIONS);
  }, [name, customers, selectedCustomer]);

  function pickCustomer(customer: Customer) {
    setSelectedCustomerId(customer.id);
    setName(customer.name);
    setPhone(customer.phone ?? "");
    setEmail(customer.email ?? "");
    setShowNameError(false);
    setShowPhoneError(false);

    if (address.trim().length === 0) {
      setAddress(customer.address);
    }
  }

  function clearSelectedCustomer() {
    setSelectedCustomerId(null);
  }

  function cancelQuote() {
    Alert.alert("Cancel quote?", "The details on this new quote will be cleared.", [
      { text: "Keep editing", style: "cancel" },
      {
        text: "Cancel quote",
        style: "destructive",
        onPress: () => router.replace("/")
      }
    ]);
  }

  function next() {
    const trimmedEmail = email.trim();
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const phoneDigits = trimmedPhone.replace(/\D/g, "");
    const hasNameError = trimmedName.length === 0;
    const hasPhoneError = trimmedPhone.length > 0 && phoneDigits.length < 7;
    const hasAddressError = address.trim().length === 0;

    setShowNameError(hasNameError);
    setShowPhoneError(hasPhoneError);
    setShowAddressError(hasAddressError);

    if (hasNameError || hasPhoneError || hasAddressError) {
      return;
    }

    if (trimmedEmail.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      Alert.alert("Check the email", "You can leave email blank for now, or enter a valid address.");
      return;
    }

    updateWizard({
      customerId: selectedCustomerId,
      customerName: trimmedName,
      customerPhone: trimmedPhone,
      customerEmail: trimmedEmail,
      address: address.trim(),
      jobTitle: jobTitle.trim()
    });
    router.push("/new-quote/checklist");
  }

  return (
    <Screen edges={["top"]}>
      <NewQuoteHeader close onBack={cancelQuote} step={1} />
      <AnimatedScreenContent contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <NewQuoteTitle title="Who's it for?" />

        <FieldBlock label="Customer name">
          {selectedCustomer !== null ? (
            <View style={styles.linkedCustomer}>
              <View style={styles.linkedCustomerIcon}>
                <User color={colors.ink2} size={14} strokeWidth={2.2} />
              </View>
              <View style={styles.linkedCustomerText}>
                <Text style={styles.linkedCustomerName} numberOfLines={1}>{selectedCustomer.name}</Text>
                <Text style={styles.linkedCustomerHint}>Existing customer</Text>
              </View>
              <Pressable accessibilityRole="button" hitSlop={8} onPress={clearSelectedCustomer} style={styles.linkedCustomerClear}>
                <X color={colors.ink3} size={16} strokeWidth={2.4} />
              </Pressable>
            </View>
          ) : (
            <>
              <TextInput
                onChangeText={(value) => {
                  setName(value);
                  setShowNameError(false);
                }}
                placeholder="Full name"
                placeholderTextColor={colors.ink3}
                style={styles.input}
                value={name}
              />
              {showNameError ? (
                <Text style={styles.fieldError}>Customer name is required before the checklist.</Text>
              ) : null}
              {suggestions.length > 0 ? (
                <View style={styles.suggestions}>
                  {suggestions.map((customer) => (
                    <Pressable
                      accessibilityRole="button"
                      key={customer.id}
                      onPress={() => pickCustomer(customer)}
                      style={styles.suggestionRow}
                    >
                      <User color={colors.ink3} size={13} strokeWidth={2.2} />
                      <View style={styles.suggestionText}>
                        <Text numberOfLines={1} style={styles.suggestionName}>{customer.name}</Text>
                        <Text numberOfLines={1} style={styles.suggestionAddress}>{customer.address}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </>
          )}
        </FieldBlock>

        <FieldBlock label="Phone">
          <View style={[styles.inputWithIcon, selectedCustomer !== null ? styles.inputDisabled : null]}>
            <Phone color={colors.ink3} size={15} strokeWidth={2} />
            <TextInput
              editable={selectedCustomer === null}
              keyboardType="phone-pad"
              onChangeText={(value) => {
                setPhone(value);
                setShowPhoneError(false);
              }}
              placeholder="Mobile"
              placeholderTextColor={colors.ink3}
              style={styles.inputEmbedded}
              value={phone}
            />
          </View>
          {showPhoneError ? (
            <Text style={styles.fieldError}>Enter at least 7 digits, or leave phone blank.</Text>
          ) : null}
        </FieldBlock>

        <FieldBlock label="Email · sends the quote">
          <View style={[styles.inputWithIcon, selectedCustomer !== null ? styles.inputDisabled : null]}>
            <Mail color={colors.ink3} size={15} strokeWidth={2} />
            <TextInput
              autoCapitalize="none"
              editable={selectedCustomer === null}
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="name@email.com"
              placeholderTextColor={colors.ink3}
              style={styles.inputEmbedded}
              value={email}
            />
          </View>
        </FieldBlock>

        <FieldBlock label="Job address">
          <View style={styles.inputWithIcon}>
            <MapPin color={colors.ink3} size={15} strokeWidth={2} />
            <TextInput
              onChangeText={setAddress}
              onFocus={() => setShowAddressError(false)}
              placeholder="Street, city"
              placeholderTextColor={colors.ink3}
              style={styles.inputEmbedded}
              value={address}
            />
          </View>
          {showAddressError ? (
            <Text style={styles.fieldError}>Job address is required before the checklist.</Text>
          ) : null}
        </FieldBlock>

        <FieldBlock label="Job title · optional">
          <TextInput
            onChangeText={setJobTitle}
            placeholder="e.g. Interior repaint"
            placeholderTextColor={colors.ink3}
            style={styles.input}
            value={jobTitle}
          />
        </FieldBlock>
      </AnimatedScreenContent>
      <StickyAction label="Next — the job" onPress={next} />
    </Screen>
  );
}

function FieldBlock(props: { label: string; children: ReactNode }) {
  return (
    <View style={styles.fieldBlock}>
      <SectionKicker>{props.label}</SectionKicker>
      {props.children}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    gap: 14,
    paddingBottom: 24,
    paddingTop: 21
  },
  fieldBlock: {
    gap: 7,
    paddingHorizontal: 19
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 15,
    fontWeight: "600",
    height: 43,
    paddingHorizontal: 13
  },
  inputWithIcon: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 9,
    height: 43,
    paddingHorizontal: 12
  },
  inputEmbedded: {
    color: colors.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    paddingVertical: 0
  },
  inputDisabled: {
    backgroundColor: colors.surfaceMuted
  },
  linkedCustomer: {
    alignItems: "center",
    backgroundColor: colors.greenBg,
    borderColor: colors.greenBorder,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    height: 50,
    paddingHorizontal: 12
  },
  linkedCustomerIcon: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 8,
    height: 28,
    justifyContent: "center",
    width: 28
  },
  linkedCustomerText: {
    flex: 1,
    gap: 1,
    minWidth: 0
  },
  linkedCustomerName: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800"
  },
  linkedCustomerHint: {
    color: colors.ink2,
    fontSize: 11,
    fontWeight: "700"
  },
  linkedCustomerClear: {
    alignItems: "center",
    height: 28,
    justifyContent: "center",
    width: 28
  },
  suggestions: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden"
  },
  suggestionRow: {
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 9,
    height: 44,
    paddingHorizontal: 12
  },
  suggestionText: {
    flex: 1,
    gap: 0,
    minWidth: 0
  },
  suggestionName: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700"
  },
  suggestionAddress: {
    color: colors.ink3,
    fontSize: 11,
    fontWeight: "600"
  },
  fieldError: {
    color: colors.red,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16
  }
});
