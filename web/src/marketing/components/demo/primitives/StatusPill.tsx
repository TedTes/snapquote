import type { QuoteStatusTone } from "./types";
import { cx } from "./utils";

interface StatusPillProps {
  tone: QuoteStatusTone;
  children: string;
}

export function StatusPill({ tone, children }: StatusPillProps) {
  return <span className={cx("qv-demo-status-pill", `is-${tone}`)}>{children}</span>;
}
