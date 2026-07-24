import type { ReactNode } from "react";
import { AlertTriangle, Check, ChevronLeft, CircleDollarSign, Minus, Plus, X } from "lucide-react-native";
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { colors, radius, spacing, toneColors, type BannerTone, type MatchTone } from "./theme";

export function Screen(props: { children: ReactNode; edges?: Edge[] | undefined }) {
  return (
    <SafeAreaView style={styles.screen} edges={props.edges ?? ["top", "bottom"]}>
      {props.children}
    </SafeAreaView>
  );
}

export function TopBar(props: {
  title: string;
  eyebrow?: string | undefined;
  onBack?: (() => void) | undefined;
  backLabel?: string | undefined;
  right?: ReactNode | undefined;
}) {
  return (
    <View style={styles.topBar}>
      <View style={styles.topBarSide}>
        {props.onBack ? (
          <Pressable accessibilityRole="button" hitSlop={10} onPress={props.onBack} style={styles.backButton}>
            <ChevronLeft color={colors.ink2} size={20} />
            <Text style={styles.backLabel}>{props.backLabel ?? "Back"}</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.topBarCenter}>
        {props.eyebrow ? <Text style={styles.eyebrow}>{props.eyebrow}</Text> : null}
        <Text style={styles.topBarTitle} numberOfLines={1}>
          {props.title}
        </Text>
      </View>
      <View style={[styles.topBarSide, styles.topBarSideRight]}>{props.right}</View>
    </View>
  );
}

export function CloseButton(props: { onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" hitSlop={10} onPress={props.onPress} style={styles.closeButton}>
      <X color={colors.ink2} size={18} />
    </Pressable>
  );
}

export function StepBar(props: { step: number; total: number }) {
  const pct = Math.min(100, Math.round((props.step / props.total) * 100));

  return (
    <View style={styles.stepTrack}>
      <View style={[styles.stepFill, { width: `${pct}%` }]} />
    </View>
  );
}

export function SectionLabel(props: { children: string }) {
  return <Text style={styles.sectionLabel}>{props.children}</Text>;
}

export function Field(props: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string | undefined;
  keyboardType?: KeyboardTypeOptions | undefined;
  multiline?: boolean | undefined;
  autoCapitalize?: "none" | "sentences" | "words" | "characters" | undefined;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{props.label}</Text>
      <TextInput
        autoCapitalize={props.autoCapitalize ?? "sentences"}
        keyboardType={props.keyboardType ?? "default"}
        multiline={props.multiline ?? false}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={colors.ink3}
        style={[styles.input, props.multiline ? styles.inputMultiline : null]}
        value={props.value}
      />
    </View>
  );
}

export function Stepper(props: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number | undefined;
  max?: number | undefined;
}) {
  const min = props.min ?? 0;
  const max = props.max ?? 99;

  return (
    <View style={styles.stepperRow}>
      <Text style={styles.stepperLabel}>{props.label}</Text>
      <View style={styles.stepperControl}>
        <Pressable
          accessibilityRole="button"
          disabled={props.value <= min}
          hitSlop={8}
          onPress={() => props.onChange(Math.max(min, props.value - 1))}
          style={[styles.stepperButton, props.value <= min ? styles.stepperButtonDisabled : null]}
        >
          <Minus color={props.value <= min ? colors.ink3 : colors.ink} size={16} />
        </Pressable>
        <Text style={styles.stepperValue}>{props.value}</Text>
        <Pressable
          accessibilityRole="button"
          disabled={props.value >= max}
          hitSlop={8}
          onPress={() => props.onChange(Math.min(max, props.value + 1))}
          style={[styles.stepperButton, props.value >= max ? styles.stepperButtonDisabled : null]}
        >
          <Plus color={props.value >= max ? colors.ink3 : colors.ink} size={16} />
        </Pressable>
      </View>
    </View>
  );
}

