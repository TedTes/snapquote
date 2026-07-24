import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getTradeConfig, type PainterCorePriceInput, type ServicePriceSuggestion } from "@snapquote/shared";
import { snapquoteApi, userFacingErrorMessage } from "../api/client";
import { useAuthStore } from "../auth/authStore";
import {
  centsToDollars,
  defaultCorePrices,
  dollarsToCents,
  useQuoteStore,
} from "../state/quoteStore";

export default function OnboardingScreen() {
  const completeOnboarding = useQuoteStore((state) => state.completeOnboarding);
  const authStatus = useAuthStore((state) => state.status);
  const authMe = useAuthStore((state) => state.me);
  const storedDefaultTerms = useQuoteStore((state) => state.defaultTerms);
  const storedQuoteValidDays = useQuoteStore((state) => state.quoteValidDays);
  const activeTrade = useQuoteStore((state) => state.activeTrade);
  const tradeConfig = getTradeConfig(activeTrade);
  const hasEditedCorePrices = useRef(false);
  const [businessName, setBusinessName] = useState("");
  const [taxRate, setTaxRate] = useState("13");
  const [defaultTerms, setDefaultTerms] = useState(storedDefaultTerms);
  const [quoteValidDays, setQuoteValidDays] = useState(String(storedQuoteValidDays));
  const [suggestionNotice, setSuggestionNotice] = useState<string | null>(null);
  const [corePriceValues, setCorePriceValues] = useState<
    Record<keyof PainterCorePriceInput, string>
  >({
    paintWalls: centsToDollars(defaultCorePrices.paintWalls.medium),
    paintCeiling: centsToDollars(defaultCorePrices.paintCeiling.medium),
    paintTrim: centsToDollars(defaultCorePrices.paintTrim.medium),
    paintDoorEachCents: centsToDollars(defaultCorePrices.paintDoorEachCents),
    heavyPrepHourlyCents: centsToDollars(defaultCorePrices.heavyPrepHourlyCents),
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (authStatus !== "signed_in") {
      return;
    }

    let cancelled = false;

    async function loadPricingSuggestions() {
      try {
        const response = await snapquoteApi.listPricingSuggestions({ trade: activeTrade });
        const suggestedValues = corePriceValuesFromSuggestions(response.suggestions);

        if (!cancelled && suggestedValues && !hasEditedCorePrices.current) {
          setCorePriceValues(suggestedValues);
          setSuggestionNotice("Published starter suggestions loaded. Confirm or edit before use.");
        }
      } catch {
        if (!cancelled) {
          setSuggestionNotice(null);
        }
      }
    }

    void loadPricingSuggestions();

    return () => {
      cancelled = true;
    };
  }, [activeTrade, authStatus]);

  function updateCorePrice(
    key: keyof PainterCorePriceInput,
    value: string,
  ) {
    hasEditedCorePrices.current = true;
    setCorePriceValues((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    if (saving) {
      return;
    }

    const payload = {
      businessName: businessName.trim(),
      defaultTaxRate: Number(taxRate) / 100,
      defaultTerms: defaultTerms.trim(),
      quoteValidDays: Number.parseInt(quoteValidDays, 10) || 14,
      corePrices: corePricesFromValues(corePriceValues),
    };

    setSaving(true);

    try {
      if (authStatus !== "signed_in") {
        completeOnboarding(payload);
        router.replace("/");
        return;
      }

      const response = await snapquoteApi.onboardPainter(payload);
      const completedOrg = {
        ...response.org,
        setupCompletedAt: response.org.setupCompletedAt ?? new Date().toISOString(),
      };

      completeOnboarding({
        ...payload,
        businessName: completedOrg.name,
        defaultTaxRate: completedOrg.defaultTaxRate,
        defaultTerms: completedOrg.defaultTerms,
        quoteValidDays: completedOrg.quoteValidDays,
        priceBookItems: response.priceBookItems,
      });

      if (authMe) {
        useAuthStore.setState({
          me: {
            ...authMe,
            org: completedOrg,
          },
        });
      }

      router.replace("/");
    } catch (error) {
      Alert.alert("Could not save setup", userFacingErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  function saveLocalOnly() {
    completeOnboarding({
      businessName: businessName.trim(),
      defaultTaxRate: Number(taxRate) / 100,
      defaultTerms: defaultTerms.trim(),
      quoteValidDays: Number.parseInt(quoteValidDays, 10) || 14,
      corePrices: corePricesFromValues(corePriceValues),
    });
    router.replace("/");
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>Setup</Text>
        <Text style={styles.title}>{tradeConfig.setup.title}</Text>
        <Text style={styles.helper}>
          {authStatus === "signed_in"
            ? tradeConfig.setup.signedInHelper
            : tradeConfig.setup.offlineHelper}
        </Text>
        {suggestionNotice ? <Text style={styles.suggestionNotice}>{suggestionNotice}</Text> : null}

        <Field
          label="Business name"
          placeholder="e.g. Brightline Services"
          value={businessName}
          onChangeText={setBusinessName}
        />
        <Field
          label="Tax %"
          value={taxRate}
          onChangeText={setTaxRate}
          keyboardType="numeric"
        />
        <Field
          label="Quote valid days"
          value={quoteValidDays}
          onChangeText={setQuoteValidDays}
          keyboardType="numeric"
        />
        <Field
          label="Default terms"
          value={defaultTerms}
          onChangeText={setDefaultTerms}
          multiline
        />
        {tradeConfig.setup.corePriceFields.map((field) => (
          <Field
            key={field.key}
            label={field.label}
            value={corePriceValues[field.key]}
            onChangeText={(value) => updateCorePrice(field.key, value)}
          />
        ))}

        <Text style={styles.helper}>
          {tradeConfig.setup.derivedPriceHelper}
        </Text>

        <Pressable
          accessibilityRole="button"
          disabled={saving}
          style={[
            styles.primaryAction,
            saving ? styles.primaryActionDisabled : null,
          ]}
          onPress={() => void save()}
        >
          <Text style={styles.primaryActionText}>
            {saving ? "Saving..." : tradeConfig.setup.saveButtonLabel}
          </Text>
        </Pressable>
        {authStatus === "signed_in" ? null : (
          <Pressable
            accessibilityRole="button"
            disabled={saving}
            onPress={saveLocalOnly}
            style={styles.secondaryAction}
          >
            <Text style={styles.secondaryActionText}>Continue offline</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: "default" | "numeric";
  placeholder?: string | undefined;
  multiline?: boolean | undefined;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        keyboardType={props.keyboardType ?? "default"}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor="#98a2b3"
        multiline={props.multiline}
        style={[styles.input, props.multiline ? styles.inputMultiline : null]}
        textAlignVertical={props.multiline ? "top" : "center"}
        value={props.value}
      />
    </View>
  );
}

function corePricesFromValues(
  values: Record<keyof PainterCorePriceInput, string>,
): PainterCorePriceInput {
  return {
    paintWalls: roomPrices(dollarsToCents(values.paintWalls)),
    paintCeiling: roomPrices(dollarsToCents(values.paintCeiling)),
    paintTrim: roomPrices(dollarsToCents(values.paintTrim)),
    paintDoorEachCents: dollarsToCents(values.paintDoorEachCents),
    heavyPrepHourlyCents: dollarsToCents(values.heavyPrepHourlyCents),
  };
}

function roomPrices(medium: number) {
  return {
    small: Math.round(medium * 0.65),
    medium,
    large: Math.round(medium * 1.55),
  };
}

function corePriceValuesFromSuggestions(
  suggestions: ServicePriceSuggestion[],
): Record<keyof PainterCorePriceInput, string> | null {
  const byKey = new Map(suggestions.map((suggestion) => [suggestion.templateKey, suggestion]));
  const paintWalls = roomMediumPrice(byKey.get("paint_walls"));
  const paintCeiling = roomMediumPrice(byKey.get("paint_ceiling"));
  const paintTrim = roomMediumPrice(byKey.get("paint_trim"));
  const paintDoorEachCents = fixedPrice(byKey.get("paint_door"));
  const heavyPrepHourlyCents = fixedPrice(byKey.get("heavy_wall_prep"));

  if (
    paintWalls === null ||
    paintCeiling === null ||
    paintTrim === null ||
    paintDoorEachCents === null ||
    heavyPrepHourlyCents === null
  ) {
    return null;
  }

  return {
    paintWalls: centsToDollars(paintWalls),
    paintCeiling: centsToDollars(paintCeiling),
    paintTrim: centsToDollars(paintTrim),
    paintDoorEachCents: centsToDollars(paintDoorEachCents),
    heavyPrepHourlyCents: centsToDollars(heavyPrepHourlyCents),
  };
}

function roomMediumPrice(suggestion: ServicePriceSuggestion | undefined): number | null {
  if (!suggestion || suggestion.pricing.type !== "room_size") {
    return null;
  }

  return suggestion.pricing.prices.medium;
}

function fixedPrice(suggestion: ServicePriceSuggestion | undefined): number | null {
  if (!suggestion || suggestion.pricing.type !== "fixed") {
    return null;
  }

  return suggestion.pricing.unitPriceCents;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f6f7f9",
  },
  content: {
    gap: 14,
    padding: 20,
  },
  kicker: {
    color: "#475467",
    fontSize: 14,
    fontWeight: "800",
  },
  title: {
    color: "#101828",
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 0,
  },
  field: {
    gap: 6,
  },
  label: {
    color: "#344054",
    fontSize: 14,
    fontWeight: "800",
  },
  input: {
    backgroundColor: "#ffffff",
    borderColor: "#d0d5dd",
    borderRadius: 8,
    borderWidth: 1,
    color: "#101828",
    fontSize: 17,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  inputMultiline: {
    minHeight: 106,
    paddingTop: 13,
  },
  helper: {
    color: "#475467",
    fontSize: 14,
    lineHeight: 20,
  },
  suggestionNotice: {
    color: "#2E7D5B",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  primaryAction: {
    alignItems: "center",
    backgroundColor: "#101828",
    borderRadius: 8,
    height: 56,
    justifyContent: "center",
    marginTop: 4,
  },
  primaryActionDisabled: {
    opacity: 0.65,
  },
  primaryActionText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
  },
  secondaryAction: {
    alignItems: "center",
    paddingVertical: 12,
  },
  secondaryActionText: {
    color: "#475467",
    fontSize: 14,
    fontWeight: "800",
  },
});
