import { useEffect, useState } from "react";
import { File } from "expo-file-system";
import { router } from "expo-router";
import { Camera, ChevronLeft, ExternalLink, MapPin, Trash2 } from "lucide-react-native";
import { Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import {
  publicWebBaseUrl,
  snapquoteApi,
  userFacingErrorMessage,
  type PublicPortfolioItem
} from "../../api/client";
import { useAuthStore } from "../../state/authStore";
import { Screen } from "../../shared-ui/base";
import { colors, fontStyles, radius, typography } from "../../shared-ui/theme";

type ImagePickerModule = typeof import("expo-image-picker");

export default function PublicProfileScreen() {
  const me = useAuthStore((state) => state.me);
  const setMe = useAuthStore((state) => state.setMe);
  const [bio, setBio] = useState(me?.org.profileBio ?? "");
  const [serviceArea, setServiceArea] = useState(me?.org.serviceArea ?? "");
  const [years, setYears] = useState(me?.org.yearsInBusiness === null || me?.org.yearsInBusiness === undefined
    ? ""
    : String(me.org.yearsInBusiness));
  const [portfolio, setPortfolio] = useState<PublicPortfolioItem[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    snapquoteApi.listPortfolio()
      .then((response) => {
        if (active) setPortfolio(response.items);
      })
      .catch((error) => {
        if (active) Alert.alert("Could not load work photos", userFacingErrorMessage(error));
      })
      .finally(() => {
        if (active) setLoadingPhotos(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function saveProfile() {
    if (saving || !me) return;

    const parsedYears = years.trim().length === 0 ? null : Number.parseInt(years, 10);
    if (parsedYears !== null && (!Number.isInteger(parsedYears) || parsedYears < 0 || parsedYears > 150)) {
      Alert.alert("Check years in business", "Enter a whole number from 0 to 150, or leave it blank.");
      return;
    }

    setSaving(true);

    try {
      const response = await snapquoteApi.updateMe({
        profileBio: emptyToNull(bio),
        serviceArea: emptyToNull(serviceArea),
        yearsInBusiness: parsedYears
      });
      setMe(response);
      router.back();
    } catch (error) {
      Alert.alert("Could not save public profile", userFacingErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function addPhotos() {
    if (uploading || portfolio.length >= 6) return;

    try {
      const ImagePicker = await loadImagePicker();
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert("Photo access needed", "Allow photo access to add completed-work photos.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsMultipleSelection: true,
        mediaTypes: ["images"],
        quality: 0.78,
        selectionLimit: 6 - portfolio.length
      });

      if (result.canceled || result.assets.length === 0) return;
      setUploading(true);

      const uploaded: PublicPortfolioItem[] = [];
      for (const asset of result.assets) {
        const file = new File(asset.uri);
        const response = await snapquoteApi.uploadPortfolioItem({
          fileName: asset.fileName ?? "completed-work.jpg",
          contentType: normalizeImageContentType(asset.mimeType),
          base64: await file.base64()
        });
        uploaded.push(response.item);
      }

      setPortfolio((current) => [...current, ...uploaded]);
    } catch (error) {
      Alert.alert("Could not add work photos", userFacingErrorMessage(error));
    } finally {
      setUploading(false);
    }
  }

  function confirmDelete(item: PublicPortfolioItem) {
    Alert.alert("Remove work photo?", "It will no longer appear on your public request page.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => void deletePhoto(item) }
    ]);
  }

  async function deletePhoto(item: PublicPortfolioItem) {
    if (deletingId !== null) return;
    setDeletingId(item.id);

    try {
      await snapquoteApi.deletePortfolioItem(item.id);
      setPortfolio((current) => current.filter((candidate) => candidate.id !== item.id));
    } catch (error) {
      Alert.alert("Could not remove photo", userFacingErrorMessage(error));
    } finally {
      setDeletingId(null);
    }
  }

  function openPublicPage() {
    if (!me?.org.id) return;
    void Linking.openURL(`${publicWebBaseUrl}/request/${encodeURIComponent(me.org.id)}`);
  }

  return (
    <Screen edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.nav}>
          <Pressable accessibilityLabel="Go back" accessibilityRole="button" onPress={() => router.back()} style={styles.navButton}>
            <ChevronLeft color={colors.ink} size={20} strokeWidth={2.4} />
          </Pressable>
          <Text style={styles.navTitle}>Public profile</Text>
          <Pressable accessibilityLabel="Open public page" accessibilityRole="button" onPress={openPublicPage} style={styles.navButton}>
            <ExternalLink color={colors.ink} size={17} strokeWidth={2.2} />
          </Pressable>
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>Make the request page yours</Text>
          <Text style={styles.subtitle}>Your profile and completed work appear before the quote request form.</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Provider details</Text>
          <Field
            label="Service area"
            maxLength={160}
            onChangeText={setServiceArea}
            placeholder="Toronto and the GTA"
            value={serviceArea}
          />
          <Field
            keyboardType="number-pad"
            label="Years in business"
            maxLength={3}
            onChangeText={(value) => setYears(value.replace(/\D/g, ""))}
            placeholder="8"
            value={years}
          />
          <Field
            label="About your work"
            maxLength={500}
            multiline
            onChangeText={setBio}
            placeholder="Interior and exterior painting, cabinets, and drywall repair."
            value={bio}
          />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <View>
              <Text style={styles.sectionLabel}>Completed work</Text>
              <Text style={styles.sectionMeta}>{portfolio.length}/6 photos</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              disabled={uploading || portfolio.length >= 6}
              onPress={() => void addPhotos()}
              style={[styles.addButton, uploading || portfolio.length >= 6 ? styles.buttonDisabled : null]}
            >
              <Camera color={colors.green} size={15} strokeWidth={2.3} />
              <Text style={styles.addButtonText}>{uploading ? "Adding..." : "Add photos"}</Text>
            </Pressable>
          </View>

          {loadingPhotos ? <Text style={styles.emptyText}>Loading photos...</Text> : null}
          {!loadingPhotos && portfolio.length === 0 ? (
            <View style={styles.emptyPhotos}>
              <Camera color={colors.ink3} size={24} strokeWidth={1.8} />
              <Text style={styles.emptyTitle}>No work photos yet</Text>
              <Text style={styles.emptyText}>Your gallery stays hidden until you add completed jobs.</Text>
            </View>
          ) : null}
          {portfolio.length > 0 ? (
            <View style={styles.photoGrid}>
              {portfolio.map((item) => (
                <View key={item.id} style={styles.photoWrap}>
                  <Image source={{ uri: item.imageUrl }} style={styles.photo} />
                  <Pressable
                    accessibilityLabel="Remove work photo"
                    accessibilityRole="button"
                    disabled={deletingId !== null}
                    onPress={() => confirmDelete(item)}
                    style={styles.deleteButton}
                  >
                    <Trash2 color="#fff" size={14} strokeWidth={2.4} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.reviewStatus}>
          <MapPin color={colors.green} size={17} strokeWidth={2.2} />
          <View>
            <Text style={styles.reviewTitle}>New on QuoteVan</Text>
            <Text style={styles.reviewCopy}>Your rating appears after a customer submits a verified review.</Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={saving}
          onPress={() => void saveProfile()}
          style={[styles.saveButton, saving ? styles.buttonDisabled : null]}
        >
          <Text style={styles.saveButtonText}>{saving ? "Saving..." : "Save public profile"}</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  maxLength: number;
  keyboardType?: "default" | "number-pad" | undefined;
  multiline?: boolean | undefined;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        keyboardType={props.keyboardType ?? "default"}
        maxLength={props.maxLength}
        multiline={props.multiline}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={colors.ink3}
        style={[styles.input, props.multiline ? styles.inputMultiline : null]}
        textAlignVertical={props.multiline ? "top" : "center"}
        value={props.value}
      />
    </View>
  );
}

async function loadImagePicker(): Promise<ImagePickerModule> {
  return await import("expo-image-picker");
}

function normalizeImageContentType(value: string | null | undefined): "image/jpeg" | "image/png" | "image/webp" {
  if (value === "image/png" || value === "image/webp") return value;
  return "image/jpeg";
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const styles = StyleSheet.create({
  content: { gap: 22, paddingBottom: 32, paddingHorizontal: 20, paddingTop: 20 },
  nav: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  navButton: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 10, borderWidth: 1, height: 36, justifyContent: "center", width: 36 },
  navTitle: { ...typography.sectionLabel, fontSize: 10, letterSpacing: 1.8, textTransform: "uppercase" },
  header: { gap: 7 },
  title: { ...typography.screenTitle, lineHeight: 32 },
  subtitle: { color: colors.ink3, fontSize: 14, ...fontStyles.regular, lineHeight: 20 },
  section: { gap: 14 },
  sectionHead: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  sectionLabel: { color: colors.ink2, fontSize: 11, ...fontStyles.bold, letterSpacing: 1.4, textTransform: "uppercase" },
  sectionMeta: { color: colors.ink3, fontSize: 12, ...fontStyles.regular, marginTop: 3 },
  field: { gap: 7 },
  label: { color: colors.ink2, fontSize: 12, ...fontStyles.bold },
  input: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, color: colors.ink, fontSize: 15, ...fontStyles.regular, minHeight: 50, paddingHorizontal: 14 },
  inputMultiline: { minHeight: 112, paddingTop: 13 },
  addButton: { alignItems: "center", borderColor: colors.greenBorder, borderRadius: radius.sm, borderWidth: 1, flexDirection: "row", gap: 7, minHeight: 38, paddingHorizontal: 12 },
  addButtonText: { color: colors.green, fontSize: 12, ...fontStyles.bold },
  buttonDisabled: { opacity: 0.55 },
  emptyPhotos: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderStyle: "dashed", borderWidth: 1, gap: 7, padding: 26 },
  emptyTitle: { color: colors.ink, fontSize: 14, ...fontStyles.bold },
  emptyText: { color: colors.ink3, fontSize: 12, ...fontStyles.regular, lineHeight: 17, textAlign: "center" },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  photoWrap: { borderRadius: radius.sm, height: 112, overflow: "hidden", position: "relative", width: "47%" },
  photo: { height: "100%", width: "100%" },
  deleteButton: { alignItems: "center", backgroundColor: "rgba(29,28,25,0.82)", borderRadius: 16, height: 30, justifyContent: "center", position: "absolute", right: 7, top: 7, width: 30 },
  reviewStatus: { alignItems: "flex-start", backgroundColor: colors.greenBg, borderColor: colors.greenBorder, borderRadius: radius.md, borderWidth: 1, flexDirection: "row", gap: 11, padding: 15 },
  reviewTitle: { color: colors.ink, fontSize: 14, ...fontStyles.bold },
  reviewCopy: { color: colors.ink2, fontSize: 12, ...fontStyles.regular, lineHeight: 17, marginTop: 3 },
  saveButton: { alignItems: "center", backgroundColor: colors.ink, borderRadius: radius.sm, justifyContent: "center", minHeight: 52 },
  saveButtonText: { color: colors.onDark, fontSize: 14, ...fontStyles.bold }
});
