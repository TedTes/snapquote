import { useEffect, useMemo, useState } from "react";
import { File } from "expo-file-system";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioPlayer,
  useAudioRecorderState
} from "expo-audio";
import { Lock, Mic, Play, Plus, RotateCcw } from "lucide-react-native";
import { router } from "expo-router";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getTradeConfig } from "@snapquote/shared";
import { snapquoteApi, userFacingErrorMessage } from "../../api/client";
import { AnimatedScreenContent } from "../../shared-ui/AnimatedScreenContent";
import { Screen } from "../../shared-ui/base";
import { NewQuoteHeader, NewQuoteTitle, SectionKicker } from "./components/NewQuoteScaffold";
import { colors, fontStyles, typography } from "../../shared-ui/theme";
import { useQuoteStore } from "../../state/quoteStore";

const WAVE_BARS = [18, 28, 20, 31, 16, 24, 35, 22, 30, 17, 26, 21, 32, 19, 27, 15, 24];

export default function NewQuoteVoiceScreen() {
  const wizard = useQuoteStore((state) => state.wizard);
  const updateWizard = useQuoteStore((state) => state.updateWizard);
  const activeTrade = useQuoteStore((state) => state.activeTrade);
  const tradeConfig = getTradeConfig(activeTrade);
  const insets = useSafeAreaInsets();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 250);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [audioUri, setAudioUri] = useState<string | null>(wizard.audioUri);
  const [audioDurationSeconds, setAudioDurationSeconds] = useState(wizard.audioDurationSeconds ?? 0);
  const player = useAudioPlayer(audioUri ? { uri: audioUri } : null);
  const extraHints = tradeConfig.notes.chips;
  const [selectedExtras, setSelectedExtras] = useState<string[]>(
    extraHints.filter((hint) => wizard.transcript.toLowerCase().includes(hint.phrase)).map((hint) => hint.phrase)
  );
  const [notes, setNotes] = useState(notesFromTranscript(wizard.transcript, selectedExtras));
  const transcript = useMemo(
    () => buildTranscript({ extras: selectedExtras, notes }),
    [notes, selectedExtras]
  );
  const elapsedSeconds = recording
    ? Math.max(0, Math.floor(recorderState.durationMillis / 1000))
    : audioDurationSeconds;
  const canContinue = !recording && !transcribing;

  useEffect(() => {
    if (wizard.address.trim().length === 0) {
      router.replace("/new-quote");
    }
  }, [wizard.address]);

  function toggleExtra(phrase: string) {
    setSelectedExtras((current) =>
      current.includes(phrase)
        ? current.filter((item) => item !== phrase)
        : [...current, phrase]
    );
  }

  async function startRecording() {
    if (recording || transcribing) {
      return;
    }

    try {
      const permission = await requestRecordingPermissionsAsync();

      if (!permission.granted) {
        Alert.alert("Microphone access needed", "Allow microphone access to record job notes.");
        return;
      }

      setAudioUri(null);
      setAudioDurationSeconds(0);
      updateWizard({
        audioUri: null,
        audioStoragePath: null,
        audioContentType: null,
        audioDurationSeconds: null,
        transcriptionSource: null
      });
      await enableRecordingMode();
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
    } catch (error) {
      await disableRecordingMode();
      Alert.alert("Could not start recording", recordingErrorMessage(error));
    }
  }

  async function stopRecording() {
    if (!recording) {
      return;
    }

    try {
      const beforeStop = recorder.getStatus();
      await recorder.stop();
      await disableRecordingMode();
      const afterStop = recorder.getStatus();
      const uri = recorder.uri ?? afterStop.url ?? beforeStop.url;
      const durationSeconds = Math.max(
        0,
        Math.round((afterStop.durationMillis || beforeStop.durationMillis || recorderState.durationMillis) / 1000)
      );

      setRecording(false);

      if (!uri) {
        throw new Error("Recording file was not saved.");
      }

      setAudioUri(uri);
      setAudioDurationSeconds(durationSeconds);
      await transcribeRecording(uri, durationSeconds);
    } catch (error) {
      await disableRecordingMode();
      setRecording(false);
      Alert.alert("Could not save recording", userFacingErrorMessage(error));
    }
  }

  function next() {
    if (!canContinue) {
      return;
    }

    updateWizard({
      transcript,
      audioUri,
      audioDurationSeconds: audioUri ? audioDurationSeconds : null
    });
    router.push("/new-quote/transcript");
  }

  async function transcribeRecording(uri: string, durationSeconds: number) {
    setTranscribing(true);

    try {
      const file = new File(uri);
      const response = await snapquoteApi.transcribeAudio({
        fileName: recordingFileName(uri),
        contentType: audioContentTypeForUri(uri),
        base64: await file.base64(),
        durationSeconds
      });
      const cleanedTranscript = response.transcript.trim();
      const mergedNotes = mergeNotesWithVoice(notes, cleanedTranscript);
      setNotes(mergedNotes);
      updateWizard({
        audioUri: uri,
        audioStoragePath: response.audio.storagePath,
        audioContentType: response.audio.contentType,
        audioDurationSeconds: response.audio.durationSeconds,
        transcriptionSource: response.source,
        transcript: buildTranscript({
          extras: selectedExtras,
          notes: mergedNotes
        })
      });
    } catch (error) {
      updateWizard({
        audioUri: uri,
        audioStoragePath: null,
        audioContentType: audioContentTypeForUri(uri),
        audioDurationSeconds: durationSeconds,
        transcriptionSource: "fallback",
        transcript
      });
      Alert.alert(
        "Recording saved",
        `${userFacingErrorMessage(error)} You can still type the details before continuing.`
      );
    } finally {
      setTranscribing(false);
    }
  }

  async function playRecording() {
    if (!audioUri) {
      return;
    }

    try {
      await player.seekTo(0);
      player.play();
    } catch (error) {
      Alert.alert("Could not play recording", userFacingErrorMessage(error));
    }
  }

  return (
    <Screen edges={["top"]}>
      <NewQuoteHeader onBack={() => router.back()} step={3} />
      <AnimatedScreenContent contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <NewQuoteTitle
          helper="Talk it through or type it — whatever's faster on site."
          title="Anything else on this job?"
        />

        <View style={styles.group}>
          <SectionKicker>Notes</SectionKicker>
          <View style={[styles.captureCard, recording ? styles.captureCardRecording : null]}>
            <View style={styles.voiceBadgeRow}>
              <View style={[styles.voiceBadge, recording ? styles.voiceBadgeRecording : null]}>
                <Mic color={recording ? colors.green : colors.ink2} size={9} strokeWidth={2.2} />
                <Text style={[styles.voiceBadgeText, recording ? styles.voiceBadgeTextRecording : null]}>
                  {recording
                    ? `Listening · ${formatElapsed(elapsedSeconds)}`
                    : audioUri
                      ? "From voice · tap to edit"
                      : "Type or record"}
                </Text>
              </View>
            </View>
            <TextInput
              editable={!recording && !transcribing}
              multiline
              onChangeText={setNotes}
              placeholder={recording ? "Listening..." : tradeConfig.notes.placeholder}
              placeholderTextColor={colors.ink3}
              style={styles.notesInput}
              textAlignVertical="top"
              value={notes}
            />
            {audioUri || transcribing ? (
              <View style={styles.audioActions}>
                <Pressable
                  accessibilityRole="button"
                  disabled={!audioUri || recording || transcribing}
                  hitSlop={8}
                  onPress={() => void playRecording()}
                  style={styles.audioActionButton}
                >
                  <Play color={colors.ink2} size={12} strokeWidth={2.2} />
                  <Text style={styles.audioActionText}>Re-listen</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={recording || transcribing}
                  hitSlop={8}
                  onPress={() => void startRecording()}
                  style={styles.audioActionButton}
                >
                  <RotateCcw color={colors.ink2} size={12} strokeWidth={2.2} />
                  <Text style={styles.audioActionText}>Re-record</Text>
                </Pressable>
              </View>
            ) : null}
            <View style={styles.captureDivider} />
            <View style={styles.captureFooter}>
              <View style={styles.guardrail}>
                <Lock color={colors.green} size={11} strokeWidth={2.2} />
                <Text style={styles.guardrailText}>
                  {recording
                    ? `${formatElapsed(elapsedSeconds)} · tap mic to stop`
                    : transcribing
                      ? "Writing down the recording..."
                      : "Adds scope, never prices"}
                </Text>
              </View>
              {recording ? (
                <View style={styles.inlineWave}>
                  {WAVE_BARS.slice(0, 11).map((height, index) => (
                    <View key={index} style={[styles.waveBar, { height: Math.max(8, height - 8) }]} />
                  ))}
                </View>
              ) : null}
              <Pressable
                accessibilityLabel={recording ? "Stop recording" : "Start voice note"}
                accessibilityRole="button"
                onPress={() => recording ? void stopRecording() : void startRecording()}
                style={[styles.micButton, recording ? styles.micButtonRecording : null]}
              >
                {recording ? <View style={styles.stopGlyph} /> : <Mic color={colors.surface} size={18} strokeWidth={2.3} />}
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.group}>
          <SectionKicker>Quick add</SectionKicker>
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
      </AnimatedScreenContent>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <Pressable
          accessibilityRole="button"
          disabled={!canContinue}
          onPress={next}
          style={[styles.primaryButton, !canContinue ? styles.primaryButtonDisabled : null]}
        >
          <Text style={[styles.primaryText, !canContinue ? styles.primaryTextDisabled : null]}>
            {recording
              ? "Stop recording to continue"
              : transcribing
                ? "Writing down recording..."
                : "Next — review"}
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
      <Plus
        color={props.active ? colors.surface : colors.ink2}
        size={11}
        strokeWidth={2.2}
      />
      <Text style={[styles.extraChipText, props.active ? styles.extraChipTextActive : null]}>
        {props.label}
      </Text>
    </Pressable>
  );
}

