import { StyleSheet, View } from "react-native";
import { colors } from "./theme";

export function QuoteMark(props: { size?: number | undefined }) {
  const scale = (props.size ?? 48) / 48;

  return (
    <View style={[styles.wrap, { height: 54 * scale, width: 48 * scale }]}>
      <View
        style={[
          styles.clip,
          {
            borderRadius: 7 * scale,
            borderWidth: 2.5 * scale,
            height: 46 * scale,
            left: 5 * scale,
            top: 6 * scale,
            width: 38 * scale
          }
        ]}
      >
        <View
          style={[
            styles.tab,
            {
              borderRadius: 4 * scale,
              borderWidth: 2.5 * scale,
              height: 10 * scale,
              left: 7.5 * scale,
              top: -6 * scale,
              width: 18 * scale
            }
          ]}
        />
        <View
          style={[
            styles.line,
            {
              backgroundColor: colors.green,
              height: 4.5 * scale,
              left: 7 * scale,
              top: 10 * scale,
              width: 20 * scale
            }
          ]}
        />
        <View
          style={[
            styles.line,
            {
              backgroundColor: colors.amber,
              height: 4.5 * scale,
              left: 7 * scale,
              top: 19 * scale,
              width: 20 * scale
            }
          ]}
        />
        <View
          style={[
            styles.line,
            {
              backgroundColor: colors.red,
              height: 4.5 * scale,
              left: 7 * scale,
              top: 28 * scale,
              width: 13 * scale
            }
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "relative"
  },
  clip: {
    backgroundColor: colors.surface,
    borderColor: colors.ink,
    position: "absolute"
  },
  tab: {
    backgroundColor: colors.surface,
    borderColor: colors.ink,
    position: "absolute"
  },
  line: {
    borderRadius: 2,
    position: "absolute"
  }
});
