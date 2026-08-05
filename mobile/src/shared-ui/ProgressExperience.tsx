import { useEffect, useRef, useState } from "react";
import {
  Animated as RNAnimated,
  Easing,
  Modal,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors, radius, shadowLg } from "./theme";

const quoteVanIcon = require("../../assets/icon.png");

export function AppLoadingScreen(props: {
  label?: string | undefined;
  helper?: string | undefined;
  branded?: boolean | undefined;
  delayMs?: number | undefined;
}) {
  const visible = useDelayedVisible(true, props.delayMs ?? 1000);

  if (!visible) {
    return <View style={styles.loadingScreen} />;
  }

  return (
    <View style={styles.loadingScreen}>
      <View style={styles.loadingCenter}>
        <QuietPulseMark />
        <View style={styles.loadingCopy}>
          {props.branded === true ? <Text style={styles.brandLabel}>QuoteVan</Text> : null}
          {props.helper ? <Text style={styles.loadingHelper}>{props.helper}</Text> : null}
          <ProgressDots />
        </View>
      </View>
      <Text style={styles.loadingFootnote}>{props.label ?? "Getting things ready..."}</Text>
    </View>
  );
}

export function ProgressModal(props: {
  visible: boolean;
  title: string;
  helper?: string | undefined;
  delayMs?: number | undefined;
}) {
  const visible = useDelayedVisible(props.visible, props.delayMs ?? 250);

  return (
    <Modal animationType="fade" onRequestClose={() => undefined} transparent visible={visible}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <QuietPulseMark small />
          <Text style={styles.modalTitle}>{props.title}</Text>
          {props.helper ? <Text style={styles.modalHelper}>{props.helper}</Text> : null}
          <ProgressDots />
        </View>
      </View>
    </Modal>
  );
}

export function InlineProgressPanel(props: {
  title: string;
  helper?: string | undefined;
  style?: StyleProp<ViewStyle> | undefined;
  delayMs?: number | undefined;
}) {
  const visible = useDelayedVisible(true, props.delayMs ?? 250);

  if (!visible) {
    return null;
  }

  return (
    <View style={[styles.inlinePanel, props.style]}>
      <View style={styles.inlineHeader}>
        <QuietPulseMark tiny />
        <View style={styles.inlineCopy}>
          <Text style={styles.inlineTitle}>{props.title}</Text>
          {props.helper ? <Text style={styles.inlineHelper}>{props.helper}</Text> : null}
        </View>
        <ProgressDots compact />
      </View>
    </View>
  );
}

export function QuietPulseMark(props: {
  small?: boolean | undefined;
  tiny?: boolean | undefined;
}) {
  const pulse = useLoopingValue(1200);
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.12] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.34, 0.08] });
  const logoScale = pulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.98, 1.02, 0.98] });
  const sizeStyle = props.tiny
    ? styles.markShellTiny
    : props.small
      ? styles.markShellSmall
      : styles.markShell;

  return (
    <View style={[styles.markShellBase, sizeStyle]}>
      <RNAnimated.View
        style={[
          styles.markPulse,
          props.tiny ? styles.markPulseTiny : null,
          { opacity: pulseOpacity, transform: [{ scale: pulseScale }] },
        ]}
      />
      <RNAnimated.Image
        resizeMode="cover"
        source={quoteVanIcon}
        style={[styles.logoImage, props.tiny ? styles.logoImageTiny : null, { transform: [{ scale: logoScale }] }]}
      />
    </View>
  );
}

