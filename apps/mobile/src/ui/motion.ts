import {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutDown,
  LinearTransition,
  useReducedMotion
} from "react-native-reanimated";

/**
 * Calm, utilitarian motion tokens for a contractor-facing tool — short,
 * consistent, and never bouncy. Nothing here should call attention to itself.
 */
export const motionDuration = {
  short: 160,
  medium: 240
} as const;

const standardEasing = Easing.out(Easing.cubic);

export const motionEasing = {
  standard: standardEasing
} as const;

/** Whole-screen content on mount: quote wizard steps, etc. One block, not per-field. */
export const screenContentEnter = FadeInDown.duration(motionDuration.medium)
  .easing(standardEasing)
  .withInitialValues({ transform: [{ translateY: 10 }] });

/** Individual list/card items: draft review lines, quote cards, price book rows. */
export const cardEnter = FadeInDown.duration(motionDuration.short)
  .easing(standardEasing)
  .withInitialValues({ transform: [{ translateY: 6 }] });

export const cardExit = FadeOut.duration(motionDuration.short);

/** Reflow existing siblings smoothly when a list adds/removes/reorders items. */
export const listLayout = LinearTransition.duration(motionDuration.short).easing(standardEasing);

/** Plain fade, no movement — footers, banners, modal backdrops. */
export const fadeEnter = FadeIn.duration(motionDuration.short).easing(standardEasing);

export const sheetBackdropEnter = FadeIn.duration(motionDuration.short);
export const sheetBackdropExit = FadeOut.duration(motionDuration.short).easing(standardEasing);

export const sheetContentEnter = FadeInDown.duration(motionDuration.medium)
  .easing(standardEasing)
  .withInitialValues({ transform: [{ translateY: 16 }] });

export const sheetContentExit = FadeOutDown.duration(motionDuration.medium).easing(standardEasing);

/** Root-level route transition — the whole screen when a tab switches or a new route opens. */
export const routeTransitionEnter = FadeIn.duration(motionDuration.medium).easing(standardEasing);

/** Respect the OS "reduce motion" setting: entering/layout props should be omitted, not shortened. */
export function useMotionEnabled(): boolean {
  return !useReducedMotion();
}
