import type { ReactNode } from "react";
import { router } from "expo-router";
import {
  Building2,
  Camera,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  CreditCard,
  EllipsisVertical,
  LogIn,
  LogOut,
  Mail,
  Phone,
  Shield,
  User
} from "lucide-react-native";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAuthStore } from "../../src/state/auth";
import { getQuoteStatus, useMvpStore } from "../../src/state/mvp";
import { QuoteMark } from "../../src/ui/QuoteMark";
import { Screen } from "../../src/ui/components";
import { colors, radius } from "../../src/ui/theme";

export default function ProfileScreen() {
  const businessName = useMvpStore((state) => state.businessName);
  const quotes = useMvpStore((state) => state.quotes);
  const events = useMvpStore((state) => state.events);
  const me = useAuthStore((state) => state.me);
  const authStatus = useAuthStore((state) => state.status);
  const signOut = useAuthStore((state) => state.signOut);

  const statuses = quotes.map((quote) => getQuoteStatus(quote, events));
  const sentCount = statuses.filter((status) => status === "sent" || status === "viewed" || status === "accepted").length;
  const acceptedCount = statuses.filter((status) => status === "accepted").length;
  const winRate = sentCount > 0 ? Math.round((acceptedCount / sentCount) * 100) : 0;
  const userName = me?.user.name ?? "Guest";
  const email = me?.user.email ?? "Not signed in";

  return (
    <Screen edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.nav}>
          <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.back()} style={styles.navButton}>
            <ChevronLeft color={colors.ink} size={20} strokeWidth={2.4} />
          </Pressable>
          <Text style={styles.navTitle}>Profile</Text>
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => Alert.alert("Profile menu", "More profile actions are coming next.")}
            style={styles.navButton}
          >
            <EllipsisVertical color={colors.ink} size={20} strokeWidth={2.6} />
          </Pressable>
        </View>

        <View style={styles.hero}>
          <View style={styles.logoWrap}>
            <QuoteMark boxed size={78} />
            <Pressable
              accessibilityLabel="Change business logo"
              accessibilityRole="button"
              onPress={() => Alert.alert("Change logo", "Image upload needs the image picker/storage step next.")}
              style={styles.cameraBadge}
            >
              <Camera color={colors.ink2} size={14} strokeWidth={2.2} />
            </Pressable>
          </View>
          <Text style={styles.businessName}>{businessName}</Text>
          <Text style={styles.businessMeta}>Painting · Interior</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => Alert.alert("Business info", "Business info editing is coming next.")}
            style={styles.editButton}
          >
            <Text style={styles.editButtonText}>Edit business info</Text>
          </Pressable>
        </View>

        <View style={styles.statsRow}>
          <StatCard label="Sent" value={sentCount} />
          <StatCard label="Accepted" tone="green" value={acceptedCount} />
          <StatCard label="Win rate" value={`${winRate}%`} />
        </View>

        <ProfileSection label="Business identity">
          <ProfileRow
            detail="Shown on every quote"
            icon={<Building2 color={colors.ink2} size={15} strokeWidth={2.1} />}
            label="Business name & logo"
            onPress={() => Alert.alert("Business identity", "Business profile editing is coming next.")}
          />
          <ProfileRow
            detail="(416) 555-0148 · sharpedge.co"
            icon={<Phone color={colors.ink2} size={15} strokeWidth={2.1} />}
            label="Contact details"
            last
            onPress={() => Alert.alert("Contact details", "Contact detail editing is coming next.")}
          />
        </ProfileSection>

        <ProfileSection label="Account">
          <ProfileRow
            customValue={<PlanBadge />}
            detail="Renews Aug 21"
            icon={<Shield color={colors.ink2} size={15} strokeWidth={2.1} />}
            label="Plan"
            onPress={() => Alert.alert("Plan", "Solo plan for MVP testing.")}
          />
          <ProfileRow
            icon={<CreditCard color={colors.ink2} size={15} strokeWidth={2.1} />}
            label="Manage subscription"
            last
            onPress={() => Alert.alert("Subscription", "Billing portal is coming next.")}
          />
        </ProfileSection>

        <ProfileSection label="Personal & security">
          <ProfileRow
            customValue={<Text style={styles.rowValue}>{userName}</Text>}
            icon={<User color={colors.ink2} size={15} strokeWidth={2.1} />}
            label="Your name"
            onPress={() => Alert.alert("Your name", "Profile editing is coming next.")}
          />
          <ProfileRow
            customValue={authStatus === "signed_in" ? <VerifiedBadge /> : undefined}
            detail={email}
            icon={<Mail color={colors.ink2} size={15} strokeWidth={2.1} />}
            label="Login email"
            last
            onPress={() =>
              authStatus === "signed_in"
                ? Alert.alert("Login email", "Email changes are coming next.")
                : router.push({ pathname: "/auth", params: { from: "app" } })
            }
          />
        </ProfileSection>

        <ProfileSection label="More">
          <ProfileRow
            icon={<CircleHelp color={colors.ink2} size={15} strokeWidth={2.1} />}
            label="Help & feedback"
            onPress={() => Alert.alert("Help & feedback", "Send feedback from the test channel for now.")}
          />
          {authStatus === "signed_in" ? (
            <ProfileRow
              icon={<LogOut color={colors.ink2} size={15} strokeWidth={2.1} />}
              label="Sign out"
              last
              onPress={() => {
                Alert.alert("Sign out", "You will need to sign in again on this phone.", [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Sign out",
                    style: "destructive",
                    onPress: () => {
                      signOut();
                      router.replace("/");
                    }
                  }
                ]);
              }}
              showChevron={false}
            />
          ) : (
            <ProfileRow
              icon={<LogIn color={colors.ink2} size={15} strokeWidth={2.1} />}
              label="Sign in"
              last
              onPress={() => router.push({ pathname: "/auth", params: { from: "app" } })}
            />
          )}
        </ProfileSection>

        <Text style={styles.version}>SnapQuote · v0.4.1</Text>
      </ScrollView>
    </Screen>
  );
}

