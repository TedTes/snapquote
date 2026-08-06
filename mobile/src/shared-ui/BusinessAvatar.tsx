import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { businessInitials } from "../utils/format";
import { colors } from "./theme";

type BusinessAvatarProps = {
  businessName: string | null | undefined;
  logoUrl?: string | null | undefined;
  size?: number | undefined;
  style?: StyleProp<ViewStyle> | undefined;
  textSize?: number | undefined;
};

export function BusinessAvatar(props: BusinessAvatarProps) {
  const size = props.size ?? 48;
  const radius = size / 2;
  const textSize = props.textSize ?? Math.max(14, Math.round(size * 0.34));
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [props.logoUrl]);

  const imageUri = typeof props.logoUrl === "string" && props.logoUrl.trim().length > 0 ? props.logoUrl : null;
  const showImage = imageUri !== null && !imageFailed;
  const dynamicFrame = {
    borderRadius: radius,
    height: size,
    width: size
  };

  return (
    <View style={[styles.avatar, dynamicFrame, props.style]}>
      {showImage ? (
        <Image
          accessibilityIgnoresInvertColors
          onError={() => setImageFailed(true)}
          source={{ uri: imageUri ?? "" }}
          style={[styles.image, dynamicFrame]}
        />
      ) : (
        <Text style={[styles.text, { fontSize: textSize }]}>{businessInitials(props.businessName)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: "center",
    backgroundColor: colors.dark,
    justifyContent: "center",
    overflow: "hidden"
  },
  image: {
    resizeMode: "cover"
  },
  text: {
    color: colors.onDark,
    fontWeight: "900",
    letterSpacing: 0
  }
});
