import type { lineItemKinds } from "./constants.js";
import type { DraftConflict, PainterChecklist, PriceBookItem, QuoteLineItem } from "./schemas.js";

export const painterTrade = "painting" as const;

export const painterCorePriceKeys = [
  "paint_walls",
  "paint_ceiling",
  "paint_trim",
  "paint_door",
  "heavy_wall_prep"
] as const;

export const painterStarterPriceKeys = [
  ...painterCorePriceKeys,
  "patch_nail_holes",
  "primer_coat",
  "material_allowance"
] as const;

export type PainterPriceBookKey = (typeof painterStarterPriceKeys)[number];
export type PainterLineKind = (typeof lineItemKinds)[number];

export type PainterStarterDefinition = {
  key: PainterPriceBookKey;
  name: string;
  description: string;
  unit: PriceBookItem["unit"];
  kind: PainterLineKind;
  starter: true;
  core: boolean;
  defaultPricing: PriceBookItem["pricing"];
};

export type PainterCorePriceInput = {
  paintWalls: {
    small: number;
    medium: number;
    large: number;
  };
  paintCeiling: {
    small: number;
    medium: number;
    large: number;
  };
  paintTrim: {
    small: number;
    medium: number;
    large: number;
  };
  paintDoorEachCents: number;
  heavyPrepHourlyCents: number;
};

export const painterStarterDefinitions: PainterStarterDefinition[] = [
  {
    key: "paint_walls",
    name: "Paint walls",
    description: "Wall painting priced per room size.",
    unit: "room",
    kind: "labour",
    starter: true,
    core: true,
    defaultPricing: {
      type: "room_size",
      prices: {
        small: 25000,
        medium: 40000,
        large: 60000
      }
    }
  },
  {
    key: "paint_ceiling",
    name: "Paint ceiling",
    description: "Ceiling painting priced per room size.",
    unit: "room",
    kind: "labour",
    starter: true,
    core: true,
    defaultPricing: {
      type: "room_size",
      prices: {
        small: 12000,
        medium: 18000,
        large: 26000
      }
    }
  },
  {
    key: "paint_trim",
    name: "Paint trim",
    description: "Trim painting priced per room size.",
    unit: "room",
    kind: "labour",
    starter: true,
    core: true,
    defaultPricing: {
      type: "room_size",
      prices: {
        small: 10000,
        medium: 16000,
        large: 24000
      }
    }
  },
  {
    key: "paint_door",
    name: "Paint door",
    description: "Paint a standard interior door.",
    unit: "each",
    kind: "labour",
    starter: true,
    core: true,
    defaultPricing: {
      type: "fixed",
      unitPriceCents: 9500
    }
  },
  {
    key: "heavy_wall_prep",
    name: "Heavy wall prep",
    description: "Hourly labour for heavy prep beyond standard patching.",
    unit: "hour",
    kind: "labour",
    starter: true,
    core: true,
    defaultPricing: {
      type: "fixed",
      unitPriceCents: 8500
    }
  },
  {
    key: "patch_nail_holes",
    name: "Patch nail holes",
    description: "Patch normal nail holes before painting.",
    unit: "room",
    kind: "labour",
    starter: true,
    core: false,
    defaultPricing: {
      type: "room_size",
      prices: {
        small: 3500,
        medium: 5000,
        large: 7500
      }
    }
  },
  {
    key: "primer_coat",
    name: "Primer coat",
    description: "Apply primer coat per room.",
    unit: "room",
    kind: "material",
    starter: true,
    core: false,
    defaultPricing: {
      type: "room_size",
      prices: {
        small: 8000,
        medium: 12000,
        large: 18000
      }
    }
  },
  {
    key: "material_allowance",
    name: "Material allowance",
    description: "Flat allowance for paint and standard materials.",
    unit: "flat",
    kind: "material",
    starter: true,
    core: false,
    defaultPricing: {
      type: "fixed",
      unitPriceCents: 15000
    }
  }
];

export function buildPainterStarterPriceBook(params: {
  orgId: string;
  now: string;
  makeId: (key: PainterPriceBookKey) => string;
  corePrices?: PainterCorePriceInput;
}): PriceBookItem[] {
  return painterStarterDefinitions.map((definition) => {
    const corePricing = params.corePrices ? getConfirmedCorePricing(definition.key, params.corePrices) : null;

    return {
      id: params.makeId(definition.key),
      orgId: params.orgId,
      key: definition.key,
      name: definition.name,
      description: definition.description,
      unit: definition.unit,
      pricing: corePricing ?? definition.defaultPricing,
      kind: definition.kind,
      starter: definition.starter,
      confirmedAt: definition.core && corePricing ? params.now : null,
      usageCount: 0,
      createdAt: params.now,
      updatedAt: params.now
    };
  });
}

