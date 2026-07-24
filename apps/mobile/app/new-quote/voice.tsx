import { useEffect, useMemo, useRef, useState } from "react";
import { Info, Mic, Plus } from "lucide-react-native";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getTradeConfig } from "@snapquote/shared";
import { AnimatedScreenContent } from "../../src/ui/AnimatedScreenContent";
import { Screen } from "../../src/ui/components";
import { NewQuoteHeader, NewQuoteTitle, SectionKicker } from "../../src/ui/NewQuoteScaffold";
import { colors } from "../../src/ui/theme";
import { useMvpStore } from "../../src/state/mvp";

const WAVE_BARS = [18, 28, 20, 31, 16, 24, 35, 22, 30, 17, 26, 21, 32, 19, 27, 15, 24];

export default function NewQuoteVoiceScreen() {
  const wizard = useMvpStore((state) => state.wizard);
  const updateWizard = useMvpStore((state) => state.updateWizard);
  const activeTrade = useMvpStore((state) => state.activeTrade);
  const tradeConfig = getTradeConfig(activeTrade);
  const insets = useSafeAreaInsets();
  const [recording, setRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(24);
  const extraHints = tradeConfig.notes.chips;
  const [selectedExtras, setSelectedExtras] = useState<string[]>(
    extraHints.filter((hint) => wizard.transcript.toLowerCase().includes(hint.phrase)).map((hint) => hint.phrase)
  );
  const [notes, setNotes] = useState(notesFromTranscript(wizard.transcript, selectedExtras));
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcript = useMemo(
    () => buildTranscript({ extras: selectedExtras, notes, recording }),
    [notes, recording, selectedExtras]
  );
  const canContinue = !recording;

  useEffect(() => {
    if (wizard.address.trim().length === 0) {
      router.replace("/new-quote");
    }
  }, [wizard.address]);

  useEffect(() => {
    if (!recording) {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return undefined;
    }

    timerRef.current = setInterval(() => setElapsedSeconds((value) => value + 1), 1000);

    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [recording]);

  function toggleExtra(phrase: string) {
    setSelectedExtras((current) =>
      current.includes(phrase)
        ? current.filter((item) => item !== phrase)
        : [...current, phrase]
    );
  }

  function startRecording() {
    setElapsedSeconds(24);
    setRecording(true);
  }

  function stopRecording() {
    setRecording(false);
  }

  function next() {
    if (!canContinue) {
      return;
    }

    updateWizard({ transcript });
    router.push("/new-quote/transcript");
  }

  return (
    <Screen edges={["top"]}>
      <NewQuoteHeader onBack={() => router.back()} step={3} />
      <AnimatedScreenContent contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <NewQuoteTitle
          helper={tradeConfig.notes.helper}
          title={tradeConfig.notes.title}
        />

        <View style={styles.group}>
          <SectionKicker>{recording ? "Recording" : "Talk it through"}</SectionKicker>
          {recording ? (
            <Pressable accessibilityRole="button" onPress={stopRecording} style={styles.recordingPanel}>
              <View style={styles.recordDot} />
              <View style={styles.recordBody}>
                <Text style={styles.recordText}>{formatElapsed(elapsedSeconds)} · tap to stop</Text>
                <View style={styles.wave}>
                  {WAVE_BARS.map((height, index) => (
                    <View key={index} style={[styles.waveBar, { height }]} />
                  ))}
                </View>
              </View>
            </Pressable>
          ) : (
            <Pressable accessibilityRole="button" onPress={startRecording} style={styles.talkPanel}>
              <View style={styles.micBadge}>
                <Mic color={colors.surface} size={18} strokeWidth={2.3} />
              </View>
              <View style={styles.talkTextWrap}>
                <Text style={styles.talkTitle}>Tap to talk</Text>
                <Text style={styles.talkSub}>Walk the space — we'll write it down</Text>
              </View>
            </Pressable>
          )}
          {recording ? (
            <Text style={styles.savedText}>Saved on your phone as you talk</Text>
          ) : null}
        </View>

        <View style={styles.group}>
          <View style={styles.kickerRow}>
            <SectionKicker>Common extras</SectionKicker>
            <Text style={styles.kickerHint}>tap to add</Text>
          </View>
          <View style={styles.chipWrap}>
            {extraHints.map((hint) => (
              <ExtraChip
                key={hint.phrase}
                active={selectedExtras.includes(hint.phrase)}
                label={hint.label}
                onPress={() => toggleExtra(hint.phrase)}
              />
            ))}
          </View>
        </View>

        {!recording ? (
          <View style={styles.group}>
            <View style={styles.kickerRow}>
              <SectionKicker>Notes</SectionKicker>
              <Text style={styles.kickerHint}>optional</Text>
            </View>
            <TextInput
              multiline
              onChangeText={setNotes}
              placeholder={tradeConfig.notes.placeholder}
              placeholderTextColor={colors.ink3}
              style={styles.notesInput}
              textAlignVertical="top"
              value={notes}
            />
            <View style={styles.guardrail}>
              <Info color={colors.ink3} size={12} strokeWidth={2} />
              <Text style={styles.guardrailText}>Notes add scope only — never prices.</Text>
            </View>
          </View>
        ) : null}
      </AnimatedScreenContent>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <Pressable
          accessibilityRole="button"
          disabled={!canContinue}
          onPress={next}
          style={[styles.primaryButton, !canContinue ? styles.primaryButtonDisabled : null]}
        >
          <Text style={[styles.primaryText, !canContinue ? styles.primaryTextDisabled : null]}>
            {recording ? "Stop recording to continue" : "Next — review"}
          </Text>
          {!recording ? <Text style={styles.primaryArrow}>→</Text> : null}
        </Pressable>
      </View>
    </Screen>
  );
}

function ExtraChip(props: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: props.active }}
      onPress={props.onPress}
      style={[styles.extraChip, props.active ? styles.extraChipActive : null]}
    >
      <Plus color={props.active ? colors.amber : colors.ink2} size={13} strokeWidth={2.2} />
      <Text style={[styles.extraChipText, props.active ? styles.extraChipTextActive : null]}>
        {props.label}
      </Text>
    </Pressable>
  );
}

