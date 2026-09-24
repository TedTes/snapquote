import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as Clipboard from "expo-clipboard";
import { File } from "expo-file-system";
import { router, useNavigation } from "expo-router";
import {
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Plus,
  Share2,
  Trash2
} from "lucide-react-native";
import {
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from "react-native";
import {
  publicWebBaseUrl,
  snapquoteApi,
  userFacingErrorMessage,
  type MeResponse,
  type PublicPortfolioItem
} from "../../api/client";
import { useAuthStore } from "../../state/authStore";
import { useQuoteStore } from "../../state/quoteStore";
import { BusinessAvatar } from "../../shared-ui/BusinessAvatar";
import { Screen } from "../../shared-ui/base";
import { colors, fontStyles, radius, typography } from "../../shared-ui/theme";

type ImagePickerModule = typeof import("expo-image-picker");

type ProfileDraft = {
  businessName: string;
  phone: string;
  website: string;
  bio: string;
  serviceArea: string;
  years: string;
  services: string[];
};

const paintingServices = [
  "Interior painting",
  "Exterior painting",
  "Cabinets",
  "Trim and doors",
  "Drywall repair",
  "Deck staining"
];

export default function PublicProfileScreen() {
  const navigation = useNavigation();
  const me = useAuthStore((state) => state.me);
  const setMe = useAuthStore((state) => state.setMe);
  const updateOrgSettings = useQuoteStore((state) => state.updateOrgSettings);
  const initialDraft = profileDraft(me);
  const [businessName, setBusinessName] = useState(initialDraft.businessName);
  const [phone, setPhone] = useState(initialDraft.phone);
  const [website, setWebsite] = useState(initialDraft.website);
  const [bio, setBio] = useState(initialDraft.bio);
  const [serviceArea, setServiceArea] = useState(initialDraft.serviceArea);
  const [years, setYears] = useState(initialDraft.years);
  const [services, setServices] = useState(initialDraft.services);
  const [customService, setCustomService] = useState("");
  const [baseline, setBaseline] = useState(() => profileSnapshot(initialDraft));
  const [portfolio, setPortfolio] = useState<PublicPortfolioItem[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [portfolioBusyId, setPortfolioBusyId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const allowRemoveRef = useRef(false);
  const currentDraft = useMemo(() => ({
    businessName,
    phone,
    website,
    bio,
    serviceArea,
    years,
    services
  }), [bio, businessName, phone, serviceArea, services, website, years]);
  const dirty = profileSnapshot(currentDraft) !== baseline;
  const publicPageUrl = me?.org.id
    ? `${publicWebBaseUrl}/request/${encodeURIComponent(me.org.id)}`
    : null;
  const completion = profileCompletion({
    draft: currentDraft,
    hasLogo: Boolean(me?.org.logoUrl),
    hasPublishedWork: portfolio.some((item) => item.published)
  });

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

  useEffect(() => navigation.addListener("beforeRemove", (event) => {
    if (!dirty || allowRemoveRef.current) return;

    event.preventDefault();
    Alert.alert("Discard profile changes?", "Your unsaved profile details will be lost.", [
      { text: "Keep editing", style: "cancel" },
      {
        text: "Discard",
        style: "destructive",
        onPress: () => {
          allowRemoveRef.current = true;
          navigation.dispatch(event.data.action);
        }
      }
    ]);
  }), [dirty, navigation]);

  async function saveProfile() {
    if (saving || !me) return;

    const name = businessName.trim();
    if (name.length === 0) {
      Alert.alert("Add a business name", "Your business name appears at the top of the public page.");
      return;
    }

    const parsedYears = years.trim().length === 0 ? null : Number.parseInt(years, 10);
    if (parsedYears !== null && (!Number.isInteger(parsedYears) || parsedYears < 0 || parsedYears > 150)) {
      Alert.alert("Check years in business", "Enter a whole number from 0 to 150, or leave it blank.");
      return;
    }

    const normalizedWebsite = normalizeWebsite(website);
    if (website.trim().length > 0 && normalizedWebsite === null) {
      Alert.alert("Check website", "Enter a website such as example.com, or leave it blank.");
      return;
    }

    const normalizedDraft: ProfileDraft = {
      businessName: name,
      phone: phone.trim(),
      website: normalizedWebsite ?? "",
      bio: bio.trim(),
      serviceArea: serviceArea.trim(),
      years: parsedYears === null ? "" : String(parsedYears),
      services: uniqueServices(services)
    };

    setSaving(true);
    setSaveMessage(null);

    try {
      const response = await snapquoteApi.updateMe({
        businessName: normalizedDraft.businessName,
        contactPhone: emptyToNull(normalizedDraft.phone),
        website: emptyToNull(normalizedDraft.website),
        profileBio: emptyToNull(normalizedDraft.bio),
        serviceArea: emptyToNull(normalizedDraft.serviceArea),
        yearsInBusiness: parsedYears,
        profileServices: normalizedDraft.services
      });
      setMe(response);
      updateOrgSettings({ businessName: response.org.name });
      applyDraft(normalizedDraft);
      setBaseline(profileSnapshot(normalizedDraft));
      setSaveMessage("Profile saved");
    } catch (error) {
      Alert.alert("Could not save public profile", userFacingErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  function applyDraft(draft: ProfileDraft) {
    setBusinessName(draft.businessName);
    setPhone(draft.phone);
    setWebsite(draft.website);
    setBio(draft.bio);
    setServiceArea(draft.serviceArea);
    setYears(draft.years);
    setServices(draft.services);
  }

  async function uploadLogo() {
    if (uploadingLogo || !me) return;

    try {
      const ImagePicker = await loadImagePicker();
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert("Photo access needed", "Allow photo access to add a business logo.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        mediaTypes: ["images"],
        quality: 0.8
      });

      if (result.canceled || !result.assets[0]) return;
      setUploadingLogo(true);
      const asset = result.assets[0];
      const file = new File(asset.uri);
      const response = await snapquoteApi.uploadAvatar({
        fileName: asset.fileName ?? "business-logo.jpg",
        contentType: normalizeImageContentType(asset.mimeType),
        base64: await file.base64()
      });
      setMe({ ...me, org: response.org });
    } catch (error) {
      Alert.alert("Could not update logo", userFacingErrorMessage(error));
    } finally {
      setUploadingLogo(false);
    }
  }

  async function removeLogo() {
    if (!me?.org.logoUrl || uploadingLogo) return;

    try {
      setUploadingLogo(true);
      const response = await snapquoteApi.deleteAvatar();
      setMe({ ...me, org: response.org });
    } catch (error) {
      Alert.alert("Could not remove logo", userFacingErrorMessage(error));
    } finally {
      setUploadingLogo(false);
    }
  }

  function toggleService(service: string) {
    setSaveMessage(null);
    setServices((current) => current.includes(service)
      ? current.filter((candidate) => candidate !== service)
      : uniqueServices([...current, service]).slice(0, 12));
  }

  function addCustomService() {
    const service = customService.trim();
    if (!service || services.includes(service)) {
      setCustomService("");
      return;
    }
    if (services.length >= 12) {
      Alert.alert("Service limit reached", "Add up to 12 services to keep the public profile focused.");
      return;
    }
    setServices((current) => [...current, service]);
    setCustomService("");
    setSaveMessage(null);
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

  function updateLocalPortfolioItem(id: string, patch: Partial<PublicPortfolioItem>) {
    setPortfolio((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  async function saveCaption(item: PublicPortfolioItem) {
    if (portfolioBusyId !== null) return;
    setPortfolioBusyId(item.id);

    try {
      const response = await snapquoteApi.updatePortfolioItem(item.id, { caption: item.caption.trim() });
      updateLocalPortfolioItem(item.id, response.item);
    } catch (error) {
      await refreshPortfolio();
      Alert.alert("Could not save caption", userFacingErrorMessage(error));
    } finally {
      setPortfolioBusyId(null);
    }
  }

  async function togglePublished(item: PublicPortfolioItem) {
    if (portfolioBusyId !== null) return;
    const previous = item.published;
    updateLocalPortfolioItem(item.id, { published: !previous });
    setPortfolioBusyId(item.id);

    try {
      const response = await snapquoteApi.updatePortfolioItem(item.id, { published: !previous });
      updateLocalPortfolioItem(item.id, response.item);
    } catch (error) {
      updateLocalPortfolioItem(item.id, { published: previous });
      Alert.alert("Could not update photo", userFacingErrorMessage(error));
    } finally {
      setPortfolioBusyId(null);
    }
  }

  async function movePhoto(index: number, direction: -1 | 1) {
    const destination = index + direction;
    if (reordering || destination < 0 || destination >= portfolio.length) return;

    const previous = portfolio;
    const next = [...portfolio];
    const [item] = next.splice(index, 1);
    if (!item) return;
    next.splice(destination, 0, item);
    setPortfolio(next.map((candidate, position) => ({ ...candidate, position })));
    setReordering(true);

    try {
      const response = await snapquoteApi.reorderPortfolioItems(next.map((candidate) => candidate.id));
      setPortfolio(response.items);
    } catch (error) {
      setPortfolio(previous);
      Alert.alert("Could not reorder photos", userFacingErrorMessage(error));
    } finally {
      setReordering(false);
    }
  }

  function confirmDelete(item: PublicPortfolioItem) {
    Alert.alert("Remove work photo?", "It will no longer appear on your public request page.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => void deletePhoto(item) }
    ]);
  }

  async function deletePhoto(item: PublicPortfolioItem) {
    if (portfolioBusyId !== null) return;
    setPortfolioBusyId(item.id);

    try {
      await snapquoteApi.deletePortfolioItem(item.id);
      setPortfolio((current) => current.filter((candidate) => candidate.id !== item.id));
    } catch (error) {
      Alert.alert("Could not remove photo", userFacingErrorMessage(error));
    } finally {
      setPortfolioBusyId(null);
    }
  }

  async function refreshPortfolio() {
    try {
      const response = await snapquoteApi.listPortfolio();
      setPortfolio(response.items);
    } catch {
      // The original action error is more useful than a second refresh error.
    }
  }

  function openPublicPage() {
    if (publicPageUrl) void Linking.openURL(publicPageUrl);
  }

  async function copyPublicPage() {
    if (!publicPageUrl) return;
    await Clipboard.setStringAsync(publicPageUrl);
    setSaveMessage("Public link copied");
  }

  async function sharePublicPage() {
    if (!publicPageUrl) return;
    await Share.share({
      message: `Request a quote from ${businessName.trim() || "our business"}: ${publicPageUrl}`,
      url: publicPageUrl
    });
  }

  return (
    <Screen edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.nav}>
          <Pressable accessibilityLabel="Go back" accessibilityRole="button" onPress={() => router.back()} style={styles.navButton}>
            <ChevronLeft color={colors.ink} size={20} strokeWidth={2.4} />
          </Pressable>
          <Text style={styles.navTitle}>Public profile</Text>
          <Pressable accessibilityLabel="Preview public page" accessibilityRole="button" onPress={openPublicPage} style={styles.navButton}>
            <ExternalLink color={colors.ink} size={17} strokeWidth={2.2} />
          </Pressable>
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>Your public profile</Text>
          <Text style={styles.subtitle}>Give customers enough proof to request a quote confidently.</Text>
        </View>

        <View style={styles.completeness}>
          <View style={styles.completenessHead}>
            <Text style={styles.completenessTitle}>Profile strength</Text>
            <Text style={styles.completenessValue}>{completion}%</Text>
          </View>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${completion}%` }]} /></View>
          <Text style={styles.completenessCopy}>{completion === 100 ? "Ready to share" : "Add details and published work to improve customer trust."}</Text>
        </View>

        <View style={styles.actionRow}>
          <ActionButton icon={<ExternalLink color={colors.ink2} size={16} />} label="Preview" onPress={openPublicPage} />
          <ActionButton icon={<Copy color={colors.ink2} size={16} />} label="Copy link" onPress={() => void copyPublicPage()} />
          <ActionButton icon={<Share2 color={colors.ink2} size={16} />} label="Share" onPress={() => void sharePublicPage()} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Business identity</Text>
          <View style={styles.logoRow}>
            <BusinessAvatar businessName={businessName || "QuoteVan"} logoUrl={me?.org.logoUrl ?? null} size={72} />
            <View style={styles.logoActions}>
              <Pressable accessibilityRole="button" disabled={uploadingLogo} onPress={() => void uploadLogo()} style={styles.secondaryButton}>
                <Camera color={colors.green} size={15} strokeWidth={2.3} />
                <Text style={styles.secondaryButtonText}>{uploadingLogo ? "Updating..." : me?.org.logoUrl ? "Change logo" : "Add logo"}</Text>
              </Pressable>
              {me?.org.logoUrl ? (
                <Pressable accessibilityRole="button" disabled={uploadingLogo} onPress={() => void removeLogo()}>
                  <Text style={styles.removeText}>Remove</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
          <Field label="Business name" maxLength={120} onChangeText={setBusinessName} placeholder="Business name" value={businessName} />
          <Field editable={false} label="Trade" maxLength={80} onChangeText={() => undefined} value={sentenceCase(me?.org.trade ?? "painting")} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Provider details</Text>
          <Field label="Service area" maxLength={160} onChangeText={setServiceArea} placeholder="Toronto and the GTA" value={serviceArea} />
          <Field keyboardType="number-pad" label="Years in business" maxLength={3} onChangeText={(value) => setYears(value.replace(/\D/g, ""))} placeholder="8" value={years} />
          <Field label="About your work" maxLength={500} multiline onChangeText={setBio} placeholder="Interior and exterior painting, cabinets, and drywall repair." value={bio} />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionLabel}>Services offered</Text>
            <Text style={styles.sectionMeta}>{services.length}/12</Text>
          </View>
          <View style={styles.serviceGrid}>
            {paintingServices.map((service) => {
              const selected = services.includes(service);
              return (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  key={service}
                  onPress={() => toggleService(service)}
                  style={[styles.serviceChoice, selected ? styles.serviceChoiceSelected : null]}
                >
                  {selected ? <Check color={colors.onDark} size={14} strokeWidth={2.6} /> : null}
                  <Text style={[styles.serviceChoiceText, selected ? styles.serviceChoiceTextSelected : null]}>{service}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.customServiceRow}>
            <TextInput
              maxLength={80}
              onChangeText={setCustomService}
              onSubmitEditing={addCustomService}
              placeholder="Add another service"
              placeholderTextColor={colors.ink3}
              style={styles.customServiceInput}
              value={customService}
            />
            <Pressable accessibilityLabel="Add service" accessibilityRole="button" onPress={addCustomService} style={styles.addServiceButton}>
              <Plus color={colors.onDark} size={18} strokeWidth={2.5} />
            </Pressable>
          </View>
          {services.filter((service) => !paintingServices.includes(service)).length > 0 ? (
            <View style={styles.customTags}>
              {services.filter((service) => !paintingServices.includes(service)).map((service) => (
                <Pressable accessibilityLabel={`Remove ${service}`} key={service} onPress={() => toggleService(service)} style={styles.customTag}>
                  <Text style={styles.customTagText}>{service}</Text>
                  <Text style={styles.customTagRemove}>x</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Customer contact</Text>
          <Field keyboardType="phone-pad" label="Phone" maxLength={80} onChangeText={setPhone} placeholder="(416) 555-0148" value={phone} />
          <Field autoCapitalize="none" keyboardType="url" label="Website" maxLength={240} onChangeText={setWebsite} placeholder="example.com" value={website} />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <View>
              <Text style={styles.sectionLabel}>Completed work</Text>
              <Text style={styles.sectionMeta}>{portfolio.filter((item) => item.published).length} public / {portfolio.length} total</Text>
            </View>
            <Pressable accessibilityRole="button" disabled={uploading || portfolio.length >= 6} onPress={() => void addPhotos()} style={[styles.secondaryButton, uploading || portfolio.length >= 6 ? styles.buttonDisabled : null]}>
              <Camera color={colors.green} size={15} strokeWidth={2.3} />
              <Text style={styles.secondaryButtonText}>{uploading ? "Adding..." : "Add photos"}</Text>
            </Pressable>
          </View>

          {loadingPhotos ? <Text style={styles.emptyText}>Loading photos...</Text> : null}
          {!loadingPhotos && portfolio.length === 0 ? (
            <View style={styles.emptyPhotos}>
              <Camera color={colors.ink3} size={24} strokeWidth={1.8} />
              <Text style={styles.emptyTitle}>No work photos yet</Text>
              <Text style={styles.emptyText}>Add finished jobs, then choose which ones appear publicly.</Text>
            </View>
          ) : null}
          {portfolio.map((item, index) => (
            <View key={item.id} style={styles.portfolioItem}>
              <Image source={{ uri: item.imageUrl }} style={[styles.portfolioImage, !item.published ? styles.portfolioImageHidden : null]} />
              <View style={styles.portfolioBody}>
                <TextInput
                  maxLength={160}
                  onBlur={() => void saveCaption(item)}
                  onChangeText={(caption) => updateLocalPortfolioItem(item.id, { caption })}
                  placeholder="Add a short caption"
                  placeholderTextColor={colors.ink3}
                  style={styles.captionInput}
                  value={item.caption}
                />
                <View style={styles.portfolioControls}>
                  <View style={styles.publishControl}>
                    {item.published ? <Eye color={colors.green} size={14} /> : <EyeOff color={colors.ink3} size={14} />}
                    <Text style={styles.publishLabel}>{item.published ? "Public" : "Hidden"}</Text>
                    <Switch
                      disabled={portfolioBusyId !== null}
                      onValueChange={() => void togglePublished(item)}
                      trackColor={{ false: colors.borderStrong, true: colors.greenBorder }}
                      thumbColor={item.published ? colors.green : colors.surface}
                      value={item.published}
                    />
                  </View>
                  <View style={styles.orderControls}>
                    <IconButton disabled={index === 0 || reordering} icon={<ChevronUp color={colors.ink2} size={16} />} label="Move photo earlier" onPress={() => void movePhoto(index, -1)} />
                    <IconButton disabled={index === portfolio.length - 1 || reordering} icon={<ChevronDown color={colors.ink2} size={16} />} label="Move photo later" onPress={() => void movePhoto(index, 1)} />
                    <IconButton disabled={portfolioBusyId !== null} icon={<Trash2 color={colors.red} size={15} />} label="Remove work photo" onPress={() => confirmDelete(item)} />
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.reviewStatus}>
          <Check color={colors.green} size={17} strokeWidth={2.2} />
          <View style={styles.reviewCopyWrap}>
            <Text style={styles.reviewTitle}>Verified reviews only</Text>
            <Text style={styles.reviewCopy}>Request review links from accepted quotes. Providers cannot create customer reviews.</Text>
          </View>
        </View>

        {saveMessage ? <Text accessibilityLiveRegion="polite" style={styles.saveMessage}>{saveMessage}</Text> : null}
        <Pressable accessibilityRole="button" disabled={saving || !dirty} onPress={() => void saveProfile()} style={[styles.saveButton, saving || !dirty ? styles.buttonDisabled : null]}>
          <Text style={styles.saveButtonText}>{saving ? "Saving..." : dirty ? "Save public profile" : "Profile saved"}</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

function ActionButton(props: { icon: ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={props.onPress} style={styles.actionButton}>
      {props.icon}
      <Text style={styles.actionButtonText}>{props.label}</Text>
    </Pressable>
  );
}

function IconButton(props: { disabled: boolean; icon: ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityLabel={props.label} accessibilityRole="button" disabled={props.disabled} onPress={props.onPress} style={[styles.iconButton, props.disabled ? styles.iconButtonDisabled : null]}>
      {props.icon}
    </Pressable>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  maxLength: number;
  autoCapitalize?: "none" | "sentences" | undefined;
  editable?: boolean | undefined;
  keyboardType?: "default" | "number-pad" | "phone-pad" | "url" | undefined;
  multiline?: boolean | undefined;
  placeholder?: string | undefined;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        autoCapitalize={props.autoCapitalize}
        editable={props.editable ?? true}
        keyboardType={props.keyboardType ?? "default"}
        maxLength={props.maxLength}
        multiline={props.multiline}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={colors.ink3}
        style={[styles.input, props.multiline ? styles.inputMultiline : null, props.editable === false ? styles.inputDisabled : null]}
        textAlignVertical={props.multiline ? "top" : "center"}
        value={props.value}
      />
    </View>
  );
}

function profileDraft(me: MeResponse | null): ProfileDraft {
  return {
    businessName: me?.org.name ?? "",
    phone: me?.org.contactPhone ?? "",
    website: me?.org.website ?? "",
    bio: me?.org.profileBio ?? "",
    serviceArea: me?.org.serviceArea ?? "",
    years: me?.org.yearsInBusiness === null || me?.org.yearsInBusiness === undefined ? "" : String(me.org.yearsInBusiness),
    services: me?.org.profileServices ?? []
  };
}

function profileSnapshot(draft: ProfileDraft) {
  return JSON.stringify({
    businessName: draft.businessName.trim(),
    phone: draft.phone.trim(),
    website: draft.website.trim(),
    bio: draft.bio.trim(),
    serviceArea: draft.serviceArea.trim(),
    years: draft.years.trim(),
    services: uniqueServices(draft.services)
  });
}

function profileCompletion(input: { draft: ProfileDraft; hasLogo: boolean; hasPublishedWork: boolean }) {
  const checks = [
    input.draft.businessName.trim().length > 0,
    input.hasLogo,
    input.draft.bio.trim().length > 0,
    input.draft.serviceArea.trim().length > 0,
    input.draft.years.trim().length > 0,
    input.draft.phone.trim().length > 0 || input.draft.website.trim().length > 0,
    input.draft.services.length > 0,
    input.hasPublishedWork
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function uniqueServices(services: string[]) {
  return [...new Set(services.map((service) => service.trim()).filter(Boolean))];
}

function normalizeWebsite(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function sentenceCase(value: string) {
  const trimmed = value.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
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
  content: { gap: 22, paddingBottom: 36, paddingHorizontal: 20, paddingTop: 20 },
  nav: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  navButton: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 10, borderWidth: 1, height: 36, justifyContent: "center", width: 36 },
  navTitle: { ...typography.sectionLabel, color: colors.ink2, fontSize: 10, letterSpacing: 1.8, textTransform: "uppercase" },
  header: { gap: 7 },
  title: { ...typography.screenTitle, lineHeight: 32 },
  subtitle: { color: colors.ink3, fontSize: 14, ...fontStyles.regular, lineHeight: 20 },
  completeness: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, gap: 9, padding: 15 },
  completenessHead: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  completenessTitle: { color: colors.ink, fontSize: 14, ...fontStyles.bold },
  completenessValue: { color: colors.green, fontSize: 14, ...fontStyles.bold },
  progressTrack: { backgroundColor: colors.surfaceMuted, borderRadius: 3, height: 6, overflow: "hidden" },
  progressFill: { backgroundColor: colors.green, borderRadius: 3, height: 6 },
  completenessCopy: { color: colors.ink3, fontSize: 12, ...fontStyles.regular, lineHeight: 17 },
  actionRow: { flexDirection: "row", gap: 8 },
  actionButton: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, flex: 1, flexDirection: "row", gap: 7, justifyContent: "center", minHeight: 44, paddingHorizontal: 8 },
  actionButtonText: { color: colors.ink2, fontSize: 12, ...fontStyles.bold },
  section: { gap: 14 },
  sectionHead: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  sectionLabel: { color: colors.ink2, fontSize: 11, ...fontStyles.bold, letterSpacing: 1.4, textTransform: "uppercase" },
  sectionMeta: { color: colors.ink3, fontSize: 12, ...fontStyles.regular, marginTop: 3 },
  logoRow: { alignItems: "center", flexDirection: "row", gap: 15 },
  logoActions: { alignItems: "flex-start", gap: 9 },
  secondaryButton: { alignItems: "center", borderColor: colors.greenBorder, borderRadius: radius.sm, borderWidth: 1, flexDirection: "row", gap: 7, minHeight: 38, paddingHorizontal: 12 },
  secondaryButtonText: { color: colors.green, fontSize: 12, ...fontStyles.bold },
  removeText: { color: colors.red, fontSize: 12, ...fontStyles.bold },
  field: { gap: 7 },
  label: { color: colors.ink2, fontSize: 12, ...fontStyles.bold },
  input: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, color: colors.ink, fontSize: 15, ...fontStyles.regular, minHeight: 50, paddingHorizontal: 14 },
  inputMultiline: { minHeight: 112, paddingTop: 13 },
  inputDisabled: { backgroundColor: colors.surfaceMuted, color: colors.ink3 },
  serviceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  serviceChoice: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, flexDirection: "row", gap: 6, minHeight: 42, paddingHorizontal: 11 },
  serviceChoiceSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  serviceChoiceText: { color: colors.ink2, fontSize: 12, ...fontStyles.bold },
  serviceChoiceTextSelected: { color: colors.onDark },
  customServiceRow: { flexDirection: "row", gap: 8 },
  customServiceInput: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, color: colors.ink, flex: 1, fontSize: 14, ...fontStyles.regular, minHeight: 44, paddingHorizontal: 12 },
  addServiceButton: { alignItems: "center", backgroundColor: colors.ink, borderRadius: radius.sm, height: 44, justifyContent: "center", width: 44 },
  customTags: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  customTag: { alignItems: "center", backgroundColor: colors.greenBg, borderColor: colors.greenBorder, borderRadius: radius.sm, borderWidth: 1, flexDirection: "row", gap: 8, minHeight: 34, paddingHorizontal: 10 },
  customTagText: { color: colors.green, fontSize: 12, ...fontStyles.bold },
  customTagRemove: { color: colors.green, fontSize: 13, ...fontStyles.bold },
  buttonDisabled: { opacity: 0.52 },
  emptyPhotos: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderStyle: "dashed", borderWidth: 1, gap: 7, padding: 26 },
  emptyTitle: { color: colors.ink, fontSize: 14, ...fontStyles.bold },
  emptyText: { color: colors.ink3, fontSize: 12, ...fontStyles.regular, lineHeight: 17, textAlign: "center" },
  portfolioItem: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, flexDirection: "row", gap: 12, padding: 10 },
  portfolioImage: { borderRadius: radius.sm, height: 112, width: 112 },
  portfolioImageHidden: { opacity: 0.45 },
  portfolioBody: { flex: 1, gap: 10, minWidth: 0 },
  captionInput: { borderBottomColor: colors.border, borderBottomWidth: 1, color: colors.ink, fontSize: 13, ...fontStyles.regular, minHeight: 42, paddingHorizontal: 2, paddingVertical: 6 },
  portfolioControls: { gap: 8 },
  publishControl: { alignItems: "center", flexDirection: "row", gap: 6 },
  publishLabel: { color: colors.ink2, flex: 1, fontSize: 11, ...fontStyles.bold },
  orderControls: { flexDirection: "row", gap: 7 },
  iconButton: { alignItems: "center", backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderRadius: 7, borderWidth: 1, height: 32, justifyContent: "center", width: 34 },
  iconButtonDisabled: { opacity: 0.35 },
  reviewStatus: { alignItems: "flex-start", backgroundColor: colors.greenBg, borderColor: colors.greenBorder, borderRadius: radius.md, borderWidth: 1, flexDirection: "row", gap: 11, padding: 15 },
  reviewCopyWrap: { flex: 1 },
  reviewTitle: { color: colors.ink, fontSize: 14, ...fontStyles.bold },
  reviewCopy: { color: colors.ink2, fontSize: 12, ...fontStyles.regular, lineHeight: 17, marginTop: 3 },
  saveMessage: { color: colors.green, fontSize: 12, ...fontStyles.bold, textAlign: "center" },
  saveButton: { alignItems: "center", backgroundColor: colors.ink, borderRadius: radius.sm, justifyContent: "center", minHeight: 52 },
  saveButtonText: { color: colors.onDark, fontSize: 14, ...fontStyles.bold }
});
