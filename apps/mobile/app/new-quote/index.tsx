import { useState } from "react";
import type { ReactNode } from "react";
import { Mail, MapPin, Phone } from "lucide-react-native";
import { router } from "expo-router";
import { StyleSheet, TextInput, View } from "react-native";
import { AnimatedScreenContent } from "../../src/ui/AnimatedScreenContent";
import { Screen } from "../../src/ui/components";
import { NewQuoteHeader, NewQuoteTitle, SectionKicker, StickyAction } from "../../src/ui/NewQuoteScaffold";
import { colors } from "../../src/ui/theme";
import { useMvpStore } from "../../src/state/mvp";

export default function NewQuoteCustomerScreen() {
  const wizard = useMvpStore((state) => state.wizard);
  const updateWizard = useMvpStore((state) => state.updateWizard);

  const [name, setName] = useState(wizard.customerName);
  const [phone, setPhone] = useState(wizard.customerPhone);
  const [email, setEmail] = useState(wizard.customerEmail);
  const [address, setAddress] = useState(wizard.address);
  const [jobTitle, setJobTitle] = useState(wizard.jobTitle);

  const canContinue = name.trim().length > 0 && email.trim().length > 0 && address.trim().length > 0;

  function next() {
    updateWizard({
      customerName: name.trim(),
      customerPhone: phone.trim(),
      customerEmail: email.trim(),
      address: address.trim(),
      jobTitle: jobTitle.trim()
    });
    router.push("/new-quote/checklist");
  }

  return (
    <Screen edges={["top"]}>
      <NewQuoteHeader close onBack={() => router.replace("/")} step={1} />
      <AnimatedScreenContent contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <NewQuoteTitle title="Who's it for?" />

        <FieldBlock label="Customer name">
          <TextInput
            onChangeText={setName}
            placeholder="Full name"
            placeholderTextColor={colors.ink3}
            style={styles.input}
            value={name}
          />
        </FieldBlock>

        <FieldBlock label="Phone">
          <View style={styles.inputWithIcon}>
            <Phone color={colors.ink3} size={15} strokeWidth={2} />
            <TextInput
              keyboardType="phone-pad"
              onChangeText={setPhone}
              placeholder="Mobile"
              placeholderTextColor={colors.ink3}
              style={styles.inputEmbedded}
              value={phone}
            />
          </View>
        </FieldBlock>

        <FieldBlock label="Email · sends the quote">
          <View style={styles.inputWithIcon}>
            <Mail color={colors.ink3} size={15} strokeWidth={2} />
            <TextInput
              autoCapitalize="none"
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="name@email.com"
              placeholderTextColor={colors.ink3}
              style={styles.inputEmbedded}
              value={email}
            />
          </View>
        </FieldBlock>

        <FieldBlock label="Job address">
          <View style={styles.inputWithIcon}>
            <MapPin color={colors.ink3} size={15} strokeWidth={2} />
            <TextInput
              onChangeText={setAddress}
              placeholder="Street, city"
              placeholderTextColor={colors.ink3}
              style={styles.inputEmbedded}
              value={address}
            />
          </View>
        </FieldBlock>

        <FieldBlock label="Job title · optional">
          <TextInput
            onChangeText={setJobTitle}
            placeholder="e.g. Interior repaint"
            placeholderTextColor={colors.ink3}
            style={styles.input}
            value={jobTitle}
          />
        </FieldBlock>
      </AnimatedScreenContent>
      <StickyAction disabled={!canContinue} label="Next — the job" onPress={next} />
    </Screen>
  );
}

function FieldBlock(props: { label: string; children: ReactNode }) {
  return (
    <View style={styles.fieldBlock}>
      <SectionKicker>{props.label}</SectionKicker>
      {props.children}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    gap: 14,
    paddingBottom: 24,
    paddingTop: 21
  },
  fieldBlock: {
    gap: 7,
    paddingHorizontal: 19
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 15,
    fontWeight: "600",
    height: 43,
    paddingHorizontal: 13
  },
  inputWithIcon: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 9,
    height: 43,
    paddingHorizontal: 12
  },
  inputEmbedded: {
    color: colors.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    paddingVertical: 0
  }
});
