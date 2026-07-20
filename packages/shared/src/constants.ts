export const quoteStatuses = [
  "draft",
  "sent",
  "viewed",
  "accepted",
  "declined",
  "expired"
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
export const lineItemSources = ["price_book", "ai_suggested", "manual"] as const;
export const deliveryChannels = ["email", "sms"] as const;
export const customerResponseActions = ["accept", "decline"] as const;
export const quoteEventTypes = [
  "sent_email",
  "sent_sms",
  "viewed",
  "accepted",
  "declined",
  "follow_up_sent"
] as const;

export const DEFAULT_MATCH_AUTO_THRESHOLD = 0.8;
export const DEFAULT_MATCH_SUGGEST_THRESHOLD = 0.6;
export const MAX_CAPTURE_PHOTOS = 12;
export const MAX_AUDIO_SECONDS = 180;
export const EMBEDDING_DIMENSIONS = 1536;
