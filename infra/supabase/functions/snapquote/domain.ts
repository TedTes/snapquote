export type QuoteStatus = "draft" | "sent" | "viewed" | "accepted" | "declined" | "expired" | "superseded";
export type QuoteUnit = "room" | "each" | "hour" | "flat" | "sqft" | "lnft" | "day";
export type LineKind = "labour" | "material";
export type LineSource = "price_book" | "manual";
export type MatchState = "green" | "yellow" | "red";

export type PriceBookPricing =
  | { type: "fixed"; unitPriceCents: number }
  | { type: "room_size"; prices: { small: number; medium: number; large: number } };

export type PriceBookItem = {
  id: string;
  orgId: string;
  key: string | null;
  name: string;
  description: string;
  unit: QuoteUnit;
  pricing: PriceBookPricing;
  kind: LineKind;
  starter: boolean;
  confirmedAt: string | null;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
};

export type PricingRegion = {
  id: string;
  key: string;
  countryCode: string | null;
  regionCode: string | null;
  metroName: string | null;
  currency: string;
  laborMultiplier: number;
  materialMultiplier: number;
  confidence: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PricingVersion = {
  id: string;
  key: string;
  trade: string;
  status: "draft" | "reviewed" | "published" | "retired";
  formulaVersion: string;
  publishedAt: string | null;
  sourceSnapshot: Record<string, unknown>;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type ServiceTemplate = {
  id: string;
  trade: string;
  key: string;
  name: string;
  description: string;
  unit: QuoteUnit;
  kind: LineKind;
  defaultPricingType: "fixed" | "room_size";
  aliases: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ServicePriceSuggestion = {
  id: string;
  versionId: string;
  serviceTemplateId: string;
  regionId: string;
  trade: string;
  templateKey: string;
  name: string;
  description: string;
  unit: QuoteUnit;
  kind: LineKind;
  pricingType: "fixed" | "room_size";
  lowCents: number;
  medianCents: number;
  highCents: number;
  pricing: PriceBookPricing;
  currency: string;
  confidence: number;
  regionKey: string;
  versionKey: string;
  formulaVersion: string;
  publishedAt: string | null;
  provenance: Record<string, unknown>;
};

export type PainterChecklist = {
  rooms: { small: number; medium: number; large: number };
  surfaces: { walls: boolean; ceilings: boolean; trim: boolean };
  doorCount: number;
  prepLevel: "light" | "normal" | "heavy";
  coatCount: 1 | 2;
  customerSuppliesPaint: boolean;
};

export type DraftConflict = {
  field: string;
  checklistValue: string;
  transcriptValue: string;
  message: string;
};

export type QuoteLineItem = {
  id?: string;
  position: number;
  description: string;
  quantity: number;
  unit: QuoteUnit | null;
  unitPriceCents: number | null;
  kind: LineKind;
  source: LineSource;
  priceBookItemId: string | null;
  priceBookItemKey?: string | null;
  matchConfidence: number | null;
  matchState: MatchState;
};

export type QuoteDiscount =
  | { type: "none"; value: 0 }
  | { type: "percent"; value: number }
  | { type: "cents"; value: number };

export type QuoteTotals = {
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
};

export type QuoteEvent = {
  id: string;
  quoteId: string;
  type:
    | "created"
    | "sent"
    | "viewed"
    | "accepted"
    | "declined"
    | "expired"
    | "followed_up"
    | "customer_replied"
    | "superseded"
    | "payment_started"
    | "payment_paid"
    | "payment_failed"
    | "archived";
  meta: Record<string, unknown>;
  createdAt: string;
};

export type PriceBookRow = {
  id: string;
  org_id: string;
  key: string | null;
  name: string;
  description: string;
  unit: QuoteUnit;
  pricing_type: "fixed" | "room_size";
  unit_price_cents: number | null;
  small_price_cents: number | null;
  medium_price_cents: number | null;
  large_price_cents: number | null;
  kind: LineKind;
  starter: boolean;
  confirmed_at: string | null;
  usage_count: number;
  created_at: string;
  updated_at: string;
};

export type PricingRegionRow = {
  id: string;
  key: string;
  country_code: string | null;
  region_code: string | null;
  metro_name: string | null;
  currency: string;
  labor_multiplier: number | string;
  material_multiplier: number | string;
  confidence: number | string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type PricingVersionRow = {
  id: string;
  key: string;
  trade: string;
  status: "draft" | "reviewed" | "published" | "retired";
  formula_version: string;
  published_at: string | null;
  source_snapshot: Record<string, unknown>;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type ServiceTemplateRow = {
  id: string;
  trade: string;
  key: string;
  name: string;
  description: string;
  unit: QuoteUnit;
  kind: LineKind;
  default_pricing_type: "fixed" | "room_size";
  aliases: string[];
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type ServicePriceSuggestionRow = {
  id: string;
  version_id: string;
  service_template_id: string;
  region_id: string;
  unit: QuoteUnit;
  pricing_type: "fixed" | "room_size";
  low_cents: number;
  median_cents: number;
  high_cents: number;
  pricing: PriceBookPricing;
  currency: string;
  confidence: number | string;
  provenance: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type QuoteRow = {
  id: string;
  org_id: string;
  customer_id: string;
  address: string;
  job_title: string;
  status: QuoteStatus;
  valid_until: string;
  discount_type: QuoteDiscount["type"];
  discount_value: number;
  tax_rate: number;
  subtotal_cents: number | null;
  discount_cents: number | null;
  tax_cents: number | null;
  total_cents: number | null;
  notes: string;
  terms: string;
  scope_summary: string;
  scope_notes: string[];
  conflicts: DraftConflict[];
  checklist: PainterChecklist;
  transcript: string;
  audio_storage_path: string | null;
  audio_content_type: string | null;
  audio_duration_seconds: number | null;
  sent_at: string | null;
  first_viewed_at: string | null;
  responded_at: string | null;
  superseded_by_quote_id: string | null;
  payment_status: "not_requested" | "checkout_created" | "paid" | "failed" | "refunded";
  deposit_percent: number;
  deposit_amount_cents: number | null;
  paid_amount_cents: number;
  payment_currency: string;
  paid_at: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type LineRow = {
  id: string;
  quote_id: string;
  position: number;
  description: string;
  quantity: number;
  unit: QuoteUnit | null;
  unit_price_cents: number | null;
  kind: LineKind;
  source: LineSource;
  price_book_item_id: string | null;
  price_book_item_key: string | null;
  match_confidence: number | null;
  match_state: MatchState;
  created_at: string;
  updated_at: string;
};

export const defaultChecklist: PainterChecklist = {
  rooms: { small: 0, medium: 2, large: 0 },
  surfaces: { walls: true, ceilings: true, trim: true },
  doorCount: 2,
  prepLevel: "normal",
  coatCount: 2,
  customerSuppliesPaint: true
};

export const defaultCorePrices = {
  paintWalls: { small: 25000, medium: 42000, large: 65000 },
  paintCeiling: { small: 12000, medium: 18000, large: 26000 },
  paintTrim: { small: 9000, medium: 16000, large: 24000 },
  paintDoorEachCents: 9500,
  heavyPrepHourlyCents: 8500
};

export const starterDefinitions = [
  roomSizeStarter("paint_walls", "Paint walls", "Wall painting priced per room size.", "labour", true, defaultCorePrices.paintWalls),
  roomSizeStarter("paint_ceiling", "Paint ceiling", "Ceiling painting priced per room size.", "labour", true, defaultCorePrices.paintCeiling),
  roomSizeStarter("paint_trim", "Paint trim", "Trim painting priced per room size.", "labour", true, defaultCorePrices.paintTrim),
  fixedStarter("paint_door", "Paint door", "Paint a standard interior door.", "each", "labour", true, defaultCorePrices.paintDoorEachCents),
  fixedStarter("heavy_wall_prep", "Heavy wall prep", "Hourly labour for heavy prep beyond standard patching.", "hour", "labour", true, defaultCorePrices.heavyPrepHourlyCents),
  roomSizeStarter("patch_nail_holes", "Patch nail holes", "Patch normal nail holes before painting.", "labour", false, { small: 3500, medium: 5000, large: 7500 }),
  roomSizeStarter("primer_coat", "Primer coat", "Apply primer coat per room.", "material", false, { small: 8000, medium: 12000, large: 18000 }),
  fixedStarter("material_allowance", "Material allowance", "Flat allowance for paint and standard materials.", "flat", "material", false, 15000)
] as const;

export function priceBookItemFromRow(row: PriceBookRow): PriceBookItem {
  return {
    id: row.id,
    orgId: row.org_id,
    key: row.key,
    name: row.name,
    description: row.description,
    unit: row.unit,
    pricing:
      row.pricing_type === "fixed"
        ? { type: "fixed", unitPriceCents: row.unit_price_cents ?? 0 }
        : {
            type: "room_size",
            prices: {
              small: row.small_price_cents ?? 0,
              medium: row.medium_price_cents ?? 0,
              large: row.large_price_cents ?? 0
            }
          },
    kind: row.kind,
    starter: row.starter,
    confirmedAt: row.confirmed_at,
    usageCount: row.usage_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function priceBookInsert(item: Omit<PriceBookItem, "id" | "createdAt" | "updatedAt">) {
  const pricing =
    item.pricing.type === "fixed"
      ? {
          pricing_type: "fixed",
          unit_price_cents: item.pricing.unitPriceCents,
          small_price_cents: null,
          medium_price_cents: null,
          large_price_cents: null
        }
      : {
          pricing_type: "room_size",
          unit_price_cents: null,
          small_price_cents: item.pricing.prices.small,
          medium_price_cents: item.pricing.prices.medium,
          large_price_cents: item.pricing.prices.large
        };

  return {
    org_id: item.orgId,
    key: item.key,
    name: item.name,
    description: item.description,
    unit: item.unit,
    kind: item.kind,
    starter: item.starter,
    confirmed_at: item.confirmedAt,
    usage_count: item.usageCount,
    ...pricing
  };
}

export function pricingRegionFromRow(row: PricingRegionRow): PricingRegion {
  return {
    id: row.id,
    key: row.key,
    countryCode: row.country_code,
    regionCode: row.region_code,
    metroName: row.metro_name,
    currency: row.currency,
    laborMultiplier: Number(row.labor_multiplier),
    materialMultiplier: Number(row.material_multiplier),
    confidence: Number(row.confidence),
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function pricingVersionFromRow(row: PricingVersionRow): PricingVersion {
  return {
    id: row.id,
    key: row.key,
    trade: row.trade,
    status: row.status,
    formulaVersion: row.formula_version,
    publishedAt: row.published_at,
    sourceSnapshot: row.source_snapshot,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function serviceTemplateFromRow(row: ServiceTemplateRow): ServiceTemplate {
  return {
    id: row.id,
    trade: row.trade,
    key: row.key,
    name: row.name,
    description: row.description,
    unit: row.unit,
    kind: row.kind,
    defaultPricingType: row.default_pricing_type,
    aliases: row.aliases,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function servicePriceSuggestionFromRows(
  row: ServicePriceSuggestionRow,
  template: ServiceTemplateRow,
  region: PricingRegionRow,
  version: PricingVersionRow
): ServicePriceSuggestion {
  return {
    id: row.id,
    versionId: row.version_id,
    serviceTemplateId: row.service_template_id,
    regionId: row.region_id,
    trade: template.trade,
    templateKey: template.key,
    name: template.name,
    description: template.description,
    unit: row.unit,
    kind: template.kind,
    pricingType: row.pricing_type,
    lowCents: row.low_cents,
    medianCents: row.median_cents,
    highCents: row.high_cents,
    pricing: row.pricing,
    currency: row.currency,
    confidence: Number(row.confidence),
    regionKey: region.key,
    versionKey: version.key,
    formulaVersion: version.formula_version,
    publishedAt: version.published_at,
    provenance: row.provenance
  };
}

export function quoteLineFromRow(row: LineRow): QuoteLineItem & { id: string } {
  return {
    id: row.id,
    position: row.position,
    description: row.description,
    quantity: Number(row.quantity),
    unit: row.unit,
    unitPriceCents: row.unit_price_cents,
    kind: row.kind,
    source: row.source,
    priceBookItemId: row.price_book_item_id,
    priceBookItemKey: row.price_book_item_key,
    matchConfidence: row.match_confidence,
    matchState: row.match_state
  };
}

export function lineInsert(quoteId: string, line: QuoteLineItem) {
  return {
    quote_id: quoteId,
    position: line.position,
    description: line.description,
    quantity: line.quantity,
    unit: line.unit,
    unit_price_cents: line.unitPriceCents,
    kind: line.kind,
    source: line.source,
    price_book_item_id: line.priceBookItemId,
    price_book_item_key: line.priceBookItemKey ?? null,
    match_confidence: line.matchConfidence,
    match_state: line.matchState
  };
}

export function computeQuoteTotals(input: {
  lineItems: QuoteLineItem[];
  discount: QuoteDiscount;
  taxRate: number;
}): QuoteTotals {
  const subtotalCents = input.lineItems.reduce((sum, item) => {
    if (item.matchState !== "green" || item.unitPriceCents === null) {
      throw new Error("Cannot compute quote totals while line items are unpriced or unconfirmed");
    }

    return sum + Math.round(item.quantity * item.unitPriceCents);
  }, 0);
  const discountCents =
    input.discount.type === "percent"
      ? Math.round(subtotalCents * (input.discount.value / 100))
      : input.discount.type === "cents"
        ? Math.min(input.discount.value, subtotalCents)
        : 0;
  const taxableCents = Math.max(0, subtotalCents - discountCents);
  const taxCents = Math.round(taxableCents * input.taxRate);

  return {
    subtotalCents,
    discountCents,
    taxCents,
    totalCents: taxableCents + taxCents
  };
}

export function getQuoteSendBlockers(lineItems: QuoteLineItem[]) {
  const redCount = lineItems.filter((line) => line.matchState === "red").length;
  const yellowCount = lineItems.filter((line) => line.matchState === "yellow").length;
  const reasons: string[] = [];

  if (redCount > 0) {
    reasons.push(`${redCount} line${redCount === 1 ? "" : "s"} need a price`);
  }

  if (yellowCount > 0) {
    reasons.push(`${yellowCount} suggested price${yellowCount === 1 ? "" : "s"} need confirmation`);
  }

  return { redCount, yellowCount, reasons };
}

export function computeTotalsIfReady(params: {
  lineItems: QuoteLineItem[];
  discount: QuoteDiscount;
  taxRate: number;
}): QuoteTotals | null {
  if (getQuoteSendBlockers(params.lineItems).reasons.length > 0) {
    return null;
  }

  return computeQuoteTotals(params);
}

export function assertQuoteCanSend(lineItems: QuoteLineItem[]): void {
  const blockers = getQuoteSendBlockers(lineItems);

  if (blockers.reasons.length > 0) {
    throw new Error(blockers.reasons.join("; "));
  }
}

export function deriveQuoteStatus(params: {
  events: { type: QuoteEvent["type"]; createdAt: string }[];
  validUntil: string;
  now: Date;
  supersededByQuoteId?: string | null;
}): QuoteStatus {
  if (params.supersededByQuoteId) {
    return "superseded";
  }

  if (params.events.some((event) => event.type === "accepted")) {
    return "accepted";
  }

  if (params.events.some((event) => event.type === "declined")) {
    return "declined";
  }

  const hasSent = params.events.some((event) => event.type === "sent");

  if (hasSent && params.now > endOfDate(params.validUntil)) {
    return "expired";
  }

  if (params.events.some((event) => event.type === "viewed")) {
    return "viewed";
  }

  return hasSent ? "sent" : "draft";
}

export function isQuoteStale(params: {
  sentAt: string | null;
  firstViewedAt: string | null;
  respondedAt: string | null;
  now: Date;
}) {
  if (params.sentAt === null || params.respondedAt !== null) {
    return false;
  }

  const sentAt = new Date(params.sentAt);
  const basis = params.firstViewedAt ? new Date(params.firstViewedAt) : sentAt;
  const staleAfter = new Date(basis);
  staleAfter.setDate(staleAfter.getDate() + 3);
  return params.now >= staleAfter;
}

export function createPainterDraftLines(params: {
  checklist: PainterChecklist;
  transcript: string;
  priceBookItems: PriceBookItem[];
}): { lineItems: QuoteLineItem[]; conflicts: DraftConflict[]; scopeNotes: string[] } {
  const lines: QuoteLineItem[] = [];
  const scopeNotes: string[] = [];
  const conflicts = detectConflicts(params.checklist, params.transcript);
  const lookup = new Map(params.priceBookItems.map((item) => [item.key, item]));

  for (const size of ["small", "medium", "large"] as const) {
    const roomCount = params.checklist.rooms[size];

    if (roomCount === 0) {
      continue;
    }

    if (params.checklist.surfaces.walls) {
      lines.push(lineFromPriceBook(lookup.get("paint_walls") ?? null, `Paint walls in ${roomCount} ${size} ${plural(roomCount, "room")} (${params.checklist.coatCount} ${plural(params.checklist.coatCount, "coat")})`, roomCount, size, lines.length));
    }

    if (params.checklist.surfaces.ceilings) {
      lines.push(lineFromPriceBook(lookup.get("paint_ceiling") ?? null, `Paint ceilings in ${roomCount} ${size} ${plural(roomCount, "room")}`, roomCount, size, lines.length));
    }

    if (params.checklist.surfaces.trim) {
      lines.push(lineFromPriceBook(lookup.get("paint_trim") ?? null, `Paint trim in ${roomCount} ${size} ${plural(roomCount, "room")}`, roomCount, size, lines.length));
    }
  }

  if (params.checklist.doorCount > 0) {
    lines.push(lineFromPriceBook(lookup.get("paint_door") ?? null, `Paint ${params.checklist.doorCount} ${plural(params.checklist.doorCount, "door")}`, params.checklist.doorCount, null, lines.length));
  }

  if (params.checklist.prepLevel === "heavy") {
    lines.push(lineFromPriceBook(lookup.get("heavy_wall_prep") ?? null, "Heavy wall prep", 2, null, lines.length));
  }

  if (mentions(params.transcript, ["patch", "nail hole", "holes"])) {
    const rooms = totalRooms(params.checklist) || 1;
    lines.push(lineFromPriceBook(lookup.get("patch_nail_holes") ?? null, "Patch nail holes", rooms, "medium", lines.length));
  }

  if (mentions(params.transcript, ["primer", "prime"])) {
    const rooms = totalRooms(params.checklist) || 1;
    lines.push(lineFromPriceBook(lookup.get("primer_coat") ?? null, "Primer coat", rooms, "medium", lines.length));
  }

  if (!params.checklist.customerSuppliesPaint) {
    lines.push(lineFromPriceBook(lookup.get("material_allowance") ?? null, "Material allowance", 1, null, lines.length));
  } else {
    scopeNotes.push("Customer supplies paint.");
  }

  if (mentions(params.transcript, ["wallpaper"])) {
    lines.push({
      position: lines.length,
      description: "Remove wallpaper",
      quantity: 1,
      unit: "flat",
      unitPriceCents: null,
      kind: "labour",
      source: "manual",
      priceBookItemId: null,
      priceBookItemKey: null,
      matchConfidence: null,
      matchState: "red"
    });
  }

  return { lineItems: lines, conflicts, scopeNotes };
}

export function buildScopeSummary(customerName: string, checklist: PainterChecklist, scopeNotes: string[]) {
  const rooms = totalRooms(checklist);
  const surfaces = [
    checklist.surfaces.walls ? "walls" : null,
    checklist.surfaces.ceilings ? "ceilings" : null,
    checklist.surfaces.trim ? "trim" : null
  ].filter(Boolean);

  return [
    `${customerName}: ${rooms} ${plural(rooms, "room")} · ${surfaces.join(", ") || "no surfaces selected"}`,
    `${checklist.coatCount} ${plural(checklist.coatCount, "coat")}`,
    checklist.doorCount > 0 ? `${checklist.doorCount} ${plural(checklist.doorCount, "door")}` : null,
    ...scopeNotes
  ].filter(Boolean).join(" · ");
}

export function toDiscount(type: QuoteDiscount["type"], value: number): QuoteDiscount {
  if (type === "percent") {
    return { type, value };
  }

  if (type === "cents") {
    return { type, value };
  }

  return { type: "none", value: 0 };
}

export function totalsColumns(totals: QuoteTotals | null) {
  return {
    subtotal_cents: totals?.subtotalCents ?? null,
    discount_cents: totals?.discountCents ?? null,
    tax_cents: totals?.taxCents ?? null,
    total_cents: totals?.totalCents ?? null
  };
}

export function publicToken() {
  return crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
}

export function lineFromPriceBook(
  item: PriceBookItem | null,
  description: string,
  quantity: number,
  roomSize: "small" | "medium" | "large" | null,
  position: number
): QuoteLineItem {
  if (item === null) {
    return {
      position,
      description,
      quantity,
      unit: "flat",
      unitPriceCents: null,
      kind: "labour",
      source: "manual",
      priceBookItemId: null,
      priceBookItemKey: null,
      matchConfidence: null,
      matchState: "red"
    };
  }

  const confirmed = item.confirmedAt !== null;
  const unitPriceCents =
    item.pricing.type === "room_size"
      ? item.pricing.prices[roomSize ?? "medium"]
      : item.pricing.unitPriceCents;

  return {
    position,
    description,
    quantity,
    unit: item.unit,
    unitPriceCents,
    kind: item.kind,
    source: "price_book",
    priceBookItemId: item.id,
    priceBookItemKey: item.key,
    matchConfidence: confirmed ? 1 : 0.7,
    matchState: confirmed ? "green" : "yellow"
  };
}

function fixedStarter(key: string, name: string, description: string, unit: QuoteUnit, kind: LineKind, core: boolean, price: number) {
  return {
    key,
    name,
    description,
    unit,
    kind,
    core,
    pricing: { type: "fixed", unitPriceCents: price } as PriceBookPricing
  };
}

function roomSizeStarter(key: string, name: string, description: string, kind: LineKind, core: boolean, prices: { small: number; medium: number; large: number }) {
  return {
    key,
    name,
    description,
    unit: "room" as QuoteUnit,
    kind,
    core,
    pricing: { type: "room_size", prices } as PriceBookPricing
  };
}

function detectConflicts(checklist: PainterChecklist, transcript: string): DraftConflict[] {
  const conflicts: DraftConflict[] = [];
  const lower = transcript.toLowerCase();

  if (checklist.coatCount === 1 && lower.includes("two coat")) {
    conflicts.push({
      field: "coatCount",
      checklistValue: "1 coat",
      transcriptValue: "two coats",
      message: "Checklist coat count was used because it is the quantity source of truth."
    });
  }

  if (checklist.coatCount === 2 && lower.includes("one coat")) {
    conflicts.push({
      field: "coatCount",
      checklistValue: "2 coats",
      transcriptValue: "one coat",
      message: "Checklist coat count was used because it is the quantity source of truth."
    });
  }

  return conflicts;
}

function mentions(text: string, terms: string[]) {
  const lower = text.toLowerCase();
  return terms.some((term) => lower.includes(term));
}

function totalRooms(checklist: PainterChecklist) {
  return checklist.rooms.small + checklist.rooms.medium + checklist.rooms.large;
}

function plural(count: number, noun: string) {
  return count === 1 ? noun : `${noun}s`;
}

function endOfDate(date: string) {
  return new Date(`${date}T23:59:59.999Z`);
}
