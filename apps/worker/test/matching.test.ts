import { describe, expect, it } from "vitest";
import { classifyPriceBookMatch } from "../src/pipeline.js";

describe("classifyPriceBookMatch", () => {
  it("uses the spec thresholds", () => {
    expect(classifyPriceBookMatch(0.8)).toBe("auto_attach");
    expect(classifyPriceBookMatch(0.6)).toBe("confirm_suggestion");
    expect(classifyPriceBookMatch(0.59)).toBe("needs_price");
  });
});
