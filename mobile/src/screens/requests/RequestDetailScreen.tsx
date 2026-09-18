import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Archive, Camera, Check, CheckCircle2, ChevronRight, Clock3, Mail, MapPin, Phone, Play, Search, User, X } from "lucide-react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Alert, Image, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import type { ApiWebsiteRequest } from "../../api/client";
import { snapquoteApi, userFacingErrorMessage } from "../../api/client";
import { Screen, TopBar } from "../../shared-ui/base";
import { AppText } from "../../shared-ui/text";
import { colors, radius, shadowSm, spacing } from "../../shared-ui/theme";
import { useQuoteStore } from "../../state/quoteStore";
import { useRequestStore } from "../../state/requestStore";
import { formatDateTime } from "../../utils/format";

export default function RequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const storedRequest = useRequestStore((state) => state.requests.find((request) => request.id === id));
  const upsertRequest = useRequestStore((state) => state.upsertRequest);
  const removeRequest = useRequestStore((state) => state.removeRequest);
  const upsertRemoteQuote = useQuoteStore((state) => state.upsertRemoteQuote);
  const [request, setRequest] = useState<ApiWebsiteRequest | null>(storedRequest ?? null);
  const [busyAction, setBusyAction] = useState<"call" | "email" | "archive" | "analyze" | null>(null);
  const [busySuggestionId, setBusySuggestionId] = useState<string | null>(null);

  useEffect(() => {
    if (storedRequest) setRequest(storedRequest);
  }, [storedRequest]);

  useFocusEffect(useCallback(() => {
    if (!id) return;
    let active = true;

    void snapquoteApi.getRequest(id).then((next) => {
      if (!active) return;
      setRequest(next);
      upsertRequest(next);
      if (next.quote) upsertRemoteQuote(next.quote);
    }).catch((error) => {
      if (active) Alert.alert("Could not open request", userFacingErrorMessage(error));
    });

    return () => { active = false; };
  }, [id, upsertRemoteQuote, upsertRequest]));

  if (!request) {
    return (
      <Screen>
        <TopBar onBack={() => router.back()} title="Request" />
        <View style={styles.loading}><AppText variant="body">Loading request...</AppText></View>
      </Screen>
    );
  }

  async function contact(channel: "call" | "email") {
    const value = channel === "call" ? request?.customer.phone : request?.customer.email;
    if (!request || !value) {
      Alert.alert(channel === "call" ? "No phone number" : "No email address", `This customer did not provide an ${channel === "call" ? "phone number" : "email address"}.`);
      return;
    }

    setBusyAction(channel);
    try {
      const next = await snapquoteApi.contactRequest(request.id, channel);
      setRequest(next);
      upsertRequest(next);
      const url = channel === "call"
        ? `tel:${value}`
        : `mailto:${value}?subject=${encodeURIComponent(`Your quote request at ${request.address}`)}`;
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert(`Could not ${channel === "call" ? "call" : "email"} customer`, userFacingErrorMessage(error));
    } finally {
      setBusyAction(null);
    }
  }

  function openDraft() {
    if (!request?.quote) {
      Alert.alert("Draft unavailable", "Refresh this request and try again.");
      return;
    }
    upsertRemoteQuote(request.quote);
    router.push({ pathname: "/quote/[id]", params: { id: request.quote.id } });
  }

  function confirmPhotoAnalysis() {
    Alert.alert(
      "Analyze job photos?",
      "The photos, job notes, and checklist will be securely shared with OpenAI. Customer contact details and the job address are not included.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Analyze", onPress: () => void analyzePhotos() }
      ]
    );
  }

  async function analyzePhotos() {
    if (!request) return;
    setBusyAction("analyze");
    try {
      const next = await snapquoteApi.analyzeRequest(request.id);
      setRequest(next);
      upsertRequest(next);
    } catch (error) {
      Alert.alert("Could not analyze photos", userFacingErrorMessage(error));
    } finally {
      setBusyAction(null);
    }
  }

  async function decideSuggestion(suggestionId: string, decision: "accept" | "reject") {
    if (!request) return;
    setBusySuggestionId(suggestionId);
    try {
      const next = decision === "accept"
        ? await snapquoteApi.acceptRequestSuggestion(request.id, suggestionId)
        : await snapquoteApi.rejectRequestSuggestion(request.id, suggestionId);
      setRequest(next);
      upsertRequest(next);
      if (next.quote) upsertRemoteQuote(next.quote);
    } catch (error) {
      Alert.alert("Could not update suggestion", userFacingErrorMessage(error));
    } finally {
      setBusySuggestionId(null);
    }
  }

  function confirmArchive() {
    Alert.alert("Archive request?", "The linked quote stays in Quotes.", [
      { text: "Cancel", style: "cancel" },
      { text: "Archive", style: "destructive", onPress: () => void archive() }
    ]);
  }

  async function archive() {
    if (!request) return;
    setBusyAction("archive");
    try {
      await snapquoteApi.archiveRequest(request.id);
      removeRequest(request.id);
      router.replace("/requests");
    } catch (error) {
      Alert.alert("Could not archive request", userFacingErrorMessage(error));
    } finally {
      setBusyAction(null);
    }
  }

  const roomCount = request.checklist.rooms.small + request.checklist.rooms.medium + request.checklist.rooms.large;
  const statusLabel = request.status === "quote_sent" ? "Quote sent" : request.status === "contacted" ? "Contacted" : request.status === "new" ? "New" : "Opened";
  const videos = request.media?.filter((item) => item.type === "video" && item.url) ?? [];

  return (
    <Screen>
      <TopBar
        onBack={() => router.back()}
        right={<StatusBadge label={statusLabel} active={request.status === "new"} />}
        title="Request"
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <AppText variant="screenTitle">{request.customer.name}</AppText>
          <View style={styles.detailLine}><MapPin color={colors.ink3} size={16} /><AppText variant="body">{request.address}{request.city ? `, ${request.city}` : ""}</AppText></View>
          <View style={styles.detailLine}><Clock3 color={colors.ink3} size={16} /><AppText variant="body">{timingLabel(request.timing)} · {formatDateTime(request.createdAt)}</AppText></View>
        </View>

        <View style={styles.actions}>
          <ContactButton disabled={!request.customer.phone || busyAction !== null} icon={Phone} label={busyAction === "call" ? "Opening" : "Call"} onPress={() => void contact("call")} />
          <ContactButton disabled={!request.customer.email || busyAction !== null} icon={Mail} label={busyAction === "email" ? "Opening" : "Email"} onPress={() => void contact("email")} />
        </View>

        <Section title="Job details">
          <InfoRow icon={User} label="Customer" value={request.customer.name} />
          <InfoRow icon={Camera} label="Scope" value={`${roomCount} ${roomCount === 1 ? "room" : "rooms"} · ${request.checklist.coatCount} ${request.checklist.coatCount === 1 ? "coat" : "coats"}`} />
          {request.notes.trim() ? <AppText style={styles.notes} variant="body">{request.notes}</AppText> : null}
        </Section>

        {request.photoUrls.length > 0 ? (
          <View style={styles.section}>
            <AppText variant="sectionLabel">Photos</AppText>
            <ScrollView contentContainerStyle={styles.photoRow} horizontal showsHorizontalScrollIndicator={false}>
              {request.photoUrls.map((url, index) => <Image key={url} source={{ uri: url }} style={styles.photo} accessibilityLabel={`Job photo ${index + 1}`} />)}
            </ScrollView>
          </View>
        ) : null}

        {videos.length > 0 ? (
          <View style={styles.section}>
            <AppText variant="sectionLabel">Video</AppText>
            {videos.map((video) => (
              <Pressable
                accessibilityRole="button"
                key={video.id}
                onPress={() => video.url ? void Linking.openURL(video.url) : undefined}
                style={styles.videoRow}
              >
                <View style={styles.videoIcon}><Play color={colors.accent} fill={colors.accent} size={18} /></View>
                <View style={styles.suggestionCopy}>
                  <AppText numberOfLines={1} variant="rowTitle">{video.fileName}</AppText>
                  <AppText variant="meta">Open customer video</AppText>
                </View>
                <ChevronRight color={colors.ink3} size={20} />
              </Pressable>
            ))}
          </View>
        ) : null}

        {request.photoUrls.length > 0 ? (
          <PhotoAnalysisSection
            analyzing={busyAction === "analyze"}
            busySuggestionId={busySuggestionId}
            onAnalyze={confirmPhotoAnalysis}
            onDecision={(suggestionId, decision) => void decideSuggestion(suggestionId, decision)}
            request={request}
          />
        ) : null}

        <Section title="Draft quote">
          <View style={styles.draftSummary}>
            <View>
              <AppText variant="rowTitle">{request.lineCount} suggested {request.lineCount === 1 ? "line" : "lines"}</AppText>
              <AppText tone={request.unpricedLineCount + request.unconfirmedLineCount > 0 ? "amber" : "green"} variant="meta">
                {draftStatus(request)}
              </AppText>
            </View>
            <ChevronRight color={colors.ink3} size={20} />
          </View>
        </Section>

        <Pressable accessibilityRole="button" onPress={openDraft} style={styles.primaryButton}>
          <AppText tone="onDark" variant="primaryAction">{request.status === "quote_sent" ? "View sent quote" : "Review and price draft"}</AppText>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={busyAction !== null} onPress={confirmArchive} style={styles.archiveButton}>
          <Archive color={colors.red} size={17} />
          <AppText tone="red" variant="button">{busyAction === "archive" ? "Archiving..." : "Archive request"}</AppText>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

function PhotoAnalysisSection(props: {
  analyzing: boolean;
  busySuggestionId: string | null;
  onAnalyze: () => void;
  onDecision: (suggestionId: string, decision: "accept" | "reject") => void;
  request: ApiWebsiteRequest;
}) {
  const analysis = props.request.analysis;
  const pendingSuggestions = analysis?.suggestions?.filter((suggestion) => suggestion.status === "pending") ?? [];
  const completed = analysis?.status === "completed";
  const failed = analysis?.status === "failed";

  return (
    <View style={styles.section}>
      <View style={styles.analysisHeading}>
        <AppText variant="sectionLabel">Photo analysis</AppText>
        {completed ? <View style={styles.analysisDone}><CheckCircle2 color={colors.accent} size={15} /><AppText tone="green" variant="meta">Analyzed</AppText></View> : null}
      </View>
      <View style={styles.analysisBody}>
        {completed ? (
          <>
            {analysis.summary.summary ? <AppText variant="body">{analysis.summary.summary}</AppText> : null}
            {pendingSuggestions.map((suggestion) => (
              <View key={suggestion.id} style={styles.suggestionRow}>
                <View style={styles.suggestionCopy}>
                  <AppText variant="rowTitle">{suggestion.description}</AppText>
                  <AppText variant="meta">{suggestionLabel(suggestion.type, suggestion.confidence, suggestion.evidenceMediaIds.length)}</AppText>
                </View>
                <View style={styles.suggestionActions}>
                  <Pressable
                    accessibilityLabel="Dismiss suggestion"
                    accessibilityRole="button"
                    disabled={props.busySuggestionId !== null}
                    onPress={() => props.onDecision(suggestion.id, "reject")}
                    style={styles.suggestionIconButton}
                  >
                    <X color={colors.ink3} size={17} />
                  </Pressable>
                  <Pressable
                    accessibilityLabel={suggestion.type === "task" ? "Add suggestion to draft" : "Keep suggestion in scope notes"}
                    accessibilityRole="button"
                    disabled={props.busySuggestionId !== null}
                    onPress={() => props.onDecision(suggestion.id, "accept")}
                    style={styles.suggestionAcceptButton}
                  >
                    <Check color={colors.onDark} size={17} />
                  </Pressable>
                </View>
              </View>
            ))}
            {pendingSuggestions.length === 0 ? <AppText tone="green" variant="meta">All photo suggestions reviewed.</AppText> : null}
            {analysis.summary.coverage && !analysis.summary.coverage.sufficient ? (
              <View style={styles.coverageWarning}>
                <AlertTriangle color={colors.amber} size={17} />
                <AppText style={styles.coverageCopy} tone="amber" variant="meta">
                  {analysis.summary.coverage.missing.join(" · ")}
                </AppText>
              </View>
            ) : null}
          </>
        ) : (
          <>
            <View style={styles.analysisIntro}>
              {failed ? <AlertTriangle color={colors.red} size={20} /> : <Search color={colors.accent} size={20} />}
              <View style={styles.suggestionCopy}>
                <AppText variant="rowTitle">{failed ? "Analysis needs another try" : "Check visible scope"}</AppText>
                <AppText variant="meta">{failed ? "The photos were not changed." : "Find visible prep work and scope that may need review."}</AppText>
              </View>
            </View>
            <Pressable accessibilityRole="button" disabled={props.analyzing} onPress={props.onAnalyze} style={[styles.analysisButton, props.analyzing ? styles.disabled : null]}>
              <Search color={colors.onDark} size={17} />
              <AppText tone="onDark" variant="button">{props.analyzing ? "Analyzing..." : failed ? "Try analysis again" : "Analyze photos"}</AppText>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

function suggestionLabel(type: "task" | "site_condition" | "question", confidence: number, photoCount: number) {
  const kind = type === "task" ? "Suggested work" : type === "site_condition" ? "Site condition" : "Question";
  const evidence = photoCount > 0 ? `${photoCount} ${photoCount === 1 ? "photo" : "photos"}` : "Needs confirmation";
  return `${kind} · ${Math.round(confidence * 100)}% confidence · ${evidence}`;
}

function Section(props: { children: React.ReactNode; title: string }) {
  return <View style={styles.section}><AppText variant="sectionLabel">{props.title}</AppText><View style={styles.sectionBody}>{props.children}</View></View>;
}

function InfoRow(props: { icon: typeof User; label: string; value: string }) {
  const Icon = props.icon;
  return <View style={styles.infoRow}><Icon color={colors.ink3} size={16} /><View style={styles.infoCopy}><AppText variant="meta">{props.label}</AppText><AppText variant="rowTitle">{props.value}</AppText></View></View>;
}

function ContactButton(props: { disabled: boolean; icon: typeof Phone; label: string; onPress: () => void }) {
  const Icon = props.icon;
  return <Pressable accessibilityRole="button" disabled={props.disabled} onPress={props.onPress} style={[styles.contactButton, props.disabled ? styles.disabled : null]}><Icon color={colors.ink} size={18} /><AppText variant="button">{props.label}</AppText></Pressable>;
}

function StatusBadge(props: { active: boolean; label: string }) {
  return <View style={[styles.statusBadge, props.active ? styles.statusBadgeActive : null]}><AppText style={props.active ? styles.statusBadgeTextActive : null} variant="statusPill">{props.label}</AppText></View>;
}

function timingLabel(timing: ApiWebsiteRequest["timing"]) {
  if (timing === "asap") return "As soon as possible";
  if (timing === "this_month") return "This month";
  if (timing === "just_pricing") return "Comparing quotes";
  return "Flexible timing";
}

function draftStatus(request: ApiWebsiteRequest) {
  const unresolved = request.unpricedLineCount + request.unconfirmedLineCount;
  if (unresolved === 0) return "Ready to preview and send";
  return `${unresolved} ${unresolved === 1 ? "line needs" : "lines need"} your review`;
}

const styles = StyleSheet.create({
  loading: { alignItems: "center", flex: 1, justifyContent: "center" },
  content: { gap: spacing.xl, padding: spacing.xl, paddingBottom: 40 },
  hero: { gap: spacing.sm },
  detailLine: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
  actions: { flexDirection: "row", gap: spacing.md },
  contactButton: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, flex: 1, flexDirection: "row", gap: spacing.sm, justifyContent: "center", minHeight: 48, ...shadowSm },
  disabled: { opacity: 0.4 },
  section: { gap: spacing.sm },
  sectionBody: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, overflow: "hidden" },
  infoRow: { alignItems: "center", borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: "row", gap: spacing.md, minHeight: 62, paddingHorizontal: spacing.lg },
  infoCopy: { flex: 1, gap: 2 },
  notes: { padding: spacing.lg },
  photoRow: { gap: spacing.md, paddingRight: spacing.xl },
  photo: { backgroundColor: colors.surfaceMuted, borderRadius: radius.sm, height: 190, width: 260 },
  videoRow: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, flexDirection: "row", gap: spacing.md, minHeight: 68, padding: spacing.md },
  videoIcon: { alignItems: "center", backgroundColor: colors.accentBg, borderRadius: radius.sm, height: 42, justifyContent: "center", width: 42 },
  analysisHeading: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  analysisDone: { alignItems: "center", flexDirection: "row", gap: spacing.xs },
  analysisBody: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, gap: spacing.md, padding: spacing.lg },
  analysisIntro: { alignItems: "center", flexDirection: "row", gap: spacing.md },
  analysisButton: { alignItems: "center", backgroundColor: colors.dark, borderRadius: radius.sm, flexDirection: "row", gap: spacing.sm, justifyContent: "center", minHeight: 48 },
  suggestionRow: { alignItems: "center", borderTopColor: colors.border, borderTopWidth: 1, flexDirection: "row", gap: spacing.md, paddingTop: spacing.md },
  suggestionCopy: { flex: 1, gap: 3 },
  suggestionActions: { flexDirection: "row", gap: spacing.sm },
  suggestionIconButton: { alignItems: "center", borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, height: 38, justifyContent: "center", width: 38 },
  suggestionAcceptButton: { alignItems: "center", backgroundColor: colors.accent, borderRadius: radius.sm, height: 38, justifyContent: "center", width: 38 },
  coverageWarning: { alignItems: "flex-start", backgroundColor: colors.amberBg, borderRadius: radius.sm, flexDirection: "row", gap: spacing.sm, padding: spacing.md },
  coverageCopy: { flex: 1 },
  draftSummary: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", minHeight: 74, padding: spacing.lg },
  primaryButton: { alignItems: "center", backgroundColor: colors.dark, borderRadius: radius.sm, justifyContent: "center", minHeight: 54 },
  archiveButton: { alignItems: "center", flexDirection: "row", gap: spacing.sm, justifyContent: "center", minHeight: 44 },
  statusBadge: { backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
  statusBadgeActive: { backgroundColor: colors.accentBg, borderColor: colors.accentBorder },
  statusBadgeTextActive: { color: colors.accent }
});
