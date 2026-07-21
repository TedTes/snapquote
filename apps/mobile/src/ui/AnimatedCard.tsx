import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated from "react-native-reanimated";
import { cardEnter, cardExit, listLayout, useMotionEnabled } from "./motion";

/**
 * Wraps a single list/card item (draft review lines, quote cards, price book
 * rows) so it fades/slides in on first appearance and reflows smoothly —
 * instead of jumping — when siblings are added, removed, or reordered.
 */
export function AnimatedCard(props: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const motionEnabled = useMotionEnabled();
  const motionProps = motionEnabled ? { entering: cardEnter, exiting: cardExit, layout: listLayout } : {};

  return (
    <Animated.View {...motionProps} style={props.style}>
      {props.children}
    </Animated.View>
  );
}
