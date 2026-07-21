import { Book, ClipboardList, Home, Settings as SettingsIcon } from "lucide-react-native";
import { router, usePathname } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing } from "./theme";

const tabs = [
  { href: "/" as const, label: "Today", icon: Home },
  { href: "/quotes" as const, label: "Quotes", icon: ClipboardList },
  { href: "/price-book" as const, label: "Price book", icon: Book },
  { href: "/settings" as const, label: "Settings", icon: SettingsIcon }
];

export function BottomTabBar() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        const Icon = tab.icon;

        return (
          <Pressable
            accessibilityRole="button"
            key={tab.href}
            onPress={() => router.replace(tab.href)}
            style={styles.item}
          >
            <Icon color={active ? colors.ink : colors.ink3} size={20} strokeWidth={active ? 2.45 : 2} />
            <Text style={[styles.label, active ? styles.labelActive : null]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: "rgba(255,254,250,0.96)",
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    paddingTop: 8
  },
  item: {
    alignItems: "center",
    flex: 1,
    gap: 3
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
