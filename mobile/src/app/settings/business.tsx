import { useState } from "react";
import { router } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { ChevronLeft } from "lucide-react-native";
import { snapquoteApi, userFacingErrorMessage } from "../../api/client";
import { useAuthStore } from "../../auth/authStore";
import { useQuoteStore } from "../../state/quoteStore";
import { Screen } from "../../components/base";
import { colors, radius } from "../../components/theme";

export default function BusinessSettingsScreen() {
  const authStatus = useAuthStore((state) => state.status);
  const setMe = useAuthStore((state) => state.setMe);
  const businessName = useQuoteStore((state) => state.businessName);
  const defaultTaxRate = useQuoteStore((state) => state.defaultTaxRate);
  const defaultTerms = useQuoteStore((state) => state.defaultTerms);
  const quoteValidDays = useQuoteStore((state) => state.quoteValidDays);
  const updateOrgSettings = useQuoteStore((state) => state.updateOrgSettings);
  const [name, setName] = useState(businessName);
  const [taxRate, setTaxRate] = useState(String(Math.round(defaultTaxRate * 100)));
  const [validDays, setValidDays] = useState(String(quoteValidDays));
  const [terms, setTerms] = useState(defaultTerms);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (saving) {
      return;
    }

    const patch = {
      businessName: name.trim(),
      defaultTaxRate: (Number(taxRate) || 0) / 100,
      defaultTerms: terms.trim(),
      quoteValidDays: Number.parseInt(validDays, 10) || 14,
    };

    setSaving(true);

    try {
      if (authStatus === "signed_in") {
        const response = await snapquoteApi.updateMe(patch);
        updateOrgSettings({
          businessName: response.org.name,
          defaultTaxRate: response.org.defaultTaxRate,
          defaultTerms: response.org.defaultTerms,
          quoteValidDays: response.org.quoteValidDays,
        });
        setMe(response);
      } else {
        updateOrgSettings(patch);
      }

      router.back();
    } catch (error) {
      Alert.alert("Could not save business details", userFacingErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.nav}>
          <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.back()} style={styles.navButton}>
            <ChevronLeft color={colors.ink} size={20} strokeWidth={2.4} />
          </Pressable>
          <Text style={styles.navTitle}>Business</Text>
          <View style={styles.navButtonGhost} />
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>Business details</Text>
          <Text style={styles.subtitle}>
            These defaults print on quotes and set the totals SnapQuote calculates.
          </Text>
        </View>

        <View style={styles.card}>
          <Field label="Business name" onChangeText={setName} placeholder="Add business name" value={name} />
          <View style={styles.inlineFields}>
            <Field
              keyboardType="numeric"
              label="Tax %"
              onChangeText={setTaxRate}
              value={taxRate}
            />
            <Field
              keyboardType="numeric"
              label="Quote valid days"
              onChangeText={setValidDays}
              value={validDays}
            />
          </View>
          <Field label="Default terms" multiline onChangeText={setTerms} value={terms} />
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={saving}
          onPress={() => void save()}
          style={[styles.saveButton, saving ? styles.saveButtonDisabled : null]}
        >
          <Text style={styles.saveText}>{saving ? "Saving..." : "Save changes"}</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: "default" | "numeric" | undefined;
  multiline?: boolean | undefined;
  placeholder?: string | undefined;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        keyboardType={props.keyboardType ?? "default"}
        multiline={props.multiline}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={colors.ink3}
        style={[styles.input, props.multiline ? styles.inputMultiline : null]}
        textAlignVertical={props.multiline ? "top" : "center"}
        value={props.value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 20,
    paddingBottom: 26,
    paddingHorizontal: 20,
    paddingTop: 20,
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
    borderRadius: 10,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  navButtonGhost: {
    height: 36,
    width: 36,
  },
  navTitle: {
    color: colors.ink3,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  header: {
    gap: 7,
  },
  title: {
    color: colors.ink,
    fontSize: 29,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 34,
  },
  subtitle: {
    color: colors.ink2,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: 14,
    padding: 14,
  },
  inlineFields: {
    flexDirection: "row",
    gap: 12,
  },
  field: {
    flex: 1,
    gap: 7,
  },
  label: {
    color: colors.ink3,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 11,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    fontWeight: "700",
    minHeight: 50,
    paddingHorizontal: 13,
  },
  inputMultiline: {
    minHeight: 132,
    paddingTop: 13,
  },
  saveButton: {
    alignItems: "center",
    backgroundColor: colors.dark,
    borderRadius: 12,
    height: 56,
    justifyContent: "center",
  },
  saveButtonDisabled: {
    opacity: 0.65,
  },
  saveText: {
    color: colors.onDark,
    fontSize: 16,
    fontWeight: "900",
  },
});
