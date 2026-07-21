import { useEffect, useRef, useState } from "react";
import { Square } from "lucide-react-native";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Screen } from "../../src/ui/components";
import { NewQuoteHeader, NewQuoteTitle } from "../../src/ui/NewQuoteScaffold";
import { screenContentEnter, useMotionEnabled } from "../../src/ui/motion";
import { colors } from "../../src/ui/theme";
import { useMvpStore } from "../../src/state/mvp";

const BAR_HEIGHTS = [22, 38, 28, 52, 33, 45, 60, 36, 50, 30, 42, 55, 34, 47, 29, 41];
const sampleTranscript =
  "Paint two bedrooms, patch nail holes, remove the old wallpaper in the hallway, two coats, customer provides paint.";
const EXTRA_HINTS = [
  { label: "+ patch holes", phrase: "Patch holes noted" },
  { label: "+ wallpaper", phrase: "Wallpaper removal noted" },
  { label: "+ customer supplies paint", phrase: "Customer supplies paint" }
] as const;

export default function NewQuoteVoiceScreen() {
  const updateWizard = useMvpStore((state) => state.updateWizard);
  const motionEnabled = useMotionEnabled();
  const insets = useSafeAreaInsets();
  const [recording, setRecording] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(24);
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (recording) {
      timerRef.current = setInterval(() => setElapsedSeconds((value) => value + 1), 1000);
    } else if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [recording]);

  function finishRecording() {
    setRecording(false);
    updateWizard({ transcript: composeTranscript(selectedExtras) });
    router.push("/new-quote/transcript");
  }

  function addChip(text: string) {
    setSelectedExtras((current) => {
      const next = current.includes(text)
        ? current.filter((item) => item !== text)
        : [...current, text];

      updateWizard({ transcript: composeTranscript(next) });
      return next;
    });
  }

  return (
    <Screen edges={["top"]}>
      <NewQuoteHeader onBack={() => router.back()} step={3} />
      <Animated.View {...(motionEnabled ? { entering: screenContentEnter } : {})} style={styles.content}>
        <NewQuoteTitle
          helper="Walk the space and talk. Call out anything the checklist didn't cover."
          title="Describe the job"
        />

        <View style={styles.recordCard}>
          <Text style={styles.recordingText}>● Recording · {formatElapsed(elapsedSeconds)}</Text>
          <View style={styles.wave}>
            {BAR_HEIGHTS.map((height, index) => (
              <View
                key={index}
                style={[
                  styles.waveBar,
                  {
                    height,
                    opacity: recording || index % 3 !== 0 ? 1 : 0.45
                  }
                ]}
              />
            ))}
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => finishRecording()}
            style={styles.stopButton}
          >
            <Square color={colors.red} fill={colors.red} size={24} strokeWidth={2} />
          </Pressable>

          <Text style={styles.recordCaption}>Tap to stop · saved on your phone as you talk</Text>

          <View style={styles.chipWrap}>
            {EXTRA_HINTS.map((hint) => (
              <HintChip
                key={hint.phrase}
                active={selectedExtras.includes(hint.phrase)}
                label={hint.label}
                onPress={() => addChip(hint.phrase)}
              />
            ))}
          </View>
        </View>
      </Animated.View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 13) }]}>
        <Pressable accessibilityRole="button" onPress={() => router.push("/new-quote/transcript")} style={styles.skipButton}>
          <Text style={styles.skipText}>Skip — type notes instead</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

function HintChip(props: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: props.active }}
      onPress={props.onPress}
      style={[styles.hintChip, props.active ? styles.hintChipActive : null]}
    >
      <Text style={[styles.hintChipText, props.active ? styles.hintChipTextActive : null]}>
        {props.label}
      </Text>
    </Pressable>
  );
}

function composeTranscript(extras: string[]): string {
  return [sampleTranscript, ...extras.map((extra) => `${extra}.`)].join(" ").trim();
}

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    gap: 15,
    paddingTop: 21
  },
  recordCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 15,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    marginHorizontal: 17,
    paddingHorizontal: 24
  },
  recordingText: {
    color: colors.red,
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 22
  },
  wave: {
    alignItems: "center",
    flexDirection: "row",
    gap: 3,
    height: 62,
    marginBottom: 27
  },
  waveBar: {
    backgroundColor: colors.ink3,
    borderRadius: 2,
    width: 3
  },
  stopButton: {
    alignItems: "center",
    backgroundColor: colors.redBg,
    borderColor: colors.red,
    borderRadius: 999,
    borderWidth: 2,
    height: 73,
    justifyContent: "center",
    marginBottom: 21,
    width: 73
  },
  recordCaption: {
    color: colors.ink3,
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 20,
    textAlign: "center"
  },
  chipWrap: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    maxWidth: 230
  },
  hintChip: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 7,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  hintChipActive: {
    backgroundColor: colors.greenBg,
    borderColor: colors.greenBorder
  },
  hintChipText: {
    color: colors.ink2,
    fontSize: 11,
    fontWeight: "800"
  },
  hintChipTextActive: {
    color: colors.green
  },
  footer: {
    backgroundColor: colors.bg,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingHorizontal: 17,
    paddingTop: 12
  },
  skipButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    height: 44,
    justifyContent: "center"
  },
  skipText: {
    color: colors.ink2,
    fontSize: 14,
    fontWeight: "900"
  }
});
