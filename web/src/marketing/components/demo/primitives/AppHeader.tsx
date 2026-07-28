import type { ReactNode } from "react";
import { QuoteVanMark } from "./QuoteVanMark";
import { cx } from "./utils";

interface AppHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  avatarText?: string;
  showLogoAvatar?: boolean;
  leftAction?: ReactNode;
  rightAction?: ReactNode;
  centered?: boolean;
}

export function AppHeader({
  eyebrow,
  title,
  subtitle,
  avatarText,
  showLogoAvatar = false,
  leftAction,
  rightAction,
  centered = false,
}: AppHeaderProps) {
  return (
    <header className={cx("qv-demo-app-header", centered && "is-centered")}>
      {leftAction ? <div className="qv-demo-header-action">{leftAction}</div> : null}
      <div className="qv-demo-header-copy">
        {eyebrow ? <span>{eyebrow}</span> : null}
        <strong>{title}</strong>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {rightAction ? (
        <div className="qv-demo-header-action">{rightAction}</div>
      ) : avatarText || showLogoAvatar ? (
        <div className="qv-demo-avatar">
          {showLogoAvatar ? <QuoteVanMark size={28} /> : avatarText}
        </div>
      ) : null}
    </header>
  );
}
