import type { ReactNode } from "react";
import { cx } from "./utils";

interface IconTileProps {
  children?: ReactNode;
  tone?: "neutral" | "green" | "amber" | "red" | "dark";
  label?: string;
  className?: string;
}

export function IconTile({ children, tone = "neutral", label, className }: IconTileProps) {
  return (
    <span className={cx("qv-demo-icon-tile", `is-${tone}`, className)} aria-label={label}>
      {children}
    </span>
  );
}
