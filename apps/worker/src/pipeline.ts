import {
  DEFAULT_MATCH_AUTO_THRESHOLD,
  DEFAULT_MATCH_SUGGEST_THRESHOLD,
  extractionResultSchema,
  type ExtractionResult
} from "@snapquote/shared";

export type ProcessJobPayload = {
  jobId: string;
  orgId: string;
};

export type MatchDecision = "auto_attach" | "confirm_suggestion" | "needs_price";

export function classifyPriceBookMatch(
  confidence: number,
  thresholds = {
    auto: DEFAULT_MATCH_AUTO_THRESHOLD,
    suggest: DEFAULT_MATCH_SUGGEST_THRESHOLD
  }
): MatchDecision {
  if (confidence >= thresholds.auto) {
    return "auto_attach";
  }

  if (confidence >= thresholds.suggest) {
    return "confirm_suggestion";
  }

  return "needs_price";
}

export function processJob(payload: ProcessJobPayload): {
  jobId: string;
  status: "drafted";
  extraction: ExtractionResult;
} {
  const extraction = extractionResultSchema.parse({
    scope_summary: "Manual quote draft placeholder until providers are wired.",
    tasks: [],
    site_conditions: [],
    questions_for_contractor: []
  });

  return {
    jobId: payload.jobId,
    status: "drafted",
    extraction
  };
}