function ProgressDots(props: { compact?: boolean | undefined }) {
  const pulse = useLoopingValue(700);
  const firstOpacity = pulse.interpolate({ inputRange: [0, 0.33, 0.66, 1], outputRange: [1, 0.35, 0.35, 1] });
  const secondOpacity = pulse.interpolate({ inputRange: [0, 0.33, 0.66, 1], outputRange: [0.35, 1, 0.35, 0.35] });
  const thirdOpacity = pulse.interpolate({ inputRange: [0, 0.33, 0.66, 1], outputRange: [0.35, 0.35, 1, 0.35] });

  return (
    <View style={[styles.dots, props.compact ? styles.dotsCompact : null]}>
      <RNAnimated.View style={[styles.dot, props.compact ? styles.dotCompact : null, { opacity: firstOpacity }]} />
      <RNAnimated.View style={[styles.dot, props.compact ? styles.dotCompact : null, { opacity: secondOpacity }]} />
      <RNAnimated.View style={[styles.dot, props.compact ? styles.dotCompact : null, { opacity: thirdOpacity }]} />
    </View>
  );
}

function useLoopingValue(duration: number) {
  const value = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    const loop = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(value, {
          duration,
          easing: Easing.inOut(Easing.cubic),
          toValue: 1,
          useNativeDriver: true,
        }),
        RNAnimated.timing(value, {
          duration,
          easing: Easing.inOut(Easing.cubic),
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();

    return () => loop.stop();
  }, [duration, value]);

  return value;
}

function useDelayedVisible(active: boolean, delayMs: number) {
  const [visible, setVisible] = useState(active && delayMs <= 0);

  useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }

    if (delayMs <= 0) {
      setVisible(true);
      return;
    }

    const timeout = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(timeout);
  }, [active, delayMs]);

  return visible;
}

const styles = StyleSheet.create({
  loadingScreen: {
    alignItems: "center",
    backgroundColor: colors.bg,
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  loadingCenter: {
    alignItems: "center",
    gap: 18,
    maxWidth: 330,
    width: "100%",
  },
  loadingCopy: {
    alignItems: "center",
    gap: 16,
  },
  brandLabel: {
    color: colors.ink3,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 3,
    lineHeight: 19,
    textAlign: "center",
    textTransform: "uppercase",
  },
  loadingFootnote: {
    bottom: 52,
    color: colors.ink3,
    fontSize: 13,
    fontWeight: "700",
    left: 24,
    lineHeight: 18,
    position: "absolute",
    right: 24,
    textAlign: "center",
  },
  loadingHelper: {
    color: colors.ink3,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    marginTop: -8,
    textAlign: "center",
  },
  modalBackdrop: {
    alignItems: "center",
    backgroundColor: "rgba(32,31,27,0.38)",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    gap: 13,
    padding: 22,
    width: "100%",
    ...shadowLg,
  },
  modalTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 24,
    marginTop: 3,
    textAlign: "center",
  },
  modalHelper: {
    color: colors.ink3,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    marginTop: -6,
    textAlign: "center",
  },
  inlinePanel: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 13,
  },
  inlineHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 11,
  },
  inlineCopy: {
    flex: 1,
    gap: 2,
  },
  inlineTitle: {
    color: colors.ink,
    fontSize: 13.5,
    fontWeight: "900",
    lineHeight: 17,
  },
  inlineHelper: {
    color: colors.ink3,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 15,
  },
  markShellBase: {
    alignItems: "center",
    justifyContent: "center",
  },
  markShell: {
    height: 92,
    width: 92,
  },
  markShellSmall: {
    height: 54,
    width: 54,
  },
  markShellTiny: {
    height: 32,
    width: 32,
  },
  markPulse: {
    backgroundColor: colors.greenBg,
    borderRadius: 24,
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  markPulseTiny: {
    borderRadius: 10,
  },
  logoImage: {
    borderRadius: 20,
    height: "74%",
    width: "74%",
  },
  logoImageTiny: {
    borderRadius: 8,
  },
  dots: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
  },
  dotsCompact: {
    gap: 4,
  },
  dot: {
    backgroundColor: colors.borderStrong,
    borderRadius: radius.pill,
    height: 8,
    width: 8,
  },
  dotCompact: {
    backgroundColor: colors.border,
    height: 5,
    width: 5,
  },
});
