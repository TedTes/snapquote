import { describe, expect, it } from "vitest";
import { buildPainterStarterPriceBook, type PainterPriceBookKey } from "../src/index.js";
import { buildDraftFromEvidence } from "../../infra/supabase/functions/snapquote/drafting.ts";

const priceBook = buildPainterStarterPriceBook({
  orgId: "00000000-0000-4000-8000-000000000099",
  now: "2026-09-17T12:00:00.000Z",
  makeId: (key: PainterPriceBookKey) => `00000000-0000-4000-8000-${String(key.length).padStart(12, "0")}`,
  corePrices: {
    paintWalls: { small: 25000, medium: 42000, large: 65000 },
    paintCeiling: { small: 12000, medium: 18000, large: 26000 },
    paintTrim: { small: 9000, medium: 16000, large: 24000 },
    paintDoorEachCents: 9500,
    heavyPrepHourlyCents: 8500
  }
});

const checklist = {
  rooms: { small: 0, medium: 1, large: 0 },
  surfaces: { walls: true, ceilings: false, trim: false },
  doorCount: 0,
  prepLevel: "normal" as const,
  coatCount: 2 as const,
  customerSuppliesPaint: true
};

describe("backend draft evidence builder", () => {
  it("deduplicates extracted checklist work and preserves unsupported tasks for review", () => {
    const result = buildDraftFromEvidence({
      checklist,
      transcript: "Remove wallpaper before painting.",
      priceBookItems: priceBook,
      extraction: {
        scope_summary: "Paint one room after wallpaper removal.",
        tasks: [
          { description: "Paint walls", quantity: 1, unit: "room", kind: "labour", assumptions: [], confidence: 0.96 },
          { description: "Remove wallpaper", quantity: null, unit: null, kind: "labour", assumptions: ["Area is not measured."], confidence: 0.74 }
        ],
        site_conditions: ["Wallpaper is present."],
        questions_for_contractor: ["Confirm the wallpaper area."]
      }
    });

    expect(result.lineItems.map((line) => line.description)).toEqual([
      "Paint walls in 1 medium room (2 coats)",
      "Remove wallpaper"
    ]);
    expect(result.lineItems[1]).toMatchObject({
      matchState: "red",
      requiresReview: true,
      scopeConfidence: 0.78
    });
    expect(result.scopeNotes).toContain("Question: Confirm the wallpaper area.");
  });

  it("keeps an AI-inferred fixed-price match under scope review", () => {
    const result = buildDraftFromEvidence({
      checklist,
      transcript: "Also paint one door.",
      priceBookItems: priceBook,
      extraction: {
        scope_summary: "Paint one room and one door.",
        tasks: [
          { description: "Paint door", quantity: 1, unit: "each", kind: "labour", assumptions: ["One door was stated."], confidence: 0.88 }
        ],
        site_conditions: [],
        questions_for_contractor: []
      }
    });
    const door = result.lineItems.find((line) => line.priceBookItemKey === "paint_door");

    expect(door).toMatchObject({
      unitPriceCents: 9500,
      matchState: "yellow",
      priceConfidence: 1,
      scopeConfidence: 0.88,
      requiresReview: true
    });
  });
});
