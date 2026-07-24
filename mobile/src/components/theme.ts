export const colors = {
  ink: "#201F1B",
  ink2: "#5F5B52",
  ink3: "#8B877D",
  inkMuted: "#AAA59A",
  border: "#DED8CC",
  borderStrong: "#CFC7BA",
  surface: "#FFFEFA",
  surfaceMuted: "#F2F0E9",
  surfaceRaised: "#F8F6EF",
  bg: "#ECEAE3",
  dark: "#1E1D19",
  onDark: "#FFFFFF",
  accent: "#2E8B61",
  accentBg: "#E5F1EA",
  accentBorder: "#BCD9C9",
  teal: "#2E8B61",
  tealBg: "#E5F1EA",
  tealBorder: "#BCD9C9",

  green: "#2E8B61",
  greenBg: "#E5F1EA",
  greenBorder: "#BCD9C9",

  amber: "#B67A14",
  amberBg: "#F6EAD0",
  amberBorder: "#E5C98E",

  red: "#C43A31",
  redBg: "#F6DFDC",
  redBorder: "#E7AAA4"
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
