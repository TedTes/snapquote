import type { ReactNode } from "react";
import "../styles/demo-primitives.css";
import { PhoneStatusBar } from "./PhoneStatusBar";
import { cx } from "./utils";

interface PhoneFrameProps {
  children: ReactNode;
  className?: string;
  time?: string;
  rightLabel?: string;
  withStatusBar?: boolean;
}

export function PhoneFrame({
  children,
  className,
  time,
  rightLabel,
  withStatusBar = true,
}: PhoneFrameProps) {
  return (
    <div className={cx("qv-demo-phone", className)}>
      {withStatusBar ? <PhoneStatusBar time={time} rightLabel={rightLabel} /> : null}
      <div className="qv-demo-phone-screen">{children}</div>
    </div>
  );
}
