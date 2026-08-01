import { useState, type ReactNode } from "react";
import { router } from "expo-router";
import { ChevronLeft, Globe, Phone } from "lucide-react-native";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { snapquoteApi, userFacingErrorMessage } from "../../api/client";
import { useAuthStore } from "../../state/authStore";
import { Screen } from "../../shared-ui/base";
import { colors, radius } from "../../shared-ui/theme";

export default function ContactSettingsScreen() {
  const authStatus = useAuthStore((state) => state.status);
  const me = useAuthStore((state) => state.me);
  const setMe = useAuthStore((state) => state.setMe);
  const [phone, setPhone] = useState(me?.org.contactPhone ?? "");
  const [website, setWebsite] = useState(me?.org.website ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (saving) {
      return;
    }

    if (authStatus !== "signed_in") {
      router.push({ pathname: "/auth", params: { from: "app" } });
      return;
    }

    setSaving(true);

    try {
      const response = await snapquoteApi.updateMe({
        contactPhone: emptyToNull(phone),
        website: emptyToNull(website)
      });

      setMe(response);
      router.back();
    } catch (error) {
      Alert.alert("Could not save contact details", userFacingErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.nav}>
          <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.back()} style={styles.navButton}>
            <ChevronLeft color={colors.ink} size={20} strokeWidth={2.4} />
          </Pressable>
          <Text style={styles.navTitle}>Contact</Text>
          <View style={styles.navButtonGhost} />
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>Contact details</Text>
          <Text style={styles.subtitle}>
            These appear on quotes so customers know how to reach you.
          </Text>
        </View>

        <View style={styles.card}>
          <Field
            icon={<Phone color={colors.ink3} size={17} strokeWidth={2.1} />}
            keyboardType="phone-pad"
            label="Phone"
            onChangeText={setPhone}
            placeholder="(416) 555-0148"
            textContentType="telephoneNumber"
            value={phone}
          />
          <Field
            icon={<Globe color={colors.ink3} size={17} strokeWidth={2.1} />}
            keyboardType="url"
            label="Website"
            onChangeText={setWebsite}
            placeholder="yourcompany.com"
            textContentType="URL"
            value={website}
          />
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={saving}
          onPress={() => void save()}
          style={[styles.saveButton, saving ? styles.saveButtonDisabled : null]}
        >
          <Text style={styles.saveText}>{saving ? "Saving..." : "Save contact details"}</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

function Field(props: {
  icon: ReactNode;
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType: "phone-pad" | "url";
  textContentType: "telephoneNumber" | "URL";
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      <View style={styles.inputWrap}>
        {props.icon}
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType={props.keyboardType}
          onChangeText={props.onChangeText}
          placeholder={props.placeholder}
          placeholderTextColor={colors.ink3}
          style={styles.input}
          textContentType={props.textContentType}
          value={props.value}
        />
      </View>
    </View>
  );
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const styles = StyleSheet.create({
  content: {
    gap: 22,
    paddingBottom: 22,
    paddingHorizontal: 20,
    paddingTop: 20
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
  navButtonGhost: {
    width: 36
  },
  navTitle: {
    color: colors.ink3,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.8,
    textTransform: "uppercase"
  },
  header: {
    gap: 7
  },
  title: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 32
  },
  subtitle: {
    color: colors.ink2,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 18,
    padding: 14
  },
  field: {
    gap: 8
  },
  label: {
    color: colors.ink3,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
    textTransform: "uppercase"
  },
  inputWrap: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 54,
    paddingHorizontal: 12
  },
  input: {
    color: colors.ink,
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    paddingVertical: 13
  },
  saveButton: {
    alignItems: "center",
    backgroundColor: colors.ink,
    borderRadius: 10,
    justifyContent: "center",
    minHeight: 54
  },
  saveButtonDisabled: {
    backgroundColor: colors.borderStrong
  },
  saveText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: "900"
  }
});
