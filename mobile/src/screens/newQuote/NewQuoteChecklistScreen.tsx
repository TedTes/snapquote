import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react-native";
import { router } from "expo-router";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { getTradeConfig, prepLevels } from "@snapquote/shared";
import { AnimatedScreenContent } from "../../shared-ui/AnimatedScreenContent";
import { Screen } from "../../shared-ui/base";
import { NewQuoteHeader, NewQuoteTitle, SectionKicker, StickyAction } from "./components/NewQuoteScaffold";
import { colors } from "../../shared-ui/theme";
import { useQuoteStore } from "../../state/quoteStore";

type PrepLevel = (typeof prepLevels)[number];

export default function NewQuoteChecklistScreen() {
  const wizard = useQuoteStore((state) => state.wizard);
  const updateWizard = useQuoteStore((state) => state.updateWizard);
  const activeTrade = useQuoteStore((state) => state.activeTrade);
  const tradeConfig = getTradeConfig(activeTrade);

  const [small, setSmall] = useState(wizard.checklist.rooms.small);
  const [medium, setMedium] = useState(wizard.checklist.rooms.medium);
  const [large, setLarge] = useState(wizard.checklist.rooms.large);
  const [walls, setWalls] = useState(wizard.checklist.surfaces.walls);
  const [ceilings, setCeilings] = useState(wizard.checklist.surfaces.ceilings);
  const [trim, setTrim] = useState(wizard.checklist.surfaces.trim);
  const [doorCount, setDoorCount] = useState(wizard.checklist.doorCount);
  const [coatCount, setCoatCount] = useState<1 | 2>(wizard.checklist.coatCount);
  const [prepLevel, setPrepLevel] = useState<PrepLevel>(wizard.checklist.prepLevel);
  const [customerSuppliesPaint, setCustomerSuppliesPaint] = useState(wizard.checklist.customerSuppliesPaint);

  const roomTotal = small + medium + large;
  const surfaceCount = [walls, ceilings, trim].filter(Boolean).length;
  const canContinue = roomTotal > 0 && surfaceCount > 0;

  useEffect(() => {
    if (wizard.address.trim().length === 0) {
      router.replace("/new-quote");
    }
  }, [wizard.address]);

  function persistChecklist() {
    updateWizard({
      checklist: {
        rooms: { small, medium, large },
        surfaces: { walls, ceilings, trim },
        doorCount,
        prepLevel,
        coatCount,
        customerSuppliesPaint
      }
    });
  }

  function back() {
    persistChecklist();
    router.back();
  }

  function next() {
    persistChecklist();
    router.push("/new-quote/voice");
  }

  return (
    <Screen edges={["top"]}>
      <NewQuoteHeader onBack={back} step={2} />
      <AnimatedScreenContent contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <NewQuoteTitle
          helper={tradeConfig.checklist.helper}
          title={tradeConfig.checklist.title}
        />

        <View style={styles.group}>
          <SectionKicker>{tradeConfig.checklist.quantitySectionLabel}</SectionKicker>
          <View style={styles.card}>
            {tradeConfig.checklist.quantityRows.map((row, index) => (
              <View key={row.key}>
                {index > 0 ? <Divider /> : null}
                <CountRow
                  label={row.label}
                  onChange={(value) => {
                    if (row.key === "small") setSmall(value);
                    if (row.key === "medium") setMedium(value);
                    if (row.key === "large") setLarge(value);
                  }}
                  value={{ small, medium, large }[row.key]}
                />
              </View>
            ))}
          </View>
        </View>

        <View style={styles.group}>
          <SectionKicker>{tradeConfig.checklist.toggleSectionLabel}</SectionKicker>
          <View style={styles.card}>
            {tradeConfig.checklist.surfaceRows.map((row, index) => (
              <View key={row.key}>
                {index > 0 ? <Divider /> : null}
                <SwitchRow
                  label={row.label}
                  onChange={(value) => {
                    if (row.key === "walls") setWalls(value);
                    if (row.key === "ceilings") setCeilings(value);
                    if (row.key === "trim") setTrim(value);
                  }}
                  value={{ walls, ceilings, trim }[row.key]}
                />
              </View>
            ))}
            {tradeConfig.checklist.countRows.map((row) => (
              <View key={row.key}>
                <Divider />
                <CountRow label={row.label} onChange={setDoorCount} value={doorCount} />
              </View>
            ))}
          </View>
        </View>

        <View style={styles.twoColumn}>
          <View style={styles.segmentGroup}>
            <SectionKicker>{tradeConfig.checklist.coatSectionLabel}</SectionKicker>
            <Segmented
              options={[
                { label: "1", value: 1 },
                { label: "2", value: 2 }
              ]}
              onChange={setCoatCount}
              value={coatCount}
            />
          </View>
          <View style={styles.segmentGroup}>
            <SectionKicker>{tradeConfig.checklist.suppliedBySectionLabel}</SectionKicker>
            <Segmented
              options={[
                { label: tradeConfig.checklist.suppliedByOptions.customer, value: "customer" },
                { label: tradeConfig.checklist.suppliedByOptions.business, value: "me" }
              ]}
              onChange={(value) => setCustomerSuppliesPaint(value === "customer")}
              value={customerSuppliesPaint ? "customer" : "me"}
            />
          </View>
        </View>

        <View style={styles.group}>
          <SectionKicker>{tradeConfig.checklist.prepSectionLabel}</SectionKicker>
          <Segmented
            options={[
              { label: "Light", value: "light" },
              { label: "Normal", value: "normal" },
              { label: "Heavy", value: "heavy" }
            ]}
            onChange={setPrepLevel}
            value={prepLevel}
          />
        </View>
      </AnimatedScreenContent>
      <StickyAction disabled={!canContinue} label="Next — describe it" onPress={next} />
    </Screen>
  );
}

