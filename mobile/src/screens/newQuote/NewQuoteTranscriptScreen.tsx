import { useEffect, useMemo, useRef, useState } from "react";
import { useAudioPlayer } from "expo-audio";
import { ArrowRight, Check, Lock, Mic, Play, Plus } from "lucide-react-native";
import { router } from "expo-router";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { deriveCustomerCity, getTradeConfig, inferQuoteWorkType, type PainterChecklist } from "@snapquote/shared";
import { snapquoteApi, userFacingErrorMessage } from "../../api/client";
import { AnimatedScreenContent } from "../../shared-ui/AnimatedScreenContent";
import { Screen } from "../../shared-ui/base";
import { ProgressModal } from "../../shared-ui/ProgressExperience";
import {
  NewQuoteHeader,
  NewQuoteTitle,
  SectionKicker,
} from "./components/NewQuoteScaffold";
import { colors } from "../../shared-ui/theme";
import { useQuoteStore } from "../../state/quoteStore";
import { useAuthStore } from "../../state/authStore";

const EXTRA_DETECTION_PATTERNS: Record<string, RegExp> = {
  "patch nail holes": /\b(patch|fill|repair)\b.*\b(nail\s+holes?|holes?)\b/i,
  "remove wallpaper": /\b(remove|strip|take\s+off)\b.*\bwallpaper\b/i,
  primer: /\b(primer|prime|priming)\b/i,
  "material allowance": /\b(materials?|paint)\b.*\ballowance\b|\ballowance\b.*\b(materials?|paint)\b/i
};

