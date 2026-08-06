import type { ReactNode } from "react";
import { StyleSheet, Text, type StyleProp, type TextProps, type TextStyle } from "react-native";
import { colors, fontStyles, typography } from "./theme";

type TextTone = "primary" | "secondary" | "muted" | "green" | "red" | "amber" | "onDark";
type AppTextVariant =
  | "body"
  | "meta"
  | "screenTitle"
  | "navTitle"
  | "panelTitle"
  | "headerSummary"
  | "sectionLabel"
  | "rowTitle"
  | "rowSubtitle"
  | "amount"
  | "statValue"
  | "pipelineAmount"
  | "attentionTitle"
  | "attentionSubtitle"
  | "sheetTitle"
  | "inputText"
  | "statusPill"
  | "primaryAction"
  | "button";

export function AppText(
  props: TextProps & {
    children: ReactNode;
    style?: StyleProp<TextStyle> | undefined;
    tone?: TextTone | undefined;
    variant?: AppTextVariant | undefined;
  },
) {
  const { children, style, tone, variant = "body", ...textProps } = props;

  return (
    <Text
      {...textProps}
      style={[
        styles.base,
        variantStyles[variant],
        tone ? toneStyles[tone] : null,
        style,
      ]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    color: colors.ink,
  },
});

const variantStyles = StyleSheet.create({
  body: {
    color: colors.ink2,
    fontSize: 13,
    lineHeight: 18,
    ...fontStyles.regular,
  },
  meta: {
    color: colors.ink3,
    fontSize: 12,
    lineHeight: 16,
    ...fontStyles.regular,
  },
  screenTitle: {
    ...typography.screenTitle,
  },
  navTitle: {
    ...typography.navTitle,
  },
  panelTitle: {
    ...typography.panelTitle,
  },
  headerSummary: {
    ...typography.headerSummary,
  },
  sectionLabel: {
    ...typography.sectionLabel,
  },
  rowTitle: {
    ...typography.rowTitle,
  },
  rowSubtitle: {
    ...typography.rowSubtitle,
  },
  amount: {
    ...typography.amount,
  },
  statValue: {
    ...typography.statValue,
  },
  pipelineAmount: {
    ...typography.pipelineAmount,
  },
  attentionTitle: {
    ...typography.attentionTitle,
  },
  attentionSubtitle: {
    ...typography.attentionSubtitle,
  },
  sheetTitle: {
    ...typography.sheetTitle,
  },
  inputText: {
    ...typography.inputText,
  },
  statusPill: {
    ...typography.statusPill,
  },
  primaryAction: {
    ...typography.primaryAction,
  },
  button: {
    color: colors.ink,
    fontSize: 13,
    ...fontStyles.semibold,
  },
});

const toneStyles = StyleSheet.create({
  primary: {
    color: colors.ink,
  },
  secondary: {
    color: colors.ink2,
  },
  muted: {
    color: colors.ink3,
  },
  green: {
    color: colors.green,
  },
  red: {
    color: colors.red,
  },
  amber: {
    color: colors.amber,
  },
  onDark: {
    color: colors.onDark,
  },
});
