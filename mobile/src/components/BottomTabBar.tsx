import { useState } from "react";
import {
  Book,
  Camera,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  FileText,
  Home,
  Mic,
  Plus,
  Settings as SettingsIcon,
} from "lucide-react-native";
import { router, usePathname } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AnimatedSheetContent, SheetModal } from "./AnimatedSheet";
import { colors, radius, shadowSm, spacing } from "./theme";
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
  const [showStartSheet, setShowStartSheet] = useState(false);

  function startQuote() {
    setShowStartSheet(false);
    startNewQuoteWizard();
    router.push("/new-quote");
  }

  return (
    <>
      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
        {tabs.slice(0, 2).map((tab) => (
          <TabItem key={tab.href} active={pathname === tab.href} tab={tab} />
        ))}

        <View style={styles.actionItem}>
          <View style={styles.actionHalo}>
            <Pressable
              accessibilityLabel="Start quote"
              accessibilityRole="button"
              onPress={() => setShowStartSheet(true)}
              style={styles.actionButton}
            >
              <Plus color={colors.onDark} size={31} strokeWidth={2.55} />
            </Pressable>
          </View>
        </View>

        {tabs.slice(2).map((tab) => (
          <TabItem key={tab.href} active={pathname === tab.href} tab={tab} />
        ))}
      </View>

      <SheetModal onDismiss={() => setShowStartSheet(false)} style={styles.modalBackdrop} visible={showStartSheet}>
        <AnimatedSheetContent style={styles.sheet}>
          <View style={styles.grabber} />
          <Text style={styles.sheetTitle}>Start a quote</Text>
          <Text style={styles.sheetSubtitle}>Choose how much structure you want before QuoteVan drafts it.</Text>
          <StartOption
            Icon={ClipboardCheck}
            onPress={startQuote}
            subtitle="Customer, checklist, notes, then review"
            title="Walkthrough"
          />
          <StartOption
            Icon={Mic}
            onPress={startQuote}
            subtitle="Use the walkthrough, then talk through the job"
            title="Voice note"
          />
          <StartOption disabled Icon={Camera} subtitle="Job photos and measurements" title="Photo quote" />
          <StartOption disabled Icon={FileText} subtitle="Blank line items and totals" title="Manual quote" />
        </AnimatedSheetContent>
      </SheetModal>
    </>
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

function StartOption(props: {
  disabled?: boolean | undefined;
  Icon: typeof ClipboardCheck;
  onPress?: (() => void) | undefined;
  subtitle: string;
  title: string;
}) {
  const Icon = props.Icon;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={props.disabled}
      onPress={props.onPress}
      style={[styles.startOption, props.disabled ? styles.startOptionDisabled : null]}
    >
      <View style={styles.startIcon}>
        <Icon color={props.disabled ? colors.ink3 : colors.ink} size={19} strokeWidth={2.2} />
      </View>
      <View style={styles.startText}>
        <Text style={[styles.startTitle, props.disabled ? styles.startTitleDisabled : null]}>{props.title}</Text>
        <Text style={styles.startSubtitle}>{props.subtitle}</Text>
      </View>
      {props.disabled ? (
        <Text style={styles.comingSoon}>Soon</Text>
      ) : (
        <ChevronRight color={colors.ink3} size={17} strokeWidth={2.2} />
      )}
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
  },
  modalBackdrop: {
    backgroundColor: "rgba(18,22,28,0.35)",
    flex: 1,
    justifyContent: "flex-end"
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    gap: 8,
    padding: spacing.lg,
    paddingTop: spacing.md
  },
  grabber: {
    alignSelf: "center",
    backgroundColor: colors.border,
    borderRadius: 999,
    height: 4,
    marginBottom: 8,
    width: 38
  },
  sheetTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "800"
  },
  sheetSubtitle: {
    color: colors.ink2,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
    marginBottom: 4
  },
  startOption: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: 11,
    minHeight: 68,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  startOptionDisabled: {
    opacity: 0.55
  },
  startIcon: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 38
  },
  startText: {
    flex: 1,
    gap: 2
  },
  startTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800"
  },
  startTitleDisabled: {
    color: colors.ink2
  },
  startSubtitle: {
    color: colors.ink3,
    fontSize: 12,
    fontWeight: "600"
  },
  comingSoon: {
    color: colors.ink3,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase"
  }
});
