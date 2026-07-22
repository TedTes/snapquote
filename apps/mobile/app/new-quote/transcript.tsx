import { useState } from "react";
import { Check, Play } from "lucide-react-native";
import { router } from "expo-router";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { PainterChecklist } from "@snapquote/shared";
import { snapquoteApi, userFacingErrorMessage } from "../../src/lib/api";
import { AnimatedScreenContent } from "../../src/ui/AnimatedScreenContent";
import { Screen } from "../../src/ui/components";
import { NewQuoteHeader, NewQuoteTitle, StickyAction } from "../../src/ui/NewQuoteScaffold";
import { colors } from "../../src/ui/theme";
import { useMvpStore } from "../../src/state/mvp";

const sampleTranscript =
  "Paint two bedrooms, patch nail holes, remove the old wallpaper in the hallway, two coats, customer provides paint.";

export default function NewQuoteTranscriptScreen() {
  const wizard = useMvpStore((state) => state.wizard);
  const updateWizard = useMvpStore((state) => state.updateWizard);
  const upsertRemoteQuote = useMvpStore((state) => state.upsertRemoteQuote);
  const startNewQuoteWizard = useMvpStore((state) => state.startNewQuoteWizard);
  const [editing, setEditing] = useState(false);
  const [transcript, setTranscript] = useState(wizard.transcript.trim() || sampleTranscript);
  const [generating, setGenerating] = useState(false);

  async function generate() {
    if (generating) {
      return;
    }

    const currentWizard = { ...wizard, transcript: transcript.trim() };

    if (currentWizard.address.trim().length === 0) {
      Alert.alert("Add a job address", "The address is required before drafting.");
      return;
    }

    updateWizard({ transcript: currentWizard.transcript });
    setGenerating(true);

    try {
      const quote = await snapquoteApi.createQuote({
        address: currentWizard.address.trim(),
        jobTitle: currentWizard.jobTitle.trim(),
        checklist: currentWizard.checklist,
        transcript: currentWizard.transcript,
        customer: {
          name: currentWizard.customerName.trim() || "Unnamed customer",
          email: currentWizard.customerEmail.trim() || undefined,
          phone: currentWizard.customerPhone.trim() || undefined,
          address: currentWizard.address.trim()
        }
      });

      upsertRemoteQuote(quote);
      startNewQuoteWizard();
      router.replace({ pathname: "/quote/[id]", params: { id: quote.id } });
    } catch (error) {
      Alert.alert("Could not generate draft", userFacingErrorMessage(error));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Screen edges={["top"]}>
      <NewQuoteHeader onBack={() => router.back()} step={4} />
      <AnimatedScreenContent contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <NewQuoteTitle
          helper="Fix any words — you can still edit every line after."
          title="Check before drafting"
        />

        <Pressable accessibilityRole="button" onPress={() => setEditing(true)} style={styles.transcriptCard}>
          {editing ? (
            <TextInput
              autoFocus
              multiline
              onChangeText={setTranscript}
              placeholder="Describe the job..."
              placeholderTextColor={colors.ink3}
              style={styles.transcriptInput}
              textAlignVertical="top"
              value={transcript}
            />
          ) : (
            <HighlightedTranscript transcript={transcript} />
          )}
        </Pressable>

        <View style={styles.lockedCard}>
          <Check color={colors.green} size={14} strokeWidth={2.6} />
          <Text style={styles.lockedText}>
            Checklist locked: <Text style={styles.lockedStrong}>{describeChecklist(wizard.checklist)}</Text>. Voice only adds the extras above.
          </Text>
        </View>

        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.listenButton}>
          <Play color={colors.ink2} size={14} strokeWidth={2.1} />
          <Text style={styles.listenText}>Re-listen · 0:24</Text>
        </Pressable>
      </AnimatedScreenContent>
      <StickyAction label={generating ? "Generating..." : "Generate draft"} onPress={() => void generate()} />
    </Screen>
  );
}

function HighlightedTranscript(props: { transcript: string }) {
  const parts = splitHighlightedTranscript(props.transcript);

  return (
    <Text style={styles.transcriptText}>
      {"\""}
      {parts.map((part, index) =>
        part.highlighted ? (
          <Mark key={`${part.text}-${index}`}>{part.text}</Mark>
        ) : (
          <Text key={`${part.text}-${index}`}>{part.text}</Text>
        )
      )}
      {"\""}
    </Text>
  );
}

function Mark(props: { children: string }) {
  return <Text style={styles.mark}>{props.children}</Text>;
}

function splitHighlightedTranscript(transcript: string): { highlighted: boolean; text: string }[] {
  const highlights = /(patch (?:nail )?holes|wallpaper|customer (?:provides|supplies) paint)/gi;
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
  const totalRooms = checklist.rooms.small + checklist.rooms.medium + checklist.rooms.large;
  const roomParts = (["small", "medium", "large"] as const)
    .filter((size) => checklist.rooms[size] > 0)
    .map((size) => `${checklist.rooms[size]} ${size}`);
  const surfaces = [
    checklist.surfaces.walls ? "walls" : null,
    checklist.surfaces.ceilings ? "ceilings" : null,
    checklist.surfaces.trim ? "trim" : null
  ].filter((surface): surface is string => surface !== null);

  const segments = [
    roomParts.length > 0
      ? `${roomParts.join(", ")} room${totalRooms === 1 ? "" : "s"}`
      : "no rooms",
    surfaces.length > 0 ? surfaces.join(", ") : null,
    checklist.doorCount > 0 ? `${checklist.doorCount} door${checklist.doorCount === 1 ? "" : "s"}` : null,
    `${checklist.coatCount} coat${checklist.coatCount === 1 ? "" : "s"}`
  ].filter((segment): segment is string => segment !== null);

  return segments.join(" · ");
}

const styles = StyleSheet.create({
  content: {
    gap: 14,
    paddingBottom: 16,
    paddingTop: 21
  },
  transcriptCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 384,
    marginHorizontal: 19,
    padding: 15
  },
  transcriptText: {
    color: colors.ink2,
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 24
  },
  transcriptInput: {
    color: colors.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 24,
    minHeight: 350,
    padding: 0
  },
  mark: {
    backgroundColor: colors.amberBg,
    color: colors.ink,
    fontWeight: "900"
  },
  lockedCard: {
    alignItems: "flex-start",
    backgroundColor: colors.greenBg,
    borderColor: colors.greenBorder,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 9,
    marginHorizontal: 19,
    padding: 13
  },
  lockedText: {
    color: colors.green,
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17
  },
  lockedStrong: {
    fontWeight: "900"
  },
  listenButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 9,
    height: 39,
    justifyContent: "center",
    marginHorizontal: 19
  },
  listenText: {
    color: colors.ink2,
    fontSize: 13,
    fontWeight: "900"
  }
});
