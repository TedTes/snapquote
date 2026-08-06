export const colors = {
  ink: "#1B1A17",
  ink2: "#57544D",
  ink3: "#8C887E",
  inkMuted: "#AAA59A",
  border: "#DED8CC",
  borderStrong: "#CFC7BA",
  surface: "#FFFEFA",
  surfaceMuted: "#F2F0E9",
  surfaceRaised: "#F8F6EF",
  bg: "#ECEAE3",
  dark: "#1E1D19",
  onDark: "#FFFFFF",
  accent: "#2E7D5B",
  accentBg: "#E5F1EA",
  accentBorder: "#BCD9C9",
  teal: "#2E7D5B",
  tealBg: "#E5F1EA",
  tealBorder: "#BCD9C9",

  green: "#2E7D5B",
  greenBg: "#E5F1EA",
  greenBorder: "#BCD9C9",

  amber: "#A9761C",
  amberBg: "#F6EAD0",
  amberBorder: "#E5C98E",

  red: "#B23A2E",
  redBg: "#F6DFDC",
  redBorder: "#E7AAA4"
} as const;

export const fontWeights = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
  extraBold: "800"
} as const;

export const fontFamilies = {
  regular: "Archivo_400Regular",
  medium: "Archivo_500Medium",
  semibold: "Archivo_600SemiBold",
  bold: "Archivo_700Bold",
  extraBold: "Archivo_800ExtraBold"
} as const;

export const fontStyles = {
  regular: {
    fontFamily: fontFamilies.regular,
    fontWeight: fontWeights.regular
  },
  medium: {
    fontFamily: fontFamilies.medium,
    fontWeight: fontWeights.medium
  },
  semibold: {
    fontFamily: fontFamilies.semibold,
    fontWeight: fontWeights.semibold
  },
  bold: {
    fontFamily: fontFamilies.bold,
    fontWeight: fontWeights.bold
  },
  extraBold: {
    fontFamily: fontFamilies.extraBold,
    fontWeight: fontWeights.extraBold
  }
} as const;

export const typography = {
  screenTitle: {
    color: colors.ink,
    fontSize: 26,
    ...fontStyles.bold,
    letterSpacing: 0
  },
  navTitle: {
    color: colors.ink,
    fontSize: 17,
    lineHeight: 22,
    ...fontStyles.semibold,
    letterSpacing: 0
  },
  panelTitle: {
    color: colors.ink,
    fontSize: 19,
    lineHeight: 24,
    ...fontStyles.semibold,
    letterSpacing: 0
  },
  headerSummary: {
    color: colors.ink3,
    fontSize: 13,
    lineHeight: 18,
    ...fontStyles.regular,
    letterSpacing: 0
  },
  sectionLabel: {
    color: colors.ink3,
    fontSize: 11,
    ...fontStyles.medium,
    letterSpacing: 1.35,
    textTransform: "uppercase"
  },
  rowTitle: {
    color: colors.ink,
    fontSize: 16,
    lineHeight: 20,
    ...fontStyles.semibold,
    letterSpacing: 0
  },
  rowSubtitle: {
    color: colors.ink3,
    fontSize: 12,
    lineHeight: 16,
    ...fontStyles.regular
  },
  amount: {
    color: colors.ink,
    fontSize: 16,
    lineHeight: 20,
    ...fontStyles.bold
  },
  statValue: {
    color: colors.ink,
    fontSize: 17,
    lineHeight: 22,
    ...fontStyles.semibold
  },
  pipelineAmount: {
    color: colors.ink,
    fontSize: 30,
    ...fontStyles.extraBold,
    letterSpacing: 0
  },
  attentionTitle: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 19,
    ...fontStyles.semibold
  },
  attentionSubtitle: {
    color: colors.ink3,
    fontSize: 12,
    ...fontStyles.regular
  },
  statusPill: {
    fontSize: 10,
    ...fontStyles.semibold,
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  primaryAction: {
    color: colors.onDark,
    fontSize: 15,
    lineHeight: 20,
    ...fontStyles.semibold
  },
  inputText: {
    color: colors.ink,
    fontSize: 16,
    lineHeight: 20,
    ...fontStyles.medium
  },
  sheetTitle: {
    color: colors.ink,
    fontSize: 19,
    lineHeight: 24,
    ...fontStyles.semibold
  }
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 14,
  pill: 999
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28
} as const;

export const shadowLg = {
  shadowColor: "#0B0D11",
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.16,
  shadowRadius: 20,
  elevation: 6
} as const;

export const shadowSm = {
  shadowColor: "#0B0D11",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 2
} as const;

export type MatchTone = "green" | "yellow" | "red";
export type BannerTone = "green" | "amber" | "red" | "neutral";

export function toneColors(tone: MatchTone): { fg: string; bg: string; border: string } {
  if (tone === "green") {
    return { fg: colors.green, bg: colors.greenBg, border: colors.greenBorder };
  }

  if (tone === "yellow") {
    return { fg: colors.amber, bg: colors.amberBg, border: colors.amberBorder };
  }

  return { fg: colors.red, bg: colors.redBg, border: colors.redBorder };
}
