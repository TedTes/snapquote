import type { ReactNode } from "react";
import { router } from "expo-router";
import {
  Book,
  CalendarDays,
  ChevronRight,
  FileText,
  Lock,
  Mail,
  MessageSquare,
  Percent,
  RotateCcw,
  Type
} from "lucide-react-native";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { getTradeConfig } from "@snapquote/shared";
import { BottomTabBar } from "../components/BottomTabBar";
import { Screen } from "../components/base";
import { colors, radius } from "../components/theme";
import { businessInitials } from "../utils/format";
import { useQuoteStore } from "../state/quoteStore";
import { useAuthStore } from "../auth/authStore";

export default function SettingsScreen() {
  const businessName = useQuoteStore((state) => state.businessName);
  const defaultTaxRate = useQuoteStore((state) => state.defaultTaxRate);
  const defaultTerms = useQuoteStore((state) => state.defaultTerms);
  const quoteValidDays = useQuoteStore((state) => state.quoteValidDays);
  const priceBookItems = useQuoteStore((state) => state.priceBookItems);
  const activeTrade = useQuoteStore((state) => state.activeTrade);
  const me = useAuthStore((state) => state.me);
  const tradeConfig = getTradeConfig(activeTrade);

  const confirmedCount = priceBookItems.filter((item) => item.confirmedAt !== null).length;
  const totalCount = priceBookItems.length;
  const senderEmail = me?.user.email ?? "quotes@sharpedge.co";

  return (
    <Screen edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
          <Pressable
            accessibilityLabel="Open profile"
            accessibilityRole="button"
            onPress={() => router.push("/settings/edit")}
            style={styles.headerAvatar}
          >
            <Text style={styles.headerAvatarText}>{businessInitials(businessName)}</Text>
          </Pressable>
        </View>

        <SettingsSection label="Quote defaults">
          <SettingsRow
            icon={<Percent color={colors.ink2} size={15} strokeWidth={2.1} />}
            label="Tax rate"
            onPress={() => router.push("/settings/business")}
            value={`${Math.round(defaultTaxRate * 100)}%`}
          />
          <SettingsRow
            icon={<CalendarDays color={colors.ink2} size={15} strokeWidth={2.1} />}
            label="Quote valid for"
            onPress={() => router.push("/settings/business")}
            value={`${quoteValidDays} days`}
          />
          <SettingsRow
            detail={defaultTerms}
            icon={<FileText color={colors.ink2} size={15} strokeWidth={2.1} />}
            label="Default terms"
            onPress={() => router.push("/settings/business")}
          />
          <SettingsRow
            detail="Hi {name}, just checking in..."
            icon={<MessageSquare color={colors.ink2} size={15} strokeWidth={2.1} />}
            label="Follow-up message"
            last
            onPress={() => Alert.alert("Follow-up message", "Follow-up templates are coming next.")}
          />
        </SettingsSection>

        <SettingsSection label="Price book">
          <SettingsRow
            customValue={<BookStrengthBadge confirmed={confirmedCount} total={totalCount} />}
            detail={<StrengthDots confirmed={confirmedCount} total={totalCount} />}
            icon={<Book color={colors.ink2} size={16} strokeWidth={2.1} />}
            label="Book strength"
            onPress={() => router.push("/price-book")}
          />
          <SettingsRow
            detail="Review your starter prices"
            icon={<RotateCcw color={colors.ink2} size={15} strokeWidth={2.1} />}
            label="Re-run price setup"
            onPress={() => router.push("/onboarding")}
          />
          <SettingsRow
            customValue={<TradeValue label={tradeConfig.label} />}
            detail="More trades coming soon"
            icon={<Type color={colors.ink2} size={16} strokeWidth={2.1} />}
            label="Trade"
            last
            onPress={() => undefined}
            showChevron={false}
          />
        </SettingsSection>

        <SettingsSection label="Sending">
          <SettingsRow
            customValue={<VerifiedBadge />}
            detail={senderEmail}
            icon={<Mail color={colors.ink2} size={15} strokeWidth={2.1} />}
            label="Send quotes from"
            last
            onPress={() => Alert.alert("Sending email", "Email sender setup is not connected yet.")}
          />
        </SettingsSection>

        <Text style={styles.version}>Account & billing live in your profile · v0.4.1</Text>
      </ScrollView>
      <BottomTabBar />
    </Screen>
  );
}

function SettingsSection(props: { label: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{props.label}</Text>
      <View style={styles.sectionCard}>{props.children}</View>
    </View>
  );
}

function SettingsRow(props: {
  icon: ReactNode;
  label: string;
  detail?: ReactNode | undefined;
  value?: string | undefined;
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
        {typeof props.detail === "string" ? (
          <Text style={styles.rowDetail} numberOfLines={1}>
            {props.detail}
          </Text>
        ) : (
          props.detail
        )}
      </View>
      {props.customValue ?? (props.value ? <Text style={styles.rowValue}>{props.value}</Text> : null)}
      {props.showChevron === false ? null : (
        <ChevronRight color={colors.ink3} size={15} strokeWidth={2.2} />
      )}
    </Pressable>
  );
}

function StrengthDots(props: { confirmed: number; total: number }) {
  const segments = Array.from({ length: Math.max(props.total, 1) }, (_, index) => index).slice(0, 11);

  return (
    <View style={styles.strengthDots}>
      {segments.map((index) => (
        <View
          key={index}
          style={[
            styles.strengthDot,
            { backgroundColor: index < props.confirmed ? colors.green : colors.amber }
          ]}
        />
      ))}
    </View>
  );
}

function BookStrengthBadge(props: { confirmed: number; total: number }) {
  return (
    <View style={styles.bookBadge}>
      <Text style={styles.bookBadgeText}>
        {props.confirmed} of {props.total}
      </Text>
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

function TradeValue(props: { label: string }) {
  return (
    <View style={styles.tradeValue}>
      <Text style={styles.tradeText}>{props.label}</Text>
      <Lock color={colors.ink3} size={11} strokeWidth={2.2} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 22,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 42
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  title: {
    color: colors.ink,
    fontSize: 27,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 32
  },
  headerAvatar: {
    alignItems: "center",
    backgroundColor: colors.dark,
    borderRadius: 24,
    height: 48,
    justifyContent: "center",
    width: 48
  },
  headerAvatarText: {
    color: colors.onDark,
    fontSize: 16,
    fontWeight: "900"
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
    fontWeight: "900"
  },
  strengthDots: {
    flexDirection: "row",
    gap: 3,
    marginTop: 3
  },
  strengthDot: {
    borderRadius: radius.pill,
    height: 6,
    width: 6
  },
  bookBadge: {
    backgroundColor: colors.amberBg,
    borderColor: colors.amberBorder,
    borderRadius: 7,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 4
  },
  bookBadgeText: {
    color: colors.amber,
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
  tradeValue: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7
  },
  tradeText: {
    color: colors.ink2,
    fontSize: 13,
    fontWeight: "800"
  },
  version: {
    color: colors.ink3,
    fontSize: 10.5,
    fontWeight: "600",
    paddingBottom: 2,
    marginTop: -2,
    textAlign: "center"
  }
});
