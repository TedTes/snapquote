import type { TrustState } from "./types";
import { cx } from "./utils";

interface TrustSwatchProps {
  state: TrustState;
  size?: "action" | "list" | "stripe" | "dot";
  className?: string;
}

export function TrustSwatch({ state, size = "list", className }: TrustSwatchProps) {
  return <span className={cx("qv-demo-swatch", `is-${state}`, `is-${size}`, className)} aria-hidden="true" />;
}
