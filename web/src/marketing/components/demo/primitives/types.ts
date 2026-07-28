import type { ReactNode } from "react";

export type TrustState = "confirmed" | "needsOk" | "needsPrice" | "neutral";

export type QuoteStatusTone =
  | "draft"
  | "ready"
  | "sent"
  | "viewed"
  | "accepted"
  | "stale"
  | "superseded";

export type DemoTab = "today" | "quotes" | "new" | "priceBook" | "settings";

export interface DemoAction {
  id: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
}
