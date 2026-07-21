import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  centsToDollars,
  defaultCorePrices,
  dollarsToCents,
  useMvpStore
} from "../src/state/mvp";

export default function OnboardingScreen() {
  const completeOnboarding = useMvpStore((state) => state.completeOnboarding);
  const [businessName, setBusinessName] = useState("Sharp Edge Painting");
  const [taxRate, setTaxRate] = useState("13");
  const [wallsMedium, setWallsMedium] = useState(centsToDollars(defaultCorePrices.paintWalls.medium));
  const [ceilingMedium, setCeilingMedium] = useState(
    centsToDollars(defaultCorePrices.paintCeiling.medium)
  );
  const [trimMedium, setTrimMedium] = useState(centsToDollars(defaultCorePrices.paintTrim.medium));
  const [doorEach, setDoorEach] = useState(centsToDollars(defaultCorePrices.paintDoorEachCents));
  const [prepHourly, setPrepHourly] = useState(
    centsToDollars(defaultCorePrices.heavyPrepHourlyCents)
  );

  function save() {
    completeOnboarding({
      businessName,
      defaultTaxRate: Number(taxRate) / 100,
      corePrices: {
        paintWalls: roomPrices(dollarsToCents(wallsMedium)),
        paintCeiling: roomPrices(dollarsToCents(ceilingMedium)),
        paintTrim: roomPrices(dollarsToCents(trimMedium)),
        paintDoorEachCents: dollarsToCents(doorEach),
        heavyPrepHourlyCents: dollarsToCents(prepHourly)
      }
    });
    router.replace("/");
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>Painter Setup</Text>
        <Text style={styles.title}>Confirm your core prices</Text>

        <Field label="Business name" value={businessName} onChangeText={setBusinessName} />
        <Field label="Tax %" value={taxRate} onChangeText={setTaxRate} keyboardType="numeric" />
        <Field label="Walls, medium room $" value={wallsMedium} onChangeText={setWallsMedium} />
        <Field
          label="Ceiling, medium room $"
          value={ceilingMedium}
          onChangeText={setCeilingMedium}
        />
        <Field label="Trim, medium room $" value={trimMedium} onChangeText={setTrimMedium} />
        <Field label="Door, each $" value={doorEach} onChangeText={setDoorEach} />
        <Field label="Heavy prep, hourly $" value={prepHourly} onChangeText={setPrepHourly} />

        <Text style={styles.helper}>
          Small and large prices are derived from these visible defaults for the demo. The backend
          stores explicit prices, not AI guesses.
        </Text>

        <Pressable accessibilityRole="button" style={styles.primaryAction} onPress={save}>
          <Text style={styles.primaryActionText}>Save Prices</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: "default" | "numeric";
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        keyboardType={props.keyboardType ?? "default"}
        onChangeText={props.onChangeText}
        style={styles.input}
        value={props.value}
      />
    </View>
  );
}

function roomPrices(medium: number) {
  return {
    small: Math.round(medium * 0.65),
    medium,
    large: Math.round(medium * 1.55)
  };
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f6f7f9"
  },
  content: {
    gap: 14,
    padding: 20
  },
  kicker: {
    color: "#475467",
    fontSize: 14,
    fontWeight: "800"
  },
  title: {
    color: "#101828",
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 0
  },
  field: {
    gap: 6
  },
  label: {
    color: "#344054",
    fontSize: 14,
    fontWeight: "800"
  },
  input: {
    backgroundColor: "#ffffff",
    borderColor: "#d0d5dd",
    borderRadius: 8,
    borderWidth: 1,
    color: "#101828",
    fontSize: 17,
    minHeight: 50,
    paddingHorizontal: 14
  },
  helper: {
    color: "#475467",
    fontSize: 14,
    lineHeight: 20
  },
  primaryAction: {
    alignItems: "center",
    backgroundColor: "#101828",
    borderRadius: 8,
    height: 56,
    justifyContent: "center",
    marginTop: 4
  },
  primaryActionText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900"
  }
});
