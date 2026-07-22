import { useState } from "react";
import { router } from "expo-router";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { snapquoteApi, userFacingErrorMessage } from "../../src/lib/api";
import { Field, PrimaryButton, Screen, TopBar } from "../../src/ui/components";
import { spacing } from "../../src/ui/theme";
import { useMvpStore } from "../../src/state/mvp";

export default function EditSettingsScreen() {
  const currentBusinessName = useMvpStore((state) => state.businessName);
  const currentTaxRate = useMvpStore((state) => state.defaultTaxRate);
  const currentTerms = useMvpStore((state) => state.defaultTerms);
  const currentQuoteValidDays = useMvpStore((state) => state.quoteValidDays);
  const updateOrgSettings = useMvpStore((state) => state.updateOrgSettings);

  const [businessName, setBusinessName] = useState(currentBusinessName);
  const [taxRate, setTaxRate] = useState(String(Math.round(currentTaxRate * 100)));
  const [quoteValidDays, setQuoteValidDays] = useState(String(currentQuoteValidDays));
  const [defaultTerms, setDefaultTerms] = useState(currentTerms);
  const [saving, setSaving] = useState(false);

  async function save() {
    const parsedTax = Number(taxRate);
    const parsedDays = Number(quoteValidDays);

    if (businessName.trim().length === 0) {
      Alert.alert("Business name required", "Add the name that should appear on quotes.");
      return;
    }

    if (!Number.isFinite(parsedTax) || parsedTax < 0 || parsedTax > 100) {
      Alert.alert("Check tax rate", "Enter tax as a percentage from 0 to 100.");
      return;
    }

    if (!Number.isInteger(parsedDays) || parsedDays < 1 || parsedDays > 365) {
      Alert.alert("Check quote validity", "Enter a whole number of days from 1 to 365.");
      return;
    }

    setSaving(true);

    try {
      const me = await snapquoteApi.updateMe({
        businessName: businessName.trim(),
        defaultTaxRate: parsedTax / 100,
        quoteValidDays: parsedDays,
        defaultTerms: defaultTerms.trim()
      });
      updateOrgSettings({
        businessName: me.org.name,
        defaultTaxRate: me.org.defaultTaxRate,
        quoteValidDays: me.org.quoteValidDays,
        defaultTerms: me.org.defaultTerms
      });
      router.back();
    } catch (error) {
      Alert.alert("Could not save settings", userFacingErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <TopBar title="Business details" onBack={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.keyboard}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Field label="Business name" onChangeText={setBusinessName} value={businessName} />
          <View style={styles.row}>
            <View style={styles.rowItem}>
              <Field keyboardType="decimal-pad" label="Tax %" onChangeText={setTaxRate} value={taxRate} />
            </View>
            <View style={styles.rowItem}>
              <Field keyboardType="number-pad" label="Quote valid days" onChangeText={setQuoteValidDays} value={quoteValidDays} />
            </View>
          </View>
          <Field
            label="Default terms"
            multiline
            onChangeText={setDefaultTerms}
            value={defaultTerms}
          />
        </ScrollView>
      </KeyboardAvoidingView>
      <View style={styles.footer}>
        <PrimaryButton disabled={saving} label={saving ? "Saving..." : "Save changes"} onPress={() => void save()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  keyboard: {
    flex: 1
  },
  content: {
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.xxl
  },
  row: {
    flexDirection: "row",
    gap: spacing.md
  },
  rowItem: {
    flex: 1
  },
  footer: {
    padding: spacing.lg
  }
});
