import type { ReactNode } from "react";
import { cx } from "./utils";

interface DemoButtonProps {
  children: ReactNode;
  icon?: ReactNode;
  tone?: "primary" | "secondary" | "quiet";
  disabled?: boolean;
  className?: string;
}

export function DemoButton({ children, icon, tone = "primary", disabled = false, className }: DemoButtonProps) {
  return (
    <button className={cx("qv-demo-button", `is-${tone}`, className)} disabled={disabled} type="button">
      {icon ? <span className="qv-demo-button-icon">{icon}</span> : null}
      <span>{children}</span>
    </button>
  );
}
