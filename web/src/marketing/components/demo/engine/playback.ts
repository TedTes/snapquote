import type { DemoPlaybackState, DemoEventType, DemoScreenId, DemoScreenSide } from "./types";

export interface TargetCoordinates {
  x: string;
  y: string;
}

const screenSides: Record<DemoScreenId, DemoScreenSide> = {
  dashboard: "provider",
  customer: "provider",
  job: "provider",
  notes: "provider",
  draftReview: "provider",
  preview: "provider",
  sent: "provider",
  quotes: "provider",
  customerProfile: "provider",
  customerEmail: "customer",
  publicQuote: "customer",
  payment: "customer",
};

export function screenSide(screen: DemoScreenId): DemoScreenSide {
  return screenSides[screen];
}

export function isActiveTarget(state: DemoPlaybackState, target: string, type?: DemoEventType) {
  return state.activeEvent?.target === target && (!type || state.activeEvent.type === type);
}

export function hasPassedEvent(state: DemoPlaybackState, target: string, type?: DemoEventType) {
  return (state.step.events ?? []).some((event) => (
    event.target === target
    && (!type || event.type === type)
    && state.elapsedMs >= event.atMs + (event.durationMs ?? 0)
  ));
}

export function typedValue(state: DemoPlaybackState, target: string, fallback = "") {
  const event = (state.step.events ?? []).find((candidate) => candidate.type === "type" && candidate.target === target);

  if (!event) {
    return fallback;
  }

  if (state.elapsedMs < event.atMs) {
    return "";
  }

  const value = event.value ?? "";
  const progress = Math.min(Math.max((state.elapsedMs - event.atMs) / (event.durationMs ?? 900), 0), 1);
  const visibleCharacters = Math.ceil(value.length * progress);
  return value.slice(0, visibleCharacters);
}

export function targetCoordinates(target?: string): TargetCoordinates | undefined {
  switch (target) {
    case "fab":
      return { x: "50%", y: "94%" };
    case "walkthrough":
      return { x: "84%", y: "76%" };
    case "customerName":
      return { x: "35%", y: "35%" };
    case "jobAddress":
      return { x: "42%", y: "62%" };
    case "jobTitle":
      return { x: "42%", y: "74%" };
    case "nextButton":
      return { x: "50%", y: "94%" };
    case "mediumRooms":
      return { x: "88%", y: "45%" };
    case "coats":
      return { x: "50%", y: "79%" };
    case "mic":
      return { x: "20%", y: "32%" };
    case "previewSend":
      return { x: "50%", y: "88%" };
    case "sendQuote":
      return { x: "50%", y: "94%" };
    case "quoteEmail":
      return { x: "46%", y: "41%" };
    case "acceptQuote":
      return { x: "31%", y: "80%" };
    case "payDeposit":
      return { x: "50%", y: "94%" };
    default:
      return undefined;
  }
}
