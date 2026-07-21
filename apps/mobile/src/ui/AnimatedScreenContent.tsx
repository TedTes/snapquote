import type { ComponentProps } from "react";
import Animated from "react-native-reanimated";
import { screenContentEnter, useMotionEnabled } from "./motion";

type Props = ComponentProps<typeof Animated.ScrollView>;

/**
 * Drop-in replacement for a screen's root `ScrollView`. Fades/slides the whole
 * block in on mount once, short and subtle — never animates individual fields.
 */
export function AnimatedScreenContent(props: Props) {
  const motionEnabled = useMotionEnabled();

  return <Animated.ScrollView {...(motionEnabled ? { entering: screenContentEnter } : {})} {...props} />;
}
