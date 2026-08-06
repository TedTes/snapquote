import type { ReactNode } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { AppText } from "./text";
import { colors, spacing } from "./theme";

export function ScreenHeader(props: {
  action?: ReactNode | undefined;
  detail?: string | undefined;
  eyebrow?: string | undefined;
  style?: StyleProp<ViewStyle> | undefined;
  title?: string | undefined;
}) {
  return (
    <View style={[styles.screenHeader, props.style]}>
      <View style={styles.headerText}>
        {props.eyebrow ? (
          <AppText numberOfLines={1} variant="sectionLabel">
            {props.eyebrow}
          </AppText>
        ) : null}
        {props.title ? (
          <AppText numberOfLines={1} variant="screenTitle">
            {props.title}
          </AppText>
        ) : null}
        {props.detail ? (
          <AppText numberOfLines={1} variant="headerSummary">
            {props.detail}
          </AppText>
        ) : null}
      </View>
      {props.action ? <View style={styles.headerAction}>{props.action}</View> : null}
    </View>
  );
}

export function SectionHeader(props: {
  actionLabel?: string | undefined;
  count?: number | string | undefined;
  label: string;
  onActionPress?: (() => void) | undefined;
  style?: StyleProp<ViewStyle> | undefined;
}) {
  return (
    <View style={[styles.sectionHeader, props.style]}>
      <View style={styles.sectionLabelRow}>
        <AppText variant="sectionLabel">{props.label}</AppText>
        {props.count !== undefined ? (
          <AppText style={styles.sectionCount} variant="meta">
            {props.count}
          </AppText>
        ) : null}
      </View>
      {props.actionLabel ? (
        <Pressable accessibilityRole="button" disabled={!props.onActionPress} hitSlop={8} onPress={props.onActionPress}>
          <AppText variant="meta">{props.actionLabel}</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screenHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  headerText: {
    flex: 1,
    gap: 5,
    minWidth: 0,
  },
  headerAction: {
    marginLeft: spacing.md,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sectionLabelRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    minWidth: 0,
  },
  sectionCount: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 23,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 2,
    textAlign: "center",
  },
});