export default function NewQuoteTranscriptScreen() {
  const wizard = useQuoteStore((state) => state.wizard);
  const updateWizard = useQuoteStore((state) => state.updateWizard);
  const activeTrade = useQuoteStore((state) => state.activeTrade);
  const tradeConfig = getTradeConfig(activeTrade);
  const upsertRemoteQuote = useQuoteStore((state) => state.upsertRemoteQuote);
  const startNewQuoteWizard = useQuoteStore((state) => state.startNewQuoteWizard);
  const generateDraftFromWizard = useQuoteStore(
    (state) => state.generateDraftFromWizard,
  );
  const authStatus = useAuthStore((state) => state.status);
  const insets = useSafeAreaInsets();
  const player = useAudioPlayer(wizard.audioUri ? { uri: wizard.audioUri } : null);
  const [editing, setEditing] = useState(false);
  const [transcript, setTranscript] = useState(wizard.transcript.trim());
  const extraDetections = tradeConfig.notes.chips;
  const detectedExtras = useMemo(
    () => detectExtras(transcript, extraDetections),
    [extraDetections, transcript],
  );
  const [confirmedExtras, setConfirmedExtras] = useState<string[]>(detectedExtras);
  const [generating, setGenerating] = useState(false);
  const navigatingToDraftRef = useRef(false);
  const reviewedTranscript = useMemo(
    () => mergeConfirmedExtras(transcript, confirmedExtras),
    [confirmedExtras, transcript]
  );

  useEffect(() => {
    if (navigatingToDraftRef.current) {
      return;
    }

    if (wizard.address.trim().length === 0) {
      router.replace("/new-quote");
    }
  }, [wizard.address]);

  function normalizedTranscript() {
    return reviewedTranscript.trim().replace(/\s+/g, " ");
  }

  function toggleExtra(phrase: string) {
    setConfirmedExtras((current) =>
      current.includes(phrase)
        ? current.filter((item) => item !== phrase)
        : [...current, phrase]
    );
  }

  async function generate() {
    if (generating) {
      return;
    }

    const currentWizard = { ...wizard, transcript: normalizedTranscript() };

    if (currentWizard.address.trim().length === 0) {
      router.replace("/new-quote");
      return;
    }

    if (currentWizard.transcript.length > 5000) {
      Alert.alert("Shorten the notes", "Job notes must be 5,000 characters or fewer.");
      return;
    }

    updateWizard({ transcript: currentWizard.transcript });
    setGenerating(true);

    try {
      if (authStatus !== "signed_in") {
        navigatingToDraftRef.current = true;
        const quote = generateDraftFromWizard();
        router.replace({ pathname: "/quote/[id]", params: { id: quote.id } });
        return;
      }

      // A picked customer only has a real customerId once it's synced to the backend
      // (local-only customers use a "cust-" prefixed id). Reference it directly rather
      // than sending an inline customer object, which would otherwise be treated as a
      // new/matched customer server-side.
      const pickedRemoteCustomerId =
        currentWizard.customerId !== null && !currentWizard.customerId.startsWith("cust-")
          ? currentWizard.customerId
          : null;

      const quote = await snapquoteApi.createQuote({
        address: currentWizard.address.trim(),
        workType: inferQuoteWorkType({
          workType: currentWizard.workType,
          jobTitle: currentWizard.jobTitle,
          checklist: currentWizard.checklist,
        }),
        jobTitle: currentWizard.jobTitle.trim(),
        checklist: currentWizard.checklist,
        transcript: currentWizard.transcript,
        audioStoragePath: currentWizard.audioStoragePath,
        audioContentType: currentWizard.audioContentType,
        audioDurationSeconds: currentWizard.audioDurationSeconds,
        ...(pickedRemoteCustomerId !== null
          ? { customerId: pickedRemoteCustomerId }
          : {
              customer: {
                name: currentWizard.customerName.trim() || "Unnamed customer",
                email: currentWizard.customerEmail.trim() || undefined,
                phone: currentWizard.customerPhone.trim() || undefined,
                address: currentWizard.address.trim(),
                city: deriveCustomerCity(currentWizard.address),
              },
            }),
      });

      upsertRemoteQuote(quote);
      navigatingToDraftRef.current = true;
      startNewQuoteWizard();
      router.replace({ pathname: "/quote/[id]", params: { id: quote.id } });
    } catch (error) {
      Alert.alert("Could not generate draft", userFacingErrorMessage(error));
    } finally {
      setGenerating(false);
    }
  }

  async function playRecording() {
    if (!wizard.audioUri) {
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
      <NewQuoteHeader onBack={() => router.back()} step={4} />
      <AnimatedScreenContent
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <NewQuoteTitle
          helper="Fix any words — you can still edit every line after."
          title="Check before drafting"
        />

        <View style={styles.lockedCard}>
          <Lock color={colors.green} size={14} strokeWidth={2.4} />
          <Text style={styles.lockedText}>
            Checklist locked:{" "}
            <Text style={styles.lockedStrong}>
              {describeChecklist(wizard.checklist)}
            </Text>
            . {tradeConfig.notes.lockedCopy}
          </Text>
        </View>

        <View style={styles.group}>
          <View style={styles.kickerRow}>
            <SectionKicker>What you said</SectionKicker>
            <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setEditing((value) => !value)}>
              <Text style={styles.kickerAction}>{editing ? "done" : "tap to edit"}</Text>
            </Pressable>
          </View>
          <View style={styles.transcriptCard}>
            <View style={styles.audioRow}>
              <Mic color={colors.ink3} size={11} strokeWidth={2.2} />
              <Text style={styles.audioTime}>{formatElapsed(wizard.audioDurationSeconds ?? 0)}</Text>
              <View style={styles.audioSpacer} />
              <Pressable
                accessibilityRole="button"
                disabled={!wizard.audioUri}
                hitSlop={8}
                onPress={() => void playRecording()}
                style={styles.relistenButton}
              >
                <Play color={colors.ink2} size={13} strokeWidth={2.1} />
                <Text style={styles.audioAction}>{wizard.audioUri ? "Re-listen" : "No recording"}</Text>
              </Pressable>
            </View>
            {editing ? (
              <TextInput
                autoFocus
                multiline
                onChangeText={setTranscript}
                placeholder="Type anything the checklist didn't cover..."
                placeholderTextColor={colors.ink3}
                style={styles.transcriptInput}
                textAlignVertical="top"
                value={transcript}
              />
            ) : transcript.trim().length === 0 ? (
              <Text style={styles.emptyTranscriptText}>
                No extra notes. The quote will be built from the locked checklist.
              </Text>
            ) : (
              <HighlightedTranscript transcript={transcript} />
            )}
          </View>
        </View>

        <View style={styles.group}>
          <View style={styles.kickerRow}>
            <SectionKicker>Extras detected</SectionKicker>
            <Text style={styles.kickerAction}>confirm before drafting</Text>
          </View>
          <View style={styles.extraWrap}>
            {extraDetections.map((extra) => {
              const active = confirmedExtras.includes(extra.phrase);
              const detected = detectedExtras.includes(extra.phrase);

              if (!detected && extra.phrase !== "primer") {
                return null;
              }

              return (
                <ExtraChip
                  key={extra.phrase}
                  active={active}
                  label={extra.label}
                  onPress={() => toggleExtra(extra.phrase)}
                />
              );
            })}
          </View>
        </View>
      </AnimatedScreenContent>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <Pressable
          accessibilityRole="button"
          disabled={generating}
          onPress={() => void generate()}
          style={[styles.primaryButton, generating ? styles.primaryButtonDisabled : null]}
        >
          <Text style={[styles.primaryText, generating ? styles.primaryTextDisabled : null]}>
            {generating ? "Generating..." : "Generate draft"}
          </Text>
          <ArrowRight
            color={generating ? colors.ink3 : colors.onDark}
            size={16}
            strokeWidth={2.4}
          />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={generating}
          onPress={() => router.back()}
          style={styles.backToNotes}
        >
          <Text style={styles.backToNotesText}>← Back to notes</Text>
        </Pressable>
      </View>
      <ProgressModal
        helper="QuoteVan is preparing editable line items from this job."
        title="Building quote"
        visible={generating}
      />
    </Screen>
  );
}

