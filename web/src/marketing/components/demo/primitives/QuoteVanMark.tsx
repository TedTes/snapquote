import type { CSSProperties } from "react";
import { cx } from "./utils";

interface QuoteVanMarkProps {
  className?: string;
  size?: number;
  label?: string;
  showLabel?: boolean;
  framed?: boolean;
}

export function QuoteVanMark({
  className,
  size = 32,
  label = "QuoteVan",
  showLabel = false,
  framed = false,
}: QuoteVanMarkProps) {
  const style = { "--mark-size": `${size}px` } as CSSProperties;

  return (
    <span className={cx("qv-demo-mark-wrap", framed && "is-framed", className)} style={style}>
      <svg aria-hidden="true" className="qv-demo-mark" viewBox="190 175 610 540">
        <path
          className="qv-demo-mark-q-fill"
          d="M468 682C341 682 238 579 238 452C238 325 341 222 468 222C595 222 698 325 698 452C698 579 595 682 468 682ZM468 588C543 588 604 527 604 452C604 377 543 316 468 316C393 316 332 377 332 452C332 527 393 588 468 588Z"
        />
        <path
          className="qv-demo-mark-q-bridge"
          d="M459 560L562 663"
          fill="none"
          strokeLinecap="round"
          strokeWidth="96"
        />
        <path
          className="qv-demo-mark-v"
          d="M430 488L570 658L748 446"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="82"
        />
      </svg>
      {showLabel ? <span className="qv-demo-mark-label">{label}</span> : null}
    </span>
  );
}
