import { describe, expect, it } from "vitest";
import {
  buildPainterStarterPriceBook,
  createPainterDraftLines,
  type PainterPriceBookKey
} from "../src/index.js";
import { painterAccuracyFixtures } from "./fixtures/painterAccuracy.js";

const ids = new Map<string, string>();
let idSequence = 1;

function idFor(key: PainterPriceBookKey) {
  const existing = ids.get(key);
  if (existing) return existing;

  const id = `00000000-0000-4000-8000-${String(idSequence).padStart(12, "0")}`;
  idSequence += 1;
  ids.set(key, id);
  return id;
}

const priceBook = buildPainterStarterPriceBook({
  orgId: "00000000-0000-4000-8000-000000000099",
  now: "2026-09-17T12:00:00.000Z",
  makeId: idFor,
  corePrices: {
    paintWalls: { small: 25000, medium: 42000, large: 65000 },
    paintCeiling: { small: 12000, medium: 18000, large: 26000 },
    paintTrim: { small: 9000, medium: 16000, large: 24000 },
    paintDoorEachCents: 9500,
    heavyPrepHourlyCents: 8500
  }
});

describe("painter accuracy fixtures", () => {
  for (const fixture of painterAccuracyFixtures) {
    it(fixture.name, () => {
      const result = createPainterDraftLines({
        checklist: fixture.checklist,
        transcript: fixture.notes,
        priceBookItems: priceBook
      });
      const actual = result.lineItems.map((line) => ({
        key: line.priceBookItemKey ?? "unknown",
        quantity: line.quantity,
        state: line.matchState
      }));

      expect(actual).toEqual(fixture.expected);
    });
  }

  it("reports perfect baseline task precision and recall", () => {
    let expectedCount = 0;
    let actualCount = 0;
    let matchedCount = 0;

    for (const fixture of painterAccuracyFixtures) {
      const result = createPainterDraftLines({
        checklist: fixture.checklist,
        transcript: fixture.notes,
        priceBookItems: priceBook
      });
      const remaining = [...fixture.expected];
      expectedCount += remaining.length;
      actualCount += result.lineItems.length;

      for (const line of result.lineItems) {
        const index = remaining.findIndex((expected) =>
          expected.key === (line.priceBookItemKey ?? "unknown") && expected.quantity === line.quantity
        );
        if (index >= 0) {
          matchedCount += 1;
          remaining.splice(index, 1);
        }
      }
    }

    expect(matchedCount / actualCount).toBe(1);
    expect(matchedCount / expectedCount).toBe(1);
  });

  it("keeps note-derived scope under review even when its price is confirmed", () => {
    const confirmedPriceBook = priceBook.map((item) =>
      item.key === "patch_nail_holes"
        ? { ...item, confirmedAt: "2026-09-17T12:00:00.000Z" }
        : item
    );
    const fixture = painterAccuracyFixtures.find((candidate) => candidate.name === "patch nail holes in two rooms");
    expect(fixture).toBeDefined();

    const result = createPainterDraftLines({
      checklist: fixture!.checklist,
      transcript: fixture!.notes,
      priceBookItems: confirmedPriceBook
    });
    const patchLine = result.lineItems.find((line) => line.priceBookItemKey === "patch_nail_holes");

    expect(patchLine).toMatchObject({
      matchState: "yellow",
      priceConfidence: 1,
      requiresReview: true,
      scopeConfidence: 0.85
    });
  });

  it("does not silently use a medium-room price when room size is unknown", () => {
    const result = createPainterDraftLines({
      checklist: {
        rooms: { small: 0, medium: 0, large: 0 },
        surfaces: { walls: false, ceilings: false, trim: false },
        doorCount: 0,
        prepLevel: "normal",
        coatCount: 2,
        customerSuppliesPaint: true
      },
      transcript: "Please patch the nail holes.",
      priceBookItems: priceBook
    });
    const patchLine = result.lineItems.find((line) => line.priceBookItemKey === "patch_nail_holes");

    expect(patchLine).toMatchObject({
      matchState: "red",
      unitPriceCents: null,
      requiresReview: true
    });
  });
});