export function createPainterDraftLines(params: {
  checklist: PainterChecklist;
  transcript: string;
  priceBookItems: PriceBookItem[];
}): {
  lineItems: QuoteLineItem[];
  conflicts: DraftConflict[];
  scopeNotes: string[];
} {
  const lines: QuoteLineItem[] = [];
  const scopeNotes: string[] = [];
  const conflicts = detectPainterChecklistConflicts(params.checklist, params.transcript);
  const lookup = new Map(params.priceBookItems.map((item) => [item.key, item]));

  for (const size of ["small", "medium", "large"] as const) {
    const roomCount = params.checklist.rooms[size];

    if (roomCount === 0) {
      continue;
    }

    if (params.checklist.surfaces.walls) {
      lines.push(
        lineFromPriceBook({
          item: lookup.get("paint_walls") ?? null,
          description: `Paint walls in ${roomCount} ${size} ${roomCount === 1 ? "room" : "rooms"} (${params.checklist.coatCount} ${params.checklist.coatCount === 1 ? "coat" : "coats"})`,
          quantity: roomCount,
          size,
          position: lines.length
        })
      );
    }

    if (params.checklist.surfaces.ceilings) {
      lines.push(
        lineFromPriceBook({
          item: lookup.get("paint_ceiling") ?? null,
          description: `Paint ceilings in ${roomCount} ${size} ${roomCount === 1 ? "room" : "rooms"}`,
          quantity: roomCount,
          size,
          position: lines.length
        })
      );
    }

    if (params.checklist.surfaces.trim) {
      lines.push(
        lineFromPriceBook({
          item: lookup.get("paint_trim") ?? null,
          description: `Paint trim in ${roomCount} ${size} ${roomCount === 1 ? "room" : "rooms"}`,
          quantity: roomCount,
          size,
          position: lines.length
        })
      );
    }
  }

  if (params.checklist.doorCount > 0) {
    lines.push(
      lineFromPriceBook({
        item: lookup.get("paint_door") ?? null,
        description: `Paint ${params.checklist.doorCount} ${params.checklist.doorCount === 1 ? "door" : "doors"}`,
        quantity: params.checklist.doorCount,
        position: lines.length
      })
    );
  }

  if (params.checklist.prepLevel === "heavy") {
    lines.push(
      lineFromPriceBook({
        item: lookup.get("heavy_wall_prep") ?? null,
        description: "Heavy wall prep",
        quantity: 1,
        position: lines.length
      })
    );
  }

  if (mentionsPatchNailHoles(params.transcript)) {
    const totalRooms = totalRoomCount(params.checklist);
    lines.push(
      lineFromPriceBook({
        item: lookup.get("patch_nail_holes") ?? null,
        description: "Patch nail holes",
        quantity: Math.max(totalRooms, 1),
        size: dominantRoomSize(params.checklist),
        position: lines.length
      })
    );
  }

  if (mentionsPrimer(params.transcript)) {
    const totalRooms = totalRoomCount(params.checklist);
    lines.push(
      lineFromPriceBook({
        item: lookup.get("primer_coat") ?? null,
        description: "Primer coat",
        quantity: Math.max(totalRooms, 1),
        size: dominantRoomSize(params.checklist),
        position: lines.length
      })
    );
  }

  if (mentionsMaterialAllowance(params.transcript)) {
    lines.push(
      lineFromPriceBook({
        item: lookup.get("material_allowance") ?? null,
        description: "Material allowance",
        quantity: 1,
        position: lines.length
      })
    );
  }

  if (mentionsWallpaperRemoval(params.transcript)) {
    lines.push({
      position: lines.length,
      description: "Remove wallpaper",
      quantity: 1,
      unit: "flat",
      unitPriceCents: null,
      kind: "labour",
      source: "manual",
      priceBookItemId: null,
      priceBookItemKey: "remove_wallpaper",
      matchConfidence: 0,
      matchState: "red"
    });
  }

  if (params.checklist.customerSuppliesPaint || mentionsCustomerSuppliesPaint(params.transcript)) {
    scopeNotes.push("Customer supplies paint.");
  }

  return {
    lineItems: lines,
    conflicts,
    scopeNotes
  };
}