function buildTranscript(input: { extras: string[]; notes: string }) {
  const parts = [
    ...input.extras.map((extra) => `${extra}.`),
    input.notes.trim()
  ].filter((part) => part.trim().length > 0);

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function notesFromTranscript(transcript: string, extras: string[]) {
  let notes = transcript;

  for (const extra of extras) {
    notes = notes.replace(new RegExp(`${escapeRegExp(extra)}\\.?`, "gi"), "");
  }

  return notes.replace(/\s+/g, " ").trim();
}

function mergeNotesWithVoice(currentNotes: string, voiceText: string) {
  const current = currentNotes.trim();
  const voice = voiceText.trim();

  if (voice.length === 0) {
    return current;
  }

  if (current.length === 0) {
    return voice;
  }

  if (current.toLowerCase().includes(voice.toLowerCase())) {
    return current;
  }

  return `${current}\n\n${voice}`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function enableRecordingMode() {
  await setAudioModeAsync({
    allowsRecording: true,
    playsInSilentMode: true
  });
}

async function disableRecordingMode() {
  try {
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true
    });
  } catch (error) {
    console.warn("QuoteVan could not reset audio mode", error);
  }
}

function recordingErrorMessage(error: unknown) {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (
      message.includes("recordingdisabledexception") ||
      message.includes("recording not allowed")
    ) {
      return "Microphone recording was not ready. Try again.";
    }
  }

  return userFacingErrorMessage(error);
}

