import { STALE_QUOTE_DAYS, type quoteStatuses, type quoteWorkTypes } from "./constants.js";
import type { PainterChecklist, QuoteEvent, QuoteLineItem } from "./schemas.js";

export type QuoteStatus = (typeof quoteStatuses)[number];
export type QuoteWorkType = (typeof quoteWorkTypes)[number];

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

const JOB_LABEL_MAX_LENGTH = 32;
// A title already mentioning a count/room, or already joining specific named
// areas with "+" (e.g. "Kitchen + hallway"), is complete on its own -- don't
// pile a room-count suffix onto it.
const ALREADY_DESCRIPTIVE_PATTERN = /\d|\broom(s)?\b|\+/i;
const GENERIC_JOB_TITLE_PATTERN = /^(?:interior\s+(?:paint|painting|repaint|repainting)|exterior\s+trim)$/i;

/**
 * Render-time job title for a quote card/list -- never persisted. Prefers what the
 * provider typed, falls back to a label built from the checklist, then the scope
 * summary, then a generic placeholder. Never returns an empty string.
 */
export function deriveJobLabel(quote: {
  workType?: QuoteWorkType | string | null | undefined;
  jobTitle?: string | null | undefined;
  checklist: PainterChecklist;
  scopeSummary: string;
}): string {
  const typed = quote.jobTitle?.trim() ?? "";

  if (typed.length > 0 && !GENERIC_JOB_TITLE_PATTERN.test(typed)) {
    const rooms = totalCheckedRooms(quote.checklist);

    if (rooms > 0 && !ALREADY_DESCRIPTIVE_PATTERN.test(typed)) {
      return `${typed} · ${rooms} ${plural(rooms, "room")}`;
    }

    return typed;
  }

  const checklistLabel = deriveChecklistLabel(inferQuoteWorkType(quote), quote.checklist);

  if (checklistLabel !== null) {
    return checklistLabel;
  }

  const scope = quote.scopeSummary.trim();

  if (scope.length > 0) {
    return scope.length > JOB_LABEL_MAX_LENGTH
      ? `${scope.slice(0, JOB_LABEL_MAX_LENGTH).trimEnd()}…`
      : scope;
  }

  return "Untitled quote";
}

export function inferQuoteWorkType(quote: {
  workType?: QuoteWorkType | string | null | undefined;
  jobTitle?: string | null | undefined;
  checklist: PainterChecklist;
}): QuoteWorkType {
  if (quote.workType === "exterior_trim" || quote.workType === "interior_repaint") {
    return quote.workType;
  }

  const typed = quote.jobTitle?.trim().toLowerCase() ?? "";

  if (typed.includes("exterior") || (totalCheckedRooms(quote.checklist) === 0 && quote.checklist.doorCount > 0)) {
    return "exterior_trim";
  }

  return "interior_repaint";
}

function deriveChecklistLabel(workType: QuoteWorkType, checklist: PainterChecklist): string | null {
  const rooms = totalCheckedRooms(checklist);

  if (workType === "exterior_trim") {
    return checklist.doorCount > 0
      ? `Exterior trim + ${checklist.doorCount} ${plural(checklist.doorCount, "door")}`
      : "Exterior trim";
  }

  if (rooms > 0) {
    return `Interior repaint · ${rooms} ${plural(rooms, "room")}`;
  }

  if (checklist.doorCount > 0) {
    return `Exterior trim · ${checklist.doorCount} ${plural(checklist.doorCount, "door")}`;
  }

  return null;
}

function totalCheckedRooms(checklist: PainterChecklist): number {
  return checklist.rooms.small + checklist.rooms.medium + checklist.rooms.large;
}

function plural(count: number, word: string): string {
  return count === 1 ? word : `${word}s`;
}

/**
 * Best-effort city for legacy customer records that only have a free-text
 * address. Prefer Customer.city when available.
 */
export function deriveCustomerCity(address: string): string {
  const trimmed = address.trim();

  if (trimmed.length === 0) {
    return "";
  }

  const segments = trimmed.split(",").map((segment) => segment.trim()).filter((segment) => segment.length > 0);
  const last = segments[segments.length - 1] ?? trimmed;

  if (segments.length >= 3 && looksLikeRegionOrPostal(last)) {
    return segments[segments.length - 2] ?? last;
  }

  return last;
}

function looksLikeRegionOrPostal(value: string): boolean {
  return /^(?:[a-z]{2}|[a-z]{2}\s+[a-z]\d[a-z][ -]?\d[a-z]\d|\d{5}(?:-\d{4})?|canada|usa|united states)$/i.test(value);
}
