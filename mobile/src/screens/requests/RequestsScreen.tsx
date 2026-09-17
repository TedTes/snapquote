import { useState } from "react";
import { Camera, ChevronRight, Inbox, MapPin } from "lucide-react-native";
import { router } from "expo-router";
import type { Href } from "expo-router";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import type { ApiWebsiteRequest } from "../../api/client";
import { snapquoteApi, userFacingErrorMessage } from "../../api/client";
import { BottomTabBar } from "../../shared-ui/BottomTabBar";
import { Screen } from "../../shared-ui/base";
import { AppText } from "../../shared-ui/text";
import { colors, radius, spacing } from "../../shared-ui/theme";
import { useRequestStore } from "../../state/requestStore";
import { formatRelativeToNow } from "../../utils/format";

export default function RequestsScreen() {
  const requests = useRequestStore((state) => state.requests);
  const loading = useRequestStore((state) => state.loading);
  const error = useRequestStore((state) => state.error);
  const setRequests = useRequestStore((state) => state.setRequests);
  const setError = useRequestStore((state) => state.setError);
  const [refreshing, setRefreshing] = useState(false);
  const newCount = requests.filter((request) => request.status === "new").length;

  async function refresh() {
    setRefreshing(true);
    try {
      const response = await snapquoteApi.listRequests();
      setRequests(response.requests);
    } catch (refreshError) {
      setError(userFacingErrorMessage(refreshError));
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <Screen edges={["top"]}>
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={requests.length === 0 ? styles.emptyContent : styles.content}
          refreshControl={<RefreshControl onRefresh={() => void refresh()} refreshing={refreshing} tintColor={colors.ink3} />}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View>
              <AppText variant="screenTitle">Requests</AppText>
              <AppText style={styles.summary} variant="headerSummary">
                {newCount > 0 ? `${newCount} new from your link` : "Website leads and draft quotes"}
              </AppText>
            </View>
            {newCount > 0 ? (
              <View style={styles.countBadge}>
                <AppText style={styles.countText} variant="button">{newCount}</AppText>
              </View>
            ) : null}
          </View>

          {error ? <AppText style={styles.error} tone="red" variant="body">{error}</AppText> : null}

          {requests.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}><Inbox color={colors.accent} size={27} /></View>
              <AppText variant="panelTitle">No requests yet</AppText>
              <AppText style={styles.emptyCopy} variant="body">
                New jobs submitted through your public request link will appear here with photos and a draft quote.
              </AppText>
              {loading ? <AppText variant="meta">Checking for requests...</AppText> : null}
            </View>
          ) : (
            <View style={styles.list}>
              {requests.map((request) => <RequestRow key={request.id} request={request} />)}
            </View>
          )}
        </ScrollView>
      </View>
      <BottomTabBar />
    </Screen>
  );
}

function RequestRow(props: { request: ApiWebsiteRequest }) {
  const { request } = props;
  const unresolved = request.unpricedLineCount + request.unconfirmedLineCount;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/request/${request.id}` as Href)}
      style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
    >
      <View style={styles.rowTop}>
        <View style={styles.rowIdentity}>
          <View style={[styles.statusDot, request.status === "new" ? styles.statusDotNew : null]} />
          <AppText numberOfLines={1} variant="rowTitle">{request.customer.name}</AppText>
        </View>
        <AppText variant="meta">{formatRelativeToNow(request.createdAt)}</AppText>
      </View>
      <View style={styles.metaRow}>
        <MapPin color={colors.ink3} size={14} />
        <AppText numberOfLines={1} style={styles.metaText} variant="body">{request.address}</AppText>
      </View>
      <View style={styles.rowBottom}>
        <View style={styles.metaRow}>
          <Camera color={colors.ink3} size={14} />
          <AppText variant="meta">{request.photoUrls.length} {request.photoUrls.length === 1 ? "photo" : "photos"}</AppText>
          <View style={styles.metaDivider} />
          <AppText tone={unresolved > 0 ? "amber" : "green"} variant="meta">
            {unresolved > 0 ? `${unresolved} to review` : "Draft ready"}
          </AppText>
        </View>
        <ChevronRight color={colors.ink3} size={18} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.lg },
  emptyContent: { flexGrow: 1, padding: spacing.xl, gap: spacing.lg },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  summary: { marginTop: 4 },
  countBadge: { alignItems: "center", backgroundColor: colors.accent, borderRadius: 18, height: 36, justifyContent: "center", minWidth: 36, paddingHorizontal: 10 },
  countText: { color: colors.onDark },
  error: { backgroundColor: colors.redBg, borderColor: colors.redBorder, borderRadius: radius.sm, borderWidth: 1, padding: spacing.md },
  list: { gap: spacing.md },
  row: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, gap: 10, padding: spacing.lg },
  rowPressed: { backgroundColor: colors.surfaceRaised },
  rowTop: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  rowIdentity: { alignItems: "center", flex: 1, flexDirection: "row", gap: 9, marginRight: spacing.md },
  statusDot: { backgroundColor: colors.borderStrong, borderRadius: 5, height: 9, width: 9 },
  statusDotNew: { backgroundColor: colors.accent },
  metaRow: { alignItems: "center", flexDirection: "row", gap: 7 },
  metaText: { flex: 1, color: colors.ink2 },
  metaDivider: { backgroundColor: colors.borderStrong, borderRadius: 2, height: 3, width: 3 },
  rowBottom: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  emptyState: { alignItems: "center", flex: 1, justifyContent: "center", paddingHorizontal: spacing.xxl },
  emptyIcon: { alignItems: "center", backgroundColor: colors.accentBg, borderRadius: 24, height: 48, justifyContent: "center", marginBottom: spacing.lg, width: 48 },
  emptyCopy: { color: colors.ink2, marginBottom: spacing.md, marginTop: spacing.sm, maxWidth: 310, textAlign: "center" }
});