function recordingFileName(uri: string) {
  const name = uri.split("/").pop()?.split("?")[0] ?? "";
  return name.length > 0 ? name : `job-notes-${Date.now()}.m4a`;
}

function audioContentTypeForUri(uri: string) {
  const lower = uri.toLowerCase();

  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".ogg")) return "audio/ogg";
  if (lower.endsWith(".webm")) return "audio/webm";
  if (lower.endsWith(".aac")) return "audio/aac";
  if (lower.endsWith(".m4a")) return "audio/m4a";

  return "audio/mp4";
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
  captureCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 11,
    borderWidth: 1,
    overflow: "hidden"
  },
  captureCardRecording: {
    borderColor: colors.greenBorder
  },
  captureDivider: {
    backgroundColor: colors.border,
    height: 1
  },
  voiceBadgeRow: {
    flexDirection: "row",
    paddingHorizontal: 13,
    paddingTop: 12
  },
  voiceBadge: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderRadius: 5,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  voiceBadgeRecording: {
    backgroundColor: colors.greenBg,
    borderColor: colors.greenBorder
  },
  voiceBadgeText: {
    color: colors.ink2,
    fontSize: 9,
    ...fontStyles.semibold,
    letterSpacing: 0.45,
    textTransform: "uppercase"
  },
  voiceBadgeTextRecording: {
    color: colors.green
  },
  captureFooter: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
    minHeight: 50,
    paddingLeft: 13,
    paddingRight: 10
  },
  inlineWave: {
    alignItems: "center",
    flexDirection: "row",
    gap: 3,
    height: 20,
    justifyContent: "center",
    pointerEvents: "none",
    width: 72
  },
  waveBar: {
    backgroundColor: colors.greenBorder,
    borderRadius: 2,
    width: 3
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
    gap: 7,
    minHeight: 34,
    paddingHorizontal: 12
  },
  extraChipActive: {
    backgroundColor: colors.dark,
    borderColor: colors.dark
  },
  extraChipText: {
    color: colors.ink,
    fontSize: 12,
    ...fontStyles.semibold,
  },
  extraChipTextActive: {
    color: colors.surface,
    ...fontStyles.semibold,
  },
  notesInput: {
    color: colors.ink,
    fontSize: 13,
    ...fontStyles.regular,
    lineHeight: 19,
    minHeight: 74,
    paddingHorizontal: 13,
    paddingTop: 11
  },
  audioActions: {
    flexDirection: "row",
    gap: 15,
    paddingHorizontal: 13,
    paddingBottom: 11,
    paddingTop: 2
  },
  audioActionButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5
  },
  audioActionText: {
    color: colors.ink2,
    fontSize: 11,
    ...fontStyles.semibold,
  },
  guardrail: {
    alignItems: "center",
    flexDirection: "row",
    flex: 1,
    gap: 5,
    minWidth: 0
  },
  guardrailText: {
    color: colors.green,
    flexShrink: 1,
    fontSize: 11,
    ...fontStyles.semibold,
  },
  micButton: {
    alignItems: "center",
    backgroundColor: colors.dark,
    borderRadius: 999,
    height: 38,
    justifyContent: "center",
    width: 38
  },
  micButtonRecording: {
    backgroundColor: colors.green
  },
  stopGlyph: {
    backgroundColor: colors.surface,
    borderRadius: 3,
    height: 13,
    width: 13
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
    ...typography.primaryAction,
  },
  primaryTextDisabled: {
    color: colors.ink3
  },
  primaryArrow: {
    color: colors.onDark,
    fontSize: 18,
    ...fontStyles.semibold,
  }
});
