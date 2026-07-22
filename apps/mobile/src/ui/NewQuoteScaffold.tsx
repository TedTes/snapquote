import type { ReactNode } from "react";
import { ArrowRight, ChevronLeft, X } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "./theme";

const steps = ["Customer", "Job", "Notes", "Review"];

export function NewQuoteHeader(props: {
  step: number;
  onBack: () => void;
  close?: boolean | undefined;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <Pressable accessibilityRole="button" onPress={props.onBack} style={styles.navButton}>
          {props.close ? (
            <X color={colors.ink} size={20} strokeWidth={2.2} />
          ) : (
            <ChevronLeft color={colors.ink} size={19} strokeWidth={2.2} />
          )}
        </Pressable>
        <Text style={styles.eyebrow}>New quote</Text>
        <Text style={styles.stepCount}>{props.step} / 4</Text>
      </View>

      <View style={styles.progressRow}>
        {steps.map((label, index) => {
          const current = index + 1;
          const active = current <= props.step;
          const selected = current === props.step;

          return (
            <View key={label} style={styles.progressItem}>
              <View style={[styles.progressBar, active ? styles.progressBarActive : null]} />
              <Text style={[styles.progressLabel, selected ? styles.progressLabelActive : null]}>{label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function NewQuoteTitle(props: { title: string; helper?: string | undefined }) {
  return (
    <View style={styles.titleBlock}>
      <Text style={styles.title}>{props.title}</Text>
      {props.helper ? <Text style={styles.helper}>{props.helper}</Text> : null}
    </View>
  );
}

export function StickyAction(props: {
  label: string;
  onPress: () => void;
  disabled?: boolean | undefined;
  icon?: boolean | undefined;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <Pressable
        accessibilityRole="button"
        disabled={props.disabled}
        onPress={props.onPress}
        style={[styles.primaryButton, props.disabled ? styles.primaryButtonDisabled : null]}
      >
        <Text style={[styles.primaryText, props.disabled ? styles.primaryTextDisabled : null]}>{props.label}</Text>
        {props.icon !== false ? (
          <ArrowRight
            color={props.disabled ? colors.ink3 : colors.onDark}
            size={16}
            strokeWidth={2.4}
          />
        ) : null}
      </Pressable>
    </View>
  );
}

export function SectionKicker(props: { children: ReactNode }) {
  return <Text style={styles.sectionKicker}>{props.children}</Text>;
}

const styles = StyleSheet.create({
  header: {
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 20
  },
  topRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  navButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 9,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    width: 36
  },
  eyebrow: {
    color: colors.ink3,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2.5,
    textTransform: "uppercase"
  },
  stepCount: {
    color: colors.ink3,
    fontSize: 12,
    fontWeight: "900",
    minWidth: 36,
    textAlign: "right"
  },
  progressRow: {
    flexDirection: "row",
    gap: 5
  },
  progressItem: {
    flex: 1,
    gap: 6
  },
  progressBar: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: 2,
    height: 5
  },
  progressBarActive: {
    backgroundColor: colors.dark
  },
  progressLabel: {
    color: colors.ink3,
    fontSize: 8,
    fontWeight: "800",
    textAlign: "left",
    textTransform: "uppercase"
  },
  progressLabelActive: {
    color: colors.ink,
    fontWeight: "900"
  },
  titleBlock: {
    gap: 8,
    paddingHorizontal: 20
  },
  title: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 0
  },
  helper: {
    color: colors.ink2,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19
  },
  footer: {
    backgroundColor: colors.bg,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 13
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.dark,
    borderRadius: 11,
    flexDirection: "row",
    gap: 9,
    height: 47,
    justifyContent: "center"
  },
  primaryButtonDisabled: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderWidth: 1
  },
  primaryText: {
    color: colors.onDark,
    fontSize: 15,
    fontWeight: "900"
  },
  primaryTextDisabled: {
    color: colors.ink3
  },
  sectionKicker: {
    color: colors.ink3,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase"
  }
});
