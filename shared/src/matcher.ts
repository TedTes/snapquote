import { DEFAULT_MATCH_AUTO_THRESHOLD, DEFAULT_MATCH_SUGGEST_THRESHOLD } from "./constants.js";
import type { PriceBookItem } from "./schemas.js";

export type MatchDecision = "green" | "yellow" | "red";

export type MatchResult = {
  decision: MatchDecision;
  confidence: number;
  item: PriceBookItem | null;
};

export function classifyMatchConfidence(
  confidence: number,
  itemConfirmed: boolean,
  thresholds = {
    auto: DEFAULT_MATCH_AUTO_THRESHOLD,
    suggest: DEFAULT_MATCH_SUGGEST_THRESHOLD
  }
): MatchDecision {
  if (confidence >= thresholds.auto && itemConfirmed) {
    return "green";
  }

  if (confidence >= thresholds.suggest) {
    return "yellow";
  }

  return "red";
}

export function matchTextToPriceBookItem(
  text: string,
  items: PriceBookItem[],
  thresholds?: {
    auto: number;
    suggest: number;
  }
): MatchResult {
  const activeItems = items.filter((item) => item.confirmedAt !== null || item.starter);
  const candidates = activeItems.map((item) => ({
    item,
    confidence: scoreTextMatch(text, [item.name, item.description, item.key ?? ""].join(" "))
  }));
  const best = candidates.sort((a, b) => b.confidence - a.confidence)[0];

  if (!best) {
    return {
      decision: "red",
      confidence: 0,
      item: null
    };
  }

  return {
    decision: classifyMatchConfidence(best.confidence, best.item.confirmedAt !== null, thresholds),
    confidence: best.confidence,
    item: best.item
  };
}

export function scoreTextMatch(left: string, right: string): number {
  const leftTokens = tokenize(left);
  const rightTokens = tokenize(right);

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;

  return intersection / union;
}

function tokenize(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2)
  );
}
