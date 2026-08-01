import { Book, ClipboardList, Home, Plus, Settings as SettingsIcon } from "lucide-react-native";
import { router, usePathname } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, shadowSm, spacing } from "./theme";
import { useQuoteStore } from "../state/quoteStore";

const tabs = [
  { href: "/" as const, label: "Today", icon: Home },
  { href: "/quotes" as const, label: "Quotes", icon: ClipboardList },
  { href: "/price-book" as const, label: "Price book", icon: Book },
  { href: "/settings" as const, label: "Settings", icon: SettingsIcon }
];

export function BottomTabBar() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const startNewQuoteWizard = useQuoteStore((state) => state.startNewQuoteWizard);

  function startQuote() {
    startNewQuoteWizard();
    router.push("/new-quote");
  }

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      {tabs.slice(0, 2).map((tab) => (
        <TabItem key={tab.href} active={pathname === tab.href} tab={tab} />
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
        <TabItem key={tab.href} active={pathname === tab.href} tab={tab} />
      ))}
    </View>
  );
}

function TabItem(props: { active: boolean; tab: (typeof tabs)[number] }) {
  const Icon = props.tab.icon;

  return (
    <Pressable accessibilityRole="button" onPress={() => router.replace(props.tab.href)} style={styles.item}>
      <View style={[styles.iconWrap, props.active ? styles.iconWrapActive : null]}>
        <Icon color={props.active ? colors.ink : colors.ink3} size={23} strokeWidth={props.active ? 2.45 : 2} />
      </View>
      <Text style={[styles.label, props.active ? styles.labelActive : null]}>{props.tab.label}</Text>
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
    fontWeight: "600"
  },
  labelActive: {
    color: colors.ink,
    fontWeight: "700"
  }
});
