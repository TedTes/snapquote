import type { ReactNode } from "react";

export type DemoScreenId =
  | "dashboard"
  | "customer"
  | "job"
  | "notes"
  | "transcriptReview"
  | "draftReview"
  | "preview"
  | "sent"
  | "quotes"
  | "customerProfile"
  | "customerEmail"
  | "publicQuote"
  | "payment";

export type DemoScreenSide = "provider" | "customer";

export type DemoActionId =
  | "tapFab"
  | "typeCustomer"
  | "setChecklist"
  | "recordNotes"
  | "reviewTranscript"
  | "resolvePrices"
  | "sendQuote"
  | "trackViewed"
  | "openQuotes"
  | "openCustomer"
  | "openEmail"
  | "openProposal"
  | "payDeposit"
  | "updateStatus";

export type DemoEventType = "tap" | "type" | "select" | "record" | "resolve" | "send" | "status";

export interface DemoScenarioEvent {
  id: string;
  type: DemoEventType;
  target: string;
  atMs: number;
  durationMs?: number;
  value?: string;
  caption?: string;
  voiceover?: string;
  audioSrc?: string;
}

export interface DemoScenarioStep {
  id: string;
  screen: DemoScreenId;
  action: DemoActionId;
  durationMs: number;
  caption: string;
  voiceover: string;
  audioSrc?: string;
  events?: DemoScenarioEvent[];
}

export interface DemoPlaybackState {
  step: DemoScenarioStep;
  activeEvent?: DemoScenarioEvent;
  stepIndex: number;
  totalSteps: number;
  elapsedMs: number;
  progress: number;
  eventProgress: number;
  isPlaying: boolean;
}

export type DemoScreenRenderer = (state: DemoPlaybackState) => ReactNode;