function HighlightedTranscript(props: { transcript: string }) {
  const parts = splitHighlightedTranscript(props.transcript);

  return (
    <Text style={styles.transcriptText}>
      {'"'}
      {parts.map((part, index) =>
        part.highlighted ? (
          <Mark key={`${part.text}-${index}`}>{part.text}</Mark>
        ) : (
          <Text key={`${part.text}-${index}`}>{part.text}</Text>
        ),
      )}
      {'"'}
    </Text>
  );
}

function Mark(props: { children: string }) {
  return <Text style={styles.mark}>{props.children}</Text>;
}

function ExtraChip(props: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: props.active }}
      onPress={props.onPress}
      style={[styles.extraChip, props.active ? styles.extraChipActive : null]}
    >
      {props.active ? (
        <Check color={colors.amber} size={13} strokeWidth={2.5} />
      ) : (
        <Plus color={colors.ink2} size={13} strokeWidth={2.2} />
      )}
      <Text style={[styles.extraChipText, props.active ? styles.extraChipTextActive : null]}>
        {props.label}
      </Text>
    </Pressable>
  );
}

function detectExtras(
  transcript: string,
  extras: Array<{ phrase: string }>,
) {
  return extras
    .filter((extra) => {
      const pattern = EXTRA_DETECTION_PATTERNS[extra.phrase];
      return pattern ? pattern.test(transcript) : transcript.toLowerCase().includes(extra.phrase.toLowerCase());
    })
    .map((extra) => extra.phrase);
}

function mergeConfirmedExtras(transcript: string, extras: string[]) {
  const existing = transcript.trim();
  const missingExtras = extras.filter(
    (extra) => !existing.toLowerCase().includes(extra.toLowerCase())
  );

  return [existing, ...missingExtras.map((extra) => `${extra}.`)]
    .filter((part) => part.trim().length > 0)
    .join(" ")
    .trim();
}