function buildTranscript(input: { extras: string[]; notes: string; recording: boolean }) {
  const parts = [
    input.recording ? "Walkthrough recording captured." : null,
    ...input.extras.map((extra) => `${extra}.`),
    input.notes.trim()
  ].filter((part): part is string => part !== null && part.trim().length > 0);

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function notesFromTranscript(transcript: string, extras: string[]) {
  let notes = transcript;

  for (const extra of extras) {
    notes = notes.replace(new RegExp(`${escapeRegExp(extra)}\\.?`, "gi"), "");
  }

  return notes.replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    gap: 17,
    paddingBottom: 18,
    paddingTop: 21
  },
  group: {
    gap: 8,
    paddingHorizontal: 20
  },
  talkPanel: {
    alignItems: "center",
    backgroundColor: colors.dark,
    borderRadius: 10,
    flexDirection: "row",
    gap: 12,
    minHeight: 62,
    paddingHorizontal: 14
  },
  micBadge: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 999,
    height: 40,
    justifyContent: "center",
    width: 40
  },
  talkTextWrap: {
    gap: 3
  },
  talkTitle: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: "900"
  },
  talkSub: {
    color: "rgba(255,255,255,0.74)",
    fontSize: 11,
    fontWeight: "700"
  },
  recordingPanel: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.red,
    borderRadius: 11,
    borderWidth: 1,
    flexDirection: "row",
    gap: 16,
    minHeight: 70,
    paddingHorizontal: 14
  },
  recordDot: {
    backgroundColor: colors.red,
    borderRadius: 999,
    height: 38,
    width: 38
  },
  recordBody: {
    gap: 10
  },
  recordText: {
    color: colors.red,
    fontSize: 13,
    fontWeight: "800"
  },
  wave: {
    alignItems: "center",
    flexDirection: "row",
    gap: 3,
    height: 23
  },
  waveBar: {
    backgroundColor: colors.redBorder,
    borderRadius: 2,
    width: 3
  },
  savedText: {
    color: colors.ink3,
    fontSize: 11,
    fontWeight: "700"
  },
  kickerRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  kickerHint: {
    color: colors.ink3,
    fontSize: 10,
    fontWeight: "700"
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  extraChip: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    minHeight: 34,
    paddingHorizontal: 12
  },
  extraChipActive: {
    backgroundColor: colors.amberBg,
    borderColor: colors.amberBorder
  },
  extraChipText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "700"
  },
  extraChipTextActive: {
    color: colors.amber,
    fontWeight: "900"
  },
  notesInput: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
    minHeight: 70,
    padding: 13
  },
  guardrail: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5
  },
  guardrailText: {
    color: colors.ink3,
    fontSize: 11,
    fontWeight: "700"
  },
  footer: {
    backgroundColor: colors.bg,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 12
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.dark,
    borderRadius: 10,
    flexDirection: "row",
    gap: 9,
    height: 45,
    justifyContent: "center"
  },
  primaryButtonDisabled: {
    backgroundColor: colors.surfaceMuted
  },
  primaryText: {
    color: colors.onDark,
    fontSize: 15,
    fontWeight: "900"
  },
  primaryTextDisabled: {
    color: colors.ink3
  },
  primaryArrow: {
    color: colors.onDark,
    fontSize: 18,
    fontWeight: "900"
  }
});