export function detectPainterChecklistConflicts(
  checklist: PainterChecklist,
  transcript: string
): DraftConflict[] {
  const conflicts: DraftConflict[] = [];
  const transcriptCoats = transcript.match(/\b(one|two|1|2)\s+coats?\b/i)?.[1]?.toLowerCase();
  const transcriptCoatCount = transcriptCoats === "one" || transcriptCoats === "1" ? 1 : transcriptCoats ? 2 : null;

  if (transcriptCoatCount !== null && transcriptCoatCount !== checklist.coatCount) {
    conflicts.push({
      field: "coatCount",
      checklistValue: String(checklist.coatCount),
      transcriptValue: String(transcriptCoatCount),
      message: "Checklist coat count was used because it is the quantity source of truth."
    });
  }

  const transcriptRooms = extractRoomCount(transcript);
  const checklistRooms = totalRoomCount(checklist);

  if (transcriptRooms !== null && transcriptRooms !== checklistRooms) {
    conflicts.push({
      field: "rooms",
      checklistValue: String(checklistRooms),
      transcriptValue: String(transcriptRooms),
      message: "Checklist room count was used because it is the quantity source of truth."
    });
  }

  return conflicts;
}

export function resolvePriceForRoomSize(item: PriceBookItem, size: "small" | "medium" | "large"): number {
  if (item.pricing.type === "fixed") {
    return item.pricing.unitPriceCents;
  }

  return item.pricing.prices[size];
}

function lineFromPriceBook(params: {
  item: PriceBookItem | null;
  description: string;
  quantity: number;
  position: number;
  size?: "small" | "medium" | "large";
}): QuoteLineItem {
  if (params.item === null) {
    return {
      position: params.position,
      description: params.description,
      quantity: params.quantity,
      unit: null,
      unitPriceCents: null,
      kind: "labour",
      source: "manual",
      priceBookItemId: null,
      priceBookItemKey: null,
      matchConfidence: 0,
      matchState: "red"
    };
  }

  const unitPriceCents = resolvePriceForRoomSize(params.item, params.size ?? "medium");
  const confirmed = params.item.confirmedAt !== null;

  return {
    position: params.position,
    description: params.description,
    quantity: params.quantity,
    unit: params.item.unit,
    unitPriceCents,
    kind: params.item.kind,
    source: "price_book",
    priceBookItemId: params.item.id,
    priceBookItemKey: params.item.key,
    matchConfidence: confirmed ? 1 : 0.7,
    matchState: confirmed ? "green" : "yellow"
  };
}

function getConfirmedCorePricing(
  key: PainterPriceBookKey,
  corePrices: PainterCorePriceInput
): PriceBookItem["pricing"] | null {
  switch (key) {
    case "paint_walls":
      return {
        type: "room_size",
        prices: corePrices.paintWalls
      };
    case "paint_ceiling":
      return {
        type: "room_size",
        prices: corePrices.paintCeiling
      };
    case "paint_trim":
      return {
        type: "room_size",
        prices: corePrices.paintTrim
      };
    case "paint_door":
      return {
        type: "fixed",
        unitPriceCents: corePrices.paintDoorEachCents
      };
    case "heavy_wall_prep":
      return {
        type: "fixed",
        unitPriceCents: corePrices.heavyPrepHourlyCents
      };
    default:
      return null;
  }
}

function mentionsPatchNailHoles(transcript: string): boolean {
  return /\b(patch|fill|repair)\b.*\b(nail\s+holes?|holes?)\b/i.test(transcript);
}

function mentionsWallpaperRemoval(transcript: string): boolean {
  return /\b(remove|strip|take\s+off)\b.*\bwallpaper\b/i.test(transcript);
}

function mentionsPrimer(transcript: string): boolean {
  return /\b(primer|prime|priming)\b/i.test(transcript);
}

function mentionsMaterialAllowance(transcript: string): boolean {
  return /\b(materials?|paint)\b.*\ballowance\b/i.test(transcript) || /\ballowance\b.*\b(materials?|paint)\b/i.test(transcript);
}

function mentionsCustomerSuppliesPaint(transcript: string): boolean {
  return /\b(customer|client|homeowner)\b.*\b(supplies|provides|provided)\b.*\bpaint\b/i.test(transcript);
}

function extractRoomCount(transcript: string): number | null {
  const match = transcript.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|1|2|3|4|5|6|7|8|9|10)\s+(bedrooms?|rooms?)\b/i);

  if (!match?.[1]) {
    return null;
  }

  const normalized = match[1].toLowerCase();
  const words: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10
  };

  return words[normalized] ?? Number(normalized);
}

function totalRoomCount(checklist: PainterChecklist): number {
  return checklist.rooms.small + checklist.rooms.medium + checklist.rooms.large;
}

function dominantRoomSize(checklist: PainterChecklist): "small" | "medium" | "large" {
  if (checklist.rooms.large >= checklist.rooms.medium && checklist.rooms.large >= checklist.rooms.small) {
    return "large";
  }

  if (checklist.rooms.small > checklist.rooms.medium) {
    return "small";
  }

  return "medium";
}
