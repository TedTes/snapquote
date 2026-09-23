import { describe, expect, it } from "vitest";
import {
  aggregateSuggestionMetrics,
  type AnalysisRequestMetricRow,
  type SuggestionMetricRow
} from "../../infra/supabase/functions/snapquote/suggestionMetrics.ts";

const now = new Date("2026-09-22T12:00:00.000Z");

function suggestion(overrides: Partial<SuggestionMetricRow> = {}): SuggestionMetricRow {
  return {
    id: crypto.randomUUID(),
    request_id: "request-1",
    suggestion_type: "task",
    description: "Paint walls",
    confidence: 0.84,
    status: "pending",
    created_at: "2026-09-20T10:00:00.000Z",
    decided_at: null,
    ...overrides
  };
}

function analysisRequest(overrides: Partial<AnalysisRequestMetricRow> = {}): AnalysisRequestMetricRow {
  return {
    id: crypto.randomUUID(),
    analysis_status: "completed",
    analysis_model: "gpt-test",
    analysis_version: "v1",
    analysis_started_at: "2026-09-20T10:00:00.000Z",
    analysis_completed_at: "2026-09-20T10:01:00.000Z",
    created_at: "2026-09-20T09:00:00.000Z",
    ...overrides
  };
}

describe("suggestion metrics", () => {
  it("uses only accepted and rejected suggestions in the acceptance rate", () => {
    const result = aggregateSuggestionMetrics({
      now,
      period: "30d",
      suggestions: [
        suggestion({ status: "accepted", decided_at: "2026-09-20T12:00:00.000Z" }),
        suggestion({ status: "rejected", decided_at: "2026-09-21T12:00:00.000Z" }),
        suggestion()
      ],
      requests: []
    });

    expect(result.totals).toMatchObject({ generated: 3, pending: 1, reviewed: 2, accepted: 1, rejected: 1 });
    expect(result.totals.acceptanceRate).toBe(0.5);
  });

  it("returns null rates when nothing has been reviewed or attempted", () => {
    const result = aggregateSuggestionMetrics({ now, period: "30d", suggestions: [], requests: [] });

    expect(result.totals.acceptanceRate).toBeNull();
    expect(result.totals.completionRate).toBeNull();
    expect(result.totals.medianDecisionHours).toBeNull();
  });

  it("applies period boundaries independently to generation and decisions", () => {
    const result = aggregateSuggestionMetrics({
      now,
      period: "7d",
      suggestions: [
        suggestion({
          created_at: "2026-08-01T10:00:00.000Z",
          status: "accepted",
          decided_at: "2026-09-20T10:00:00.000Z"
        }),
        suggestion({ created_at: "2026-08-01T10:00:00.000Z" })
      ],
      requests: []
    });

    expect(result.totals.generated).toBe(0);
    expect(result.totals.reviewed).toBe(1);
    expect(result.totals.accepted).toBe(1);
  });

  it("breaks decisions down by suggestion type and calibrated confidence", () => {
    const result = aggregateSuggestionMetrics({
      now,
      period: "all",
      suggestions: [
        suggestion({ status: "accepted", confidence: 0.91, decided_at: "2026-09-20T12:00:00.000Z" }),
        suggestion({ status: "rejected", confidence: 0.7, suggestion_type: "question", decided_at: "2026-09-20T13:00:00.000Z" }),
        suggestion({ status: "rejected", confidence: 0.4, suggestion_type: "question", decided_at: "2026-09-20T14:00:00.000Z" })
      ],
      requests: []
    });

    expect(result.byType.find((row) => row.type === "task")?.acceptanceRate).toBe(1);
    expect(result.byType.find((row) => row.type === "question")?.acceptanceRate).toBe(0);
    expect(result.confidenceBands.map((row) => row.reviewed)).toEqual([1, 1, 1]);
  });

  it("reports median decision time, rejection patterns, and model completion", () => {
    const result = aggregateSuggestionMetrics({
      now,
      period: "30d",
      suggestions: [
        suggestion({ created_at: "2026-09-20T10:00:00.000Z", status: "rejected", decided_at: "2026-09-20T12:00:00.000Z" }),
        suggestion({ created_at: "2026-09-20T10:00:00.000Z", status: "rejected", decided_at: "2026-09-20T16:00:00.000Z", description: "  paint   walls " })
      ],
      requests: [
        analysisRequest(),
        analysisRequest({ analysis_status: "failed" })
      ]
    });

    expect(result.totals.medianDecisionHours).toBe(4);
    expect(result.topRejected[0]).toMatchObject({ description: "Paint walls", count: 2 });
    expect(result.totals.completionRate).toBe(0.5);
    expect(result.models[0]).toMatchObject({ model: "gpt-test", attempted: 2, completed: 1, failed: 1 });
  });
});
