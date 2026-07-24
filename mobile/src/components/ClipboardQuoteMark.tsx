import Svg, { Rect } from "react-native-svg";
import { colors } from "./theme";

export function ClipboardQuoteMark(props: { size?: number | undefined }) {
  const size = props.size ?? 48;

  return (
    <Svg height={size} viewBox="0 0 48 56" width={size}>
      <Rect
        fill={colors.surfaceRaised}
        height="40"
        rx="7"
        stroke={colors.dark}
        strokeWidth="3"
        width="32"
        x="8"
        y="10"
      />
      <Rect
        fill={colors.surfaceRaised}
        height="10"
        rx="4"
        stroke={colors.dark}
        strokeWidth="3"
        width="18"
        x="15"
        y="4"
      />
      <Rect fill={colors.green} height="4.5" rx="2.25" width="20" x="15" y="22" />
      <Rect fill={colors.amber} height="4.5" rx="2.25" width="20" x="15" y="32" />
      <Rect fill={colors.red} height="4.5" rx="2.25" width="13" x="15" y="42" />
    </Svg>
  );
}