function CountRow(props: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{props.label}</Text>
      <View style={styles.stepper}>
        <Pressable
          accessibilityRole="button"
          disabled={props.value <= 0}
          hitSlop={8}
          onPress={() => props.onChange(Math.max(0, props.value - 1))}
          style={styles.stepperButton}
        >
          <Minus color={props.value <= 0 ? colors.ink3 : colors.ink2} size={15} strokeWidth={2.3} />
        </Pressable>
        <Text style={styles.stepperValue}>{props.value}</Text>
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => props.onChange(props.value + 1)}
          style={styles.stepperButton}
        >
          <Plus color={colors.ink2} size={15} strokeWidth={2.3} />
        </Pressable>
      </View>
    </View>
  );
}

function SwitchRow(props: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{props.label}</Text>
      <Switch
        onValueChange={props.onChange}
        thumbColor={colors.surface}
        trackColor={{ false: colors.borderStrong, true: colors.dark }}
        value={props.value}
      />
    </View>
  );
}

function Segmented<T extends string | number>(props: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segment}>
      {props.options.map((option) => {
        const active = option.value === props.value;

        return (
          <Pressable
            accessibilityRole="button"
            key={String(option.value)}
            onPress={() => props.onChange(option.value)}
            style={[styles.segmentItem, active ? styles.segmentItemActive : null]}
          >
            <Text style={[styles.segmentText, active ? styles.segmentTextActive : null]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  content: {
    gap: 14,
    paddingBottom: 22,
    paddingTop: 21
  },
  group: {
    gap: 7,
    paddingHorizontal: 19
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
    paddingHorizontal: 13
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    height: 62,
    justifyContent: "space-between"
  },
  rowLabel: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "600"
  },
  divider: {
    backgroundColor: colors.border,
    height: 1
  },
  stepper: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 9,
    borderWidth: 1,
    flexDirection: "row",
    height: 38,
    justifyContent: "space-between",
    minWidth: 108
  },
  stepperButton: {
    alignItems: "center",
    height: 36,
    justifyContent: "center",
    width: 35
  },
  stepperValue: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900",
    minWidth: 22,
    textAlign: "center"
  },
  twoColumn: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 19
  },
  segmentGroup: {
    flex: 1,
    gap: 7
  },
  segment: {
    backgroundColor: colors.surface,
    borderRadius: 9,
    flexDirection: "row",
    overflow: "hidden"
  },
  segmentItem: {
    alignItems: "center",
    borderColor: "transparent",
    borderRadius: 0,
    borderWidth: 1,
    flex: 1,
    height: 34,
    justifyContent: "center"
  },
  segmentItemActive: {
    backgroundColor: colors.surface,
    borderColor: colors.ink,
    borderRadius: 0
  },
  segmentText: {
    color: colors.ink2,
    fontSize: 12,
    fontWeight: "800"
  },
  segmentTextActive: {
    color: colors.ink,
    fontWeight: "900"
  }
});
