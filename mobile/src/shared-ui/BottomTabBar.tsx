import { ClipboardList, Home, Inbox, Plus, Settings as SettingsIcon } from "lucide-react-native";
import { router, usePathname } from "expo-router";
import type { Href } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fontStyles, shadowSm, spacing } from "./theme";
import { AppText } from "./text";
import { useQuoteStore } from "../state/quoteStore";
import { unreadRequestCount, useRequestStore } from "../state/requestStore";
import { useRemoteRequestRefresh } from "../sync/useRemoteRequestRefresh";

const tabs = [
  { href: "/" as const, label: "Today", icon: Home },
  { href: "/requests" as const, label: "Requests", icon: Inbox },
  { href: "/quotes" as const, label: "Quotes", icon: ClipboardList },
  { href: "/settings" as const, label: "Settings", icon: SettingsIcon }
];

export function BottomTabBar() {
  useRemoteRequestRefresh({ pollMs: 30000 });
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const startNewQuoteWizard = useQuoteStore((state) => state.startNewQuoteWizard);
  const requestCount = useRequestStore((state) => unreadRequestCount(state.requests));

  function startQuote() {
    startNewQuoteWizard();
    router.push("/new-quote");
  }

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      {tabs.slice(0, 2).map((tab) => (
        <TabItem key={tab.href} active={pathname === tab.href} badge={tab.href === "/requests" ? requestCount : 0} tab={tab} />
      ))}

      <View style={styles.actionItem}>
        <View style={styles.actionHalo}>
          <Pressable
            accessibilityLabel="Start quote"
            accessibilityRole="button"
            onPress={startQuote}
            style={styles.actionButton}
          >
            <Plus color={colors.onDark} size={25} strokeWidth={2.55} />
          </Pressable>
        </View>
      </View>

      {tabs.slice(2).map((tab) => (
        <TabItem key={tab.href} active={pathname === tab.href} badge={0} tab={tab} />
      ))}
    </View>
  );
}

function TabItem(props: { active: boolean; badge: number; tab: (typeof tabs)[number] }) {
  const Icon = props.tab.icon;

  return (
    <Pressable accessibilityRole="button" onPress={() => router.replace(props.tab.href as Href)} style={styles.item}>
      <View style={[styles.iconWrap, props.active ? styles.iconWrapActive : null]}>
        <Icon color={props.active ? colors.ink : colors.ink3} size={23} strokeWidth={props.active ? 2.45 : 2} />
        {props.badge > 0 ? (
          <View style={styles.badge}>
            <AppText style={styles.badgeText} variant="meta">{Math.min(props.badge, 9)}</AppText>
          </View>
        ) : null}
      </View>
      <AppText style={[styles.label, props.active ? styles.labelActive : null]} variant="meta">
        {props.tab.label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignItems: "flex-end",
    backgroundColor: "rgba(255,254,250,0.96)",
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    paddingTop: 7
  },
  item: {
    alignItems: "center",
    flex: 1,
    gap: 2,
    minHeight: 44
  },
  iconWrap: {
    alignItems: "center",
    borderRadius: 12,
    height: 36,
    justifyContent: "center",
    width: 36
  },
  iconWrapActive: {
    backgroundColor: colors.surfaceMuted
  },
  badge: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderColor: colors.surface,
    borderRadius: 9,
    borderWidth: 2,
    height: 18,
    justifyContent: "center",
    position: "absolute",
    right: -3,
    top: -2,
    width: 18
  },
  badgeText: {
    color: colors.onDark,
    fontSize: 9,
    lineHeight: 11,
    ...fontStyles.bold,
  },
  actionItem: {
    alignItems: "center",
    flex: 0.82,
    minHeight: 51
  },
  actionHalo: {
    alignItems: "center",
    backgroundColor: "rgba(255,254,250,0.96)",
    borderRadius: 37,
    height: 74,
    justifyContent: "center",
    marginTop: -29,
    width: 74,
    ...shadowSm
  },
  actionButton: {
    alignItems: "center",
    backgroundColor: colors.dark,
    borderRadius: 29,
    height: 58,
    justifyContent: "center",
    width: 58
  },
  label: {
    color: colors.ink3,
    fontSize: 11,
    ...fontStyles.medium,
  },
  labelActive: {
    color: colors.ink,
    ...fontStyles.semibold,
  }
});
