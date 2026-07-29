import { describe, expect, it } from "vitest";
import {
  buildPainterStarterPriceBook,
  createPainterDraftLines,
  type PainterChecklist,
  type PainterPriceBookKey
} from "../src/index.js";

const checklist: PainterChecklist = {
  rooms: {
    small: 0,
    medium: 2,
    large: 0
  },
  surfaces: {
    walls: true,
    ceilings: true,
    trim: true
  },
  doorCount: 2,
  prepLevel: "normal",
  coatCount: 2,
  customerSuppliesPaint: true
};

const idMap: Record<PainterPriceBookKey, string> = {
  paint_walls: "00000000-0000-4000-8000-000000000001",
  paint_ceiling: "00000000-0000-4000-8000-000000000002",
  paint_trim: "00000000-0000-4000-8000-000000000003",
  paint_door: "00000000-0000-4000-8000-000000000004",
  heavy_wall_prep: "00000000-0000-4000-8000-000000000005",
  patch_nail_holes: "00000000-0000-4000-8000-000000000006",
  primer_coat: "00000000-0000-4000-8000-000000000007",
  material_allowance: "00000000-0000-4000-8000-000000000008"
};

describe("painter draft generation", () => {
  it("creates green checklist lines, yellow inactive starter extras, and red unknown extras", () => {
    const priceBook = buildPainterStarterPriceBook({
      orgId: "00000000-0000-4000-8000-000000000099",
      now: "2026-07-20T12:00:00.000Z",
      makeId: (key) => idMap[key],
      corePrices: {
        paintWalls: {
          small: 25000,
          medium: 42000,
          large: 65000
        },
        paintCeiling: {
          small: 12000,
          medium: 18000,
          large: 26000
        },
        paintTrim: {
          small: 9000,
          medium: 16000,
          large: 24000
        },
        paintDoorEachCents: 9500,
        heavyPrepHourlyCents: 8500
      }
    });

    const draft = createPainterDraftLines({
      checklist,
      transcript:
        "Paint two bedrooms, patch nail holes, remove the old wallpaper in the hallway, two coats, customer provides paint.",
      priceBookItems: priceBook
    });

    expect(draft.lineItems.map((line) => [line.description, line.matchState])).toEqual([
      ["Paint walls in 2 medium rooms (2 coats)", "green"],
      ["Paint ceilings in 2 medium rooms", "green"],
      ["Paint trim in 2 medium rooms", "green"],
      ["Paint 2 doors", "green"],
      ["Patch nail holes", "yellow"],
      ["Remove wallpaper", "red"]
    ]);
    expect(draft.lineItems[0]?.unitPriceCents).toBe(42000);
    expect(draft.scopeNotes).toEqual(["Customer supplies paint."]);
  });

  it("logs transcript/checklist quantity conflicts without letting transcript win", () => {
    const priceBook = buildPainterStarterPriceBook({
      orgId: "00000000-0000-4000-8000-000000000099",
      now: "2026-07-20T12:00:00.000Z",
      makeId: (key) => idMap[key],
      corePrices: {
        paintWalls: {
          small: 25000,
          medium: 42000,
          large: 65000
        },
        paintCeiling: {
          small: 12000,
          medium: 18000,
          large: 26000
        },
        paintTrim: {
          small: 9000,
          medium: 16000,
          large: 24000
        },
        paintDoorEachCents: 9500,
        heavyPrepHourlyCents: 8500
      }
    });

    const draft = createPainterDraftLines({
      checklist,
      transcript: "Paint three bedrooms with one coat.",
      priceBookItems: priceBook
    });

    expect(draft.conflicts.map((conflict) => conflict.field)).toEqual(["coatCount", "rooms"]);
  });

  it("covers every painter starter item through checklist or transcript extras", () => {
    const priceBook = buildPainterStarterPriceBook({
      orgId: "00000000-0000-4000-8000-000000000099",
      now: "2026-07-20T12:00:00.000Z",
      makeId: (key) => idMap[key],
      corePrices: {
        paintWalls: {
          small: 25000,
          medium: 42000,
          large: 65000
        },
        paintCeiling: {
          small: 12000,
          medium: 18000,
          large: 26000
        },
        paintTrim: {
          small: 9000,
          medium: 16000,
          large: 24000
        },
        paintDoorEachCents: 9500,
        heavyPrepHourlyCents: 8500
      }
    });

    const draft = createPainterDraftLines({
      checklist: {
        ...checklist,
        prepLevel: "heavy"
      },
      transcript:
        "Patch nail holes, apply primer, include a material allowance, and remove wallpaper.",
      priceBookItems: priceBook
    });

    expect(draft.lineItems.map((line) => [line.priceBookItemKey, line.matchState])).toEqual([
      ["paint_walls", "green"],
      ["paint_ceiling", "green"],
      ["paint_trim", "green"],
      ["paint_door", "green"],
      ["heavy_wall_prep", "green"],
      ["patch_nail_holes", "yellow"],
      ["primer_coat", "yellow"],
      ["material_allowance", "yellow"],
      ["remove_wallpaper", "red"]
    ]);
  });

  it("ignores spoken prices from voice notes and prices only from the price book", () => {
    const priceBook = buildPainterStarterPriceBook({
      orgId: "00000000-0000-4000-8000-000000000099",
      now: "2026-07-20T12:00:00.000Z",
      makeId: (key) => idMap[key],
      corePrices: {
        paintWalls: {
          small: 25000,
          medium: 42000,
          large: 65000
        },
        paintCeiling: {
          small: 12000,
          medium: 18000,
          large: 26000
        },
        paintTrim: {
          small: 9000,
          medium: 16000,
          large: 24000
        },
        paintDoorEachCents: 9500,
        heavyPrepHourlyCents: 8500
      }
    });

    const draft = createPainterDraftLines({
      checklist,
      transcript:
        "Also patch nail holes for 75 dollars, remove wallpaper behind the stairs for 220 dollars, and customer has paint.",
      priceBookItems: priceBook
    });

    const patchLine = draft.lineItems.find((line) => line.priceBookItemKey === "patch_nail_holes");
    const wallpaperLine = draft.lineItems.find((line) => line.priceBookItemKey === "remove_wallpaper");

    expect(patchLine?.matchState).toBe("yellow");
    expect(patchLine?.unitPriceCents).toBe(5000);
    expect(wallpaperLine?.matchState).toBe("red");
    expect(wallpaperLine?.unitPriceCents).toBeNull();
    expect(draft.lineItems.some((line) => line.unitPriceCents === 7500 || line.unitPriceCents === 22000)).toBe(false);
    expect(draft.scopeNotes).toEqual(["Customer supplies paint."]);
  });
});
