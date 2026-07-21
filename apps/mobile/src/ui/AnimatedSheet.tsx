import { useEffect, useState, type ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";
import {
  motionDuration,
  sheetBackdropEnter,
  sheetBackdropExit,
  sheetContentEnter,
  sheetContentExit,
  useMotionEnabled
} from "./motion";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = { children: ReactNode; style?: StyleProp<ViewStyle> };

type SheetModalProps = Props & {
  onDismiss: () => void;
  visible: boolean;
};

export function SheetModal(props: SheetModalProps) {
  const [mounted, setMounted] = useState(props.visible);
  const [renderedChildren, setRenderedChildren] = useState(props.children);
  const [showContent, setShowContent] = useState(props.visible);

  useEffect(() => {
    if (props.visible) {
      setRenderedChildren(props.children);
    }
  }, [props.children, props.visible]);

  useEffect(() => {
    if (props.visible) {
      setMounted(true);
      setShowContent(true);
      return undefined;
    }

    setShowContent(false);
    const timer = setTimeout(() => setMounted(false), motionDuration.medium);

    return () => clearTimeout(timer);
  }, [props.visible]);

  if (!mounted) {
    return null;
  }

  return (
    <Modal animationType="none" onRequestClose={props.onDismiss} transparent visible={mounted}>
      {showContent ? (
        <AnimatedSheetBackdrop onDismiss={props.onDismiss} style={props.style}>
          {renderedChildren}
        </AnimatedSheetBackdrop>
      ) : null}
    </Modal>
  );
}

/**
 * Pair for bottom-sheet style `Modal` content. The wrapper keeps the native
 * modal mounted for long enough that the sheet can animate out after dismissal.
 */
export function AnimatedSheetBackdrop(props: Props & { onDismiss?: () => void }) {
  const motionEnabled = useMotionEnabled();

  return (
    <AnimatedPressable
      accessibilityLabel="Close popup"
      accessibilityRole={props.onDismiss ? "button" : undefined}
      {...(motionEnabled ? { entering: sheetBackdropEnter, exiting: sheetBackdropExit } : {})}
      onPress={props.onDismiss}
      style={props.style}
    >
      {props.children}
    </AnimatedPressable>
  );
}

/**
 * `Modal` content sits in its own native layer, outside any `Screen`'s
 * SafeAreaView, so the sheet's own bottom padding never accounts for the
 * home indicator on its own — add that clearance explicitly here, once.
 */
export function AnimatedSheetContent(props: Props) {
  const motionEnabled = useMotionEnabled();
  const insets = useSafeAreaInsets();

  return (
    <Animated.View
      {...(motionEnabled ? { entering: sheetContentEnter, exiting: sheetContentExit } : {})}
      onStartShouldSetResponder={() => true}
      style={props.style}
    >
      {props.children}
      <View style={{ height: insets.bottom }} />
    </Animated.View>
  );
}
