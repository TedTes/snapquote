import Svg, { Path, Rect } from "react-native-svg";
import { colors } from "./theme";

export function QuoteMark(props: { size?: number | undefined; boxed?: boolean | undefined }) {
  const size = props.size ?? 48;
  const boxed = props.boxed ?? true;

  return (
    <Svg height={size} viewBox="0 0 1024 1024" width={size}>
      {boxed ? <Rect fill={colors.dark} height="1024" rx="232" width="1024" /> : null}
      <Path
        d="M468 682C341 682 238 579 238 452C238 325 341 222 468 222C595 222 698 325 698 452C698 579 595 682 468 682ZM468 588C543 588 604 527 604 452C604 377 543 316 468 316C393 316 332 377 332 452C332 527 393 588 468 588Z"
        fill={colors.surfaceRaised}
      />
      <Path d="M459 560L562 663" stroke={colors.surfaceRaised} strokeLinecap="round" strokeWidth="96" />
      <Path
        d="M430 488L570 658L748 446"
        stroke={colors.green}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="82"
      />
    </Svg>
  );
}
