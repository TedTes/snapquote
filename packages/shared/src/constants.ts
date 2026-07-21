export const quoteStatuses = [
  "draft",
  "sent",
  "viewed",
  "accepted",
  "declined",
  "expired",
  "superseded"
] as const;

export const jobStatuses = [
  "capturing",
  "uploading",
  "transcribing",
  "extracting",
  "matching",
  "drafted",
  "sent",
  "viewed",
  "accepted",
  "declined",
  "expired",
  "failed"
] as const;

export const lineItemKinds = ["labour", "material"] as const;
export const lineItemSources = ["price_book", "manual"] as const;
export const lineItemMatchStates = ["green", "yellow", "red"] as const;
export const deliveryChannels = ["email"] as const;
export const customerResponseActions = ["accept", "decline"] as const;
export const quoteEventTypes = [
  "created",
  "sent",
  "viewed",
  "accepted",
  "declined",
  "expired",
  "followed_up",
  "superseded"
] as const;

export const quoteUnits = [
  "room",
  "each",
  "hour",
  "flat",
  "sqft",
  "lnft",
  "day"
] as const;

export const roomSizes = ["small", "medium", "large"] as const;
export const prepLevels = ["light", "normal", "heavy"] as const;

export const DEFAULT_MATCH_AUTO_THRESHOLD = 0.8;
export const DEFAULT_MATCH_SUGGEST_THRESHOLD = 0.6;
export const STALE_QUOTE_DAYS = 3;
export const MAX_INTERNAL_QUOTE_PHOTOS = 3;
export const MAX_AUDIO_SECONDS = 180;
export const EMBEDDING_DIMENSIONS = 1536;