export function SegmentedControl<T extends string>(props: {
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
            key={option.value}
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

export function ToggleRow(props: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  helper?: string | undefined;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleTextWrap}>
        <Text style={styles.toggleLabel}>{props.label}</Text>
        {props.helper ? <Text style={styles.toggleHelper}>{props.helper}</Text> : null}
      </View>
      <Switch
        onValueChange={props.onChange}
        thumbColor={colors.surface}
        trackColor={{ false: colors.border, true: colors.dark }}
        value={props.value}
      />
    </View>
  );
}

export function PrimaryButton(props: {
  label: string;
  onPress: () => void;
  disabled?: boolean | undefined;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={props.disabled ?? false}
      onPress={props.onPress}
      style={[styles.primaryButton, props.disabled ? styles.primaryButtonDisabled : null]}
    >
      <Text style={[styles.primaryButtonText, props.disabled ? styles.primaryButtonTextDisabled : null]}>
        {props.label}
      </Text>
    </Pressable>
  );
}

export function GhostButton(props: {
  label: string;
  onPress: () => void;
  tone?: "default" | "danger" | undefined;
  small?: boolean | undefined;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onPress}
      style={[styles.ghostButton, props.small ? styles.ghostButtonSmall : null]}
    >
      <Text style={[styles.ghostButtonText, props.tone === "danger" ? styles.ghostButtonTextDanger : null]}>
        {props.label}
      </Text>
    </Pressable>
  );
}

export function Card(props: { children: ReactNode; style?: object | undefined }) {
  return <View style={[styles.card, props.style]}>{props.children}</View>;
}

