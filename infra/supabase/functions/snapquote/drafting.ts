import {
  createPainterDraftLines,
  lineFromPriceBook,
  type PainterChecklist,
  type PriceBookItem,
  type QuoteLineItem
} from "./domain.ts";

export type ScopeExtraction = {
  scope_summary: string;
  tasks: Array<{
    description: string;
    quantity: number | null;
    unit: string | null;
    kind: "labour" | "material";
    assumptions: string[];
    confidence: number;
  }>;
  site_conditions: string[];
  questions_for_contractor: string[];
};

export function buildDraftFromEvidence(params: {
  checklist: PainterChecklist;
  transcript: string;
  extraction: ScopeExtraction;
  priceBookItems: PriceBookItem[];
}) {
  const deterministic = createPainterDraftLines({
    checklist: params.checklist,
    transcript: params.transcript,
    priceBookItems: params.priceBookItems
  });
  const extractedLines = lineItemsFromExtraction({
    tasks: params.extraction.tasks,
    existingLines: deterministic.lineItems,
    priceBookItems: params.priceBookItems,
    startPosition: deterministic.lineItems.length
  });

  return {
    lineItems: [...deterministic.lineItems, ...extractedLines].map((line, position) => ({ ...line, position })),
    conflicts: deterministic.conflicts,
    scopeNotes: uniqueStrings([
      ...deterministic.scopeNotes,
      ...params.extraction.site_conditions,
      ...params.extraction.questions_for_contractor.map((question) => `Question: ${question}`)
    ])
  };
}

export function lineItemsFromExtraction(params: {
  tasks: ScopeExtraction["tasks"];
  existingLines: QuoteLineItem[];
  priceBookItems: PriceBookItem[];
  startPosition: number;
}) {
  const lines: QuoteLineItem[] = [];

  for (const task of params.tasks) {
    if (isTaskAlreadyCovered(task.description, [...params.existingLines, ...lines])) continue;

    const item = bestPriceBookMatch(task.description, params.priceBookItems);
    const quantity = task.quantity ?? 1;
    const unit = normalizeExtractedUnit(task.unit);
    const position = params.startPosition + lines.length;

    if (item) {
      lines.push(lineFromPriceBook(item, task.description, quantity, null, position, {
        scopeConfidence: task.confidence,
        requiresScopeReview: true,
        assumptions: task.assumptions,
        evidenceRefs: ["ai_text"]
      }));
      continue;
    }

    lines.push({
      position,
      description: task.description,
      quantity,
      unit,
      unitPriceCents: null,
      kind: task.kind,
      source: "manual",
      priceBookItemId: null,
      priceBookItemKey: null,
      matchConfidence: task.confidence,
      matchState: "red",
      scopeConfidence: task.confidence,
      priceConfidence: 0,
      requiresReview: true,
      assumptions: task.assumptions,
      evidenceRefs: ["ai_text"]
    });
  }

  return lines;
}

function isTaskAlreadyCovered(description: string, lines: QuoteLineItem[]) {
  const normalized = normalizeText(description);
  const buckets = [
    /paint walls?/,
    /paint ceilings?/,
    /paint trim/,
    /paint doors?/,
    /patch .*holes?/,
    /primer|prime/,
    /wallpaper/,
    /material allowance|paint.*material/
  ];

  if (buckets.some((bucket) => bucket.test(normalized) && lines.some((line) => bucket.test(normalizeText(line.description))))) {
    return true;
  }

  const taskTokens = tokenSet(description);
  return lines.some((line) => overlapScore(taskTokens, tokenSet(line.description)) >= 0.72);
}

function bestPriceBookMatch(description: string, items: PriceBookItem[]) {
  const descriptionTokens = tokenSet(description);
  let best: { item: PriceBookItem; score: number } | null = null;

  for (const item of items) {
    const score = Math.max(
      overlapScore(descriptionTokens, tokenSet(item.name)),
      overlapScore(descriptionTokens, tokenSet(item.description)),
      item.key ? overlapScore(descriptionTokens, tokenSet(item.key.replaceAll("_", " "))) : 0
    );

    if (!best || score > best.score) best = { item, score };
  }

  return best && best.score >= 0.55 ? best.item : null;
}

function normalizeExtractedUnit(unit: string | null): QuoteLineItem["unit"] {
  if (unit === "room" || unit === "each" || unit === "hour" || unit === "flat" || unit === "sqft" || unit === "lnft" || unit === "day") {
    return unit;
  }
  return "flat";
}

function tokenSet(value: string) {
  return new Set(normalizeText(value).split(" ").filter((token) => token.length >= 3));
}

function overlapScore(left: Set<string>, right: Set<string>) {
  if (left.size === 0 || right.size === 0) return 0;
  let matches = 0;
  for (const token of left) if (right.has(token)) matches += 1;
  return matches / Math.max(left.size, right.size);
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