function formatElapsed(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function splitHighlightedTranscript(
  transcript: string,
): { highlighted: boolean; text: string }[] {
  const highlights =
    /(patch (?:nail )?holes|wallpaper|customer (?:provides|supplies) paint|primer|material allowance)/gi;
  const parts: { highlighted: boolean; text: string }[] = [];
  let cursor = 0;

  for (const match of transcript.matchAll(highlights)) {
    const index = match.index ?? 0;

    if (index > cursor) {
      parts.push({ highlighted: false, text: transcript.slice(cursor, index) });
    }

    parts.push({ highlighted: true, text: match[0] });
    cursor = index + match[0].length;
  }

  if (cursor < transcript.length) {
    parts.push({ highlighted: false, text: transcript.slice(cursor) });
  }

  return parts.length > 0 ? parts : [{ highlighted: false, text: transcript }];
}

function describeChecklist(checklist: PainterChecklist): string {
  const totalRooms =
    checklist.rooms.small + checklist.rooms.medium + checklist.rooms.large;
  const roomParts = (["small", "medium", "large"] as const)
    .filter((size) => checklist.rooms[size] > 0)
    .map((size) => `${checklist.rooms[size]} ${size}`);
  const surfaces = [
    checklist.surfaces.walls ? "walls" : null,
    checklist.surfaces.ceilings ? "ceilings" : null,
    checklist.surfaces.trim ? "trim" : null,
  ].filter((surface): surface is string => surface !== null);

  const segments = [
    roomParts.length > 0
      ? `${roomParts.join(", ")} room${totalRooms === 1 ? "" : "s"}`
      : "no rooms",
    surfaces.length > 0 ? surfaces.join(", ") : null,
    checklist.doorCount > 0
      ? `${checklist.doorCount} door${checklist.doorCount === 1 ? "" : "s"}`
      : null,
    `${checklist.coatCount} coat${checklist.coatCount === 1 ? "" : "s"}`,
  ].filter((segment): segment is string => segment !== null);

  return segments.join(" · ");
}

const styles = StyleSheet.create({
  content: {
    gap: 14,
    paddingBottom: 14,
    paddingTop: 21,
  },
  lockedCard: {
    alignItems: "flex-start",
    backgroundColor: colors.greenBg,
    borderColor: colors.greenBorder,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    marginHorizontal: 20,
    padding: 13,
  },
  lockedText: {
    color: colors.green,
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
  },
  lockedStrong: {
    fontWeight: "900",
  },
  group: {
    gap: 8,
    paddingHorizontal: 20
  },
  kickerRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  kickerAction: {
    color: colors.ink3,
    fontSize: 10,
    fontWeight: "700"
  },
  transcriptCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
    minHeight: 126,
    padding: 13,
  },
  audioRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5
  },
  audioTime: {
    color: colors.ink3,
    fontSize: 11,
    fontWeight: "800"
  },
  audioSpacer: {
    flex: 1
  },
  relistenButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4
  },
  audioAction: {
    color: colors.ink2,
    fontSize: 12,
    fontWeight: "800"
  },
  transcriptText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 21,
  },
  transcriptInput: {
    color: colors.ink,
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 21,
    minHeight: 86,
    padding: 0,
  },
  emptyTranscriptText: {
    color: colors.ink3,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 20,
  },
  mark: {
    backgroundColor: colors.amberBg,
    color: colors.ink,
    fontWeight: "900",
  },
  extraWrap: {
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
  footer: {
    backgroundColor: colors.bg,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
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
    backgroundColor: colors.surfaceMuted,
  },
  primaryText: {
    color: colors.onDark,
    fontSize: 15,
    fontWeight: "900"
  },
  primaryTextDisabled: {
    color: colors.ink3
  },
  backToNotes: {
    alignItems: "center",
    paddingTop: 9,
  },
  backToNotesText: {
    color: colors.ink2,
    fontSize: 12,
    fontWeight: "800",
  },
});
