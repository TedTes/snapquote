import { STALE_QUOTE_DAYS, type quoteStatuses } from "./constants.js";
import type { QuoteEvent, QuoteLineItem } from "./schemas.js";

export type QuoteStatus = (typeof quoteStatuses)[number];

export type SendBlockers = {
  redLineCount: number;
  yellowLineCount: number;
  reasons: string[];
};

export function getQuoteSendBlockers(lineItems: QuoteLineItem[]): SendBlockers {
  const redLineCount = lineItems.filter((line) => line.matchState === "red").length;
  const yellowLineCount = lineItems.filter((line) => line.matchState === "yellow").length;
  const reasons: string[] = [];

  if (redLineCount > 0) {
    reasons.push(`${redLineCount} line ${redLineCount === 1 ? "needs" : "need"} a price`);
  }

  if (yellowLineCount > 0) {
    reasons.push(
      `${yellowLineCount} suggested ${yellowLineCount === 1 ? "line needs" : "lines need"} confirmation`
    );
  }

  return {
    redLineCount,
    yellowLineCount,
    reasons
  };
}

export function assertQuoteCanSend(lineItems: QuoteLineItem[]): void {
  const blockers = getQuoteSendBlockers(lineItems);

  if (blockers.reasons.length > 0) {
    throw new Error(`Quote cannot be sent: ${blockers.reasons.join("; ")}`);
  }
}

export function deriveQuoteStatus(params: {
  events: QuoteEvent[];
  validUntil: string;
  now: Date;
}): QuoteStatus {
  const eventTypes = new Set(params.events.map((event) => event.type));
  const validUntilEnd = endOfDate(params.validUntil);

  if (eventTypes.has("superseded")) {
    return "superseded";
  }

  if (eventTypes.has("accepted")) {
    return "accepted";
  }

  if (eventTypes.has("declined")) {
    return "declined";
  }

  if (params.now > validUntilEnd && eventTypes.has("sent")) {
    return "expired";
  }

  if (eventTypes.has("viewed")) {
    return "viewed";
  }

  if (eventTypes.has("sent")) {
    return "sent";
  }

  return "draft";
}

export function isQuoteStale(params: {
  sentAt: string | null;
  firstViewedAt: string | null;
  respondedAt: string | null;
  now: Date;
  thresholdDays?: number;
}): boolean {
  if (params.sentAt === null || params.respondedAt !== null) {
    return false;
  }

  const thresholdMs = (params.thresholdDays ?? STALE_QUOTE_DAYS) * 24 * 60 * 60 * 1000;
  const sentAt = new Date(params.sentAt);

  if (params.now.getTime() - sentAt.getTime() < thresholdMs) {
    return false;
  }

  return params.firstViewedAt === null || params.respondedAt === null;
}

export function canAcceptPublicQuote(params: {
  status: QuoteStatus;
  validUntil: string;
  now: Date;
}): boolean {
  return params.status !== "expired" && params.status !== "superseded" && params.now <= endOfDate(params.validUntil);
}

function endOfDate(date: string): Date {
  return new Date(`${date}T23:59:59.999Z`);
}
