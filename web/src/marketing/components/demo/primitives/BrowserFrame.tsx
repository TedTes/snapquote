import type { ReactNode } from "react";
import "../styles/demo-primitives.css";
import { cx } from "./utils";

interface BrowserFrameProps {
  children: ReactNode;
  className?: string;
  address?: string;
}

/** Desktop/browser-chrome surface for the customer side of the story -- never a phone. */
export function BrowserFrame({ children, className, address = "quotevan.com" }: BrowserFrameProps) {
  return (
    <div className={cx("qv-demo-browser", className)}>
      <div className="qv-demo-browser-bar">
        <span aria-hidden="true" className="qv-demo-browser-dots">
          <i />
          <i />
          <i />
        </span>
        <span className="qv-demo-browser-address">{address}</span>
      </div>
      <div className="qv-demo-browser-screen">{children}</div>
    </div>
  );
}