function StatCard(props: { label: string; value: number | string; tone?: "green" | undefined }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, props.tone === "green" ? styles.statValueGreen : null]}>
        {props.value}
      </Text>
      <Text style={styles.statLabel}>{props.label}</Text>
    </View>
  );
}

function ProfileSection(props: { label: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{props.label}</Text>
      <View style={styles.sectionCard}>{props.children}</View>
    </View>
  );
}

function ProfileRow(props: {
  icon: ReactNode;
  label: string;
  detail?: string | undefined;
  customValue?: ReactNode | undefined;
  onPress: () => void;
  showChevron?: boolean | undefined;
  last?: boolean | undefined;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={props.onPress} style={[styles.row, props.last ? styles.rowLast : null]}>
      <View style={styles.rowIcon}>{props.icon}</View>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{props.label}</Text>
        {props.detail ? (
          <Text numberOfLines={1} style={styles.rowDetail}>
            {props.detail}
          </Text>
        ) : null}
      </View>
      {props.customValue}
      {props.showChevron === false ? null : (
        <ChevronRight color={colors.ink3} size={15} strokeWidth={2.2} />
      )}
    </Pressable>
  );
}

function PlanBadge() {
  return (
    <View style={styles.planBadge}>
      <Text style={styles.planBadgeText}>Solo</Text>
    </View>
  );
}

function VerifiedBadge() {
  return (
    <View style={styles.verifiedBadge}>
      <Text style={styles.verifiedText}>Verified</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 23,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18
  },
  nav: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  navButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    width: 36
  },
  navTitle: {
    color: colors.ink3,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.8,
    textTransform: "uppercase"
  },
  hero: {
    alignItems: "center",
    gap: 6
  },
  logoWrap: {
    height: 86,
    marginBottom: 6,
    position: "relative",
    width: 86
  },
  cameraBadge: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    bottom: 4,
    height: 27,
    justifyContent: "center",
    position: "absolute",
    right: 2,
    width: 27
  },
  businessName: {
    color: colors.ink,
    fontSize: 21,
    fontWeight: "900",
    lineHeight: 25,
    textAlign: "center"
  },
  businessMeta: {
    color: colors.ink3,
    fontSize: 12,
    fontWeight: "700"
  },
  editButton: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 9
  },
  editButtonText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900"
  },
  statsRow: {
    flexDirection: "row",
    gap: 9
  },
  statCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    minHeight: 62,
    justifyContent: "center"
  },
  statValue: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: "900",
    lineHeight: 23
  },
  statValueGreen: {
    color: colors.green
  },
  statLabel: {
    color: colors.ink3,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8,
    marginTop: 3,
    textTransform: "uppercase"
  },
  section: {
    gap: 9
  },
  sectionLabel: {
    color: colors.ink3,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.6,
    paddingHorizontal: 3,
    textTransform: "uppercase"
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: "hidden"
  },
  row: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 61,
    paddingHorizontal: 14
  },
  rowLast: {
    borderBottomWidth: 0
  },
  rowIcon: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 32,
    justifyContent: "center",
    width: 32
  },
  rowText: {
    flex: 1,
    gap: 2,
    minWidth: 0
  },
  rowLabel: {
    color: colors.ink,
    fontSize: 14.5,
    fontWeight: "800"
  },
  rowDetail: {
    color: colors.ink3,
    fontSize: 11,
    fontWeight: "600"
  },
  rowValue: {
    color: colors.ink2,
    fontSize: 13,
    fontWeight: "800"
  },
  planBadge: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 7,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 4
  },
  planBadgeText: {
    color: colors.ink3,
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  verifiedBadge: {
    backgroundColor: colors.greenBg,
    borderColor: colors.greenBorder,
    borderRadius: 7,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 4
  },
  verifiedText: {
    color: colors.green,
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  version: {
    color: colors.ink3,
    fontSize: 10.5,
    fontWeight: "600",
    paddingBottom: 2,
    textAlign: "center"
  }
});