export function Chip(props: { tone: MatchTone | "neutral"; label: string }) {
  if (props.tone === "neutral") {
    return (
      <View style={[styles.chip, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
        <Text style={[styles.chipText, { color: colors.ink2 }]}>{props.label}</Text>
      </View>
    );
  }

  const tone = toneColors(props.tone);

  return (
    <View style={[styles.chip, { backgroundColor: tone.bg, borderColor: tone.border }]}>
      <Text style={[styles.chipText, { color: tone.fg }]}>{props.label}</Text>
    </View>
  );
}

export function Banner(props: { tone: BannerTone; children: string }) {
  const palette =
    props.tone === "green"
      ? { bg: colors.greenBg, border: colors.greenBorder, fg: colors.green }
      : props.tone === "amber"
        ? { bg: colors.amberBg, border: colors.amberBorder, fg: colors.amber }
        : props.tone === "red"
          ? { bg: colors.redBg, border: colors.redBorder, fg: colors.red }
          : { bg: colors.surfaceMuted, border: colors.border, fg: colors.ink2 };

  return (
    <View style={[styles.banner, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <Text style={[styles.bannerText, { color: palette.fg }]}>{props.children}</Text>
    </View>
  );
}

export function EmptyState(props: { title: string; text: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>{props.title}</Text>
      <Text style={styles.emptyText}>{props.text}</Text>
    </View>
  );
}

export function KeyValueRow(props: { label: string; value: string; strong?: boolean | undefined }) {
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvLabel}>{props.label}</Text>
      <Text style={[styles.kvValue, props.strong ? styles.kvValueStrong : null]}>{props.value}</Text>
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

/** Notched price-trust tab (green/yellow/red) used on quote line rows. */
export function SwatchTab(props: { tone: MatchTone }) {
  const palette = toneColors(props.tone);

  return (
    <View style={[styles.swatchTab, { backgroundColor: palette.fg }]}>
      {props.tone === "green" ? (
        <Check color={colors.onDark} size={14} strokeWidth={2.4} />
      ) : props.tone === "yellow" ? (
        <AlertTriangle color={colors.onDark} size={14} strokeWidth={2.1} />
      ) : (
        <CircleDollarSign color={colors.onDark} size={14} strokeWidth={2.1} />
      )}
      <View style={[styles.swatchNotch, styles.swatchNotchOne]} />
      <View style={[styles.swatchNotch, styles.swatchNotchTwo]} />
      <View style={[styles.swatchNotch, styles.swatchNotchThree]} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm
  },
  topBarSide: {
    minWidth: 64
  },
  topBarSideRight: {
    alignItems: "flex-end"
  },
  topBarCenter: {
    alignItems: "center",
    flex: 1
  },
  backButton: {
    alignItems: "center",
    flexDirection: "row"
  },
  backLabel: {
    color: colors.ink2,
    fontSize: 15,
    fontWeight: "600"
  },
  closeButton: {
    alignItems: "center",
    aspectRatio: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    justifyContent: "center",
    width: 32
  },
  eyebrow: {
    color: colors.ink3,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  topBarTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "700"
  },
  stepTrack: {
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    height: 4,
    marginHorizontal: spacing.lg,
    overflow: "hidden"
  },
  stepFill: {
    backgroundColor: colors.dark,
    height: "100%"
  },
  sectionLabel: {
    color: colors.ink3,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  field: {
    gap: 6
  },
  fieldLabel: {
    color: colors.ink2,
    fontSize: 13,
    fontWeight: "600"
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: spacing.md
  },
  inputMultiline: {
    minHeight: 120,
    paddingTop: spacing.md,
    textAlignVertical: "top"
  },
  stepperRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  stepperLabel: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "600"
  },
  stepperControl: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row"
  },
  stepperButton: {
    alignItems: "center",
    height: 34,
    justifyContent: "center",
    width: 34
  },
  stepperButtonDisabled: {
    opacity: 0.4
  },
  stepperValue: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "700",
    minWidth: 26,
    textAlign: "center"
  },
  segment: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    overflow: "hidden",
    padding: 3
  },
  segmentItem: {
    alignItems: "center",
    borderRadius: radius.sm - 3,
    flex: 1,
    paddingVertical: 9
  },
  segmentItemActive: {
    backgroundColor: colors.surface,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2
  },
  segmentText: {
    color: colors.ink2,
    fontSize: 13,
    fontWeight: "600"
  },
  segmentTextActive: {
    color: colors.ink,
    fontWeight: "700"
  },
  toggleRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  toggleTextWrap: {
    flex: 1,
    gap: 2,
    paddingRight: spacing.md
  },
  toggleLabel: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "600"
  },
  toggleHelper: {
    color: colors.ink3,
    fontSize: 12,
    lineHeight: 16
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.dark,
    borderRadius: radius.sm,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: spacing.lg
  },
  primaryButtonDisabled: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderWidth: 1
  },
  primaryButtonText: {
    color: colors.onDark,
    fontSize: 16,
    fontWeight: "700"
  },
  primaryButtonTextDisabled: {
    color: colors.ink3
  },
  ghostButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: spacing.lg
  },
  ghostButtonSmall: {
    minHeight: 38,
    paddingHorizontal: spacing.md
  },
  ghostButtonText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "700"
  },
  ghostButtonTextDanger: {
    color: colors.red
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md
  },
  chip: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4
  },
  chipText: {
    fontSize: 11,
    fontWeight: "700"
  },
  banner: {
    borderRadius: radius.sm,
    borderWidth: 1,
    padding: spacing.md
  },
  bannerText: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18
  },
  emptyState: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 4,
    padding: spacing.lg
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "700"
  },
  emptyText: {
    color: colors.ink2,
    fontSize: 13,
    lineHeight: 18
  },
  kvRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  kvLabel: {
    color: colors.ink2,
    flex: 1,
    fontSize: 14,
    paddingRight: spacing.sm
  },
  kvValue: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "600"
  },
  kvValueStrong: {
    fontSize: 17,
    fontWeight: "800"
  },
  divider: {
    backgroundColor: colors.border,
    height: 1,
    marginVertical: spacing.sm
  },
  swatchTab: {
    alignItems: "center",
    alignSelf: "stretch",
    justifyContent: "center",
    position: "relative",
    width: 43
  },
  swatchNotch: {
    backgroundColor: colors.surface,
    borderRadius: 999,
    height: 7,
    position: "absolute",
    right: -3,
    width: 7
  },
  swatchNotchOne: {
    top: 14
  },
  swatchNotchTwo: {
    top: 31
  },
  swatchNotchThree: {
    top: 48
  }
});
