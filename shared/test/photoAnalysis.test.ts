import { describe, expect, it } from "vitest";
import {
  assertPhotoAnalysisEvidence,
  assertPhotoSuitability,
  noUsablePhotoAnalysis,
  photoAnalysisSuggestionRows,
  photoAnalysisUserContext,
  usablePhotoMediaIds,
  type PhotoAnalysisResult
} from "../../infra/supabase/functions/snapquote/photoAnalysis.ts";

const mediaId = "00000000-0000-4000-8000-000000000101";
const otherMediaId = "00000000-0000-4000-8000-000000000102";

const analysis: PhotoAnalysisResult = {
  summary: "A ceiling stain and damaged paint are visible.",
  tasks: [{
    description: "Prepare and repaint ceiling stain",
    quantity: null,
    unit: null,
    kind: "labour" as const,
    assumptions: ["The source of the stain is not visible."],
    confidence: 0.82,
    evidence_media_ids: [mediaId]
  }],
  site_conditions: [{
    description: "Brown ceiling discoloration is visible.",
    confidence: 0.95,
    evidence_media_ids: [mediaId]
  }],
  questions_for_contractor: ["Has the moisture source been repaired?"],
  coverage: { sufficient: false, missing: ["A wider ceiling photo"] }
};

describe("photo analysis contract", () => {
  it("builds an OpenAI context without customer identity, contact details, or address", () => {
    const context = photoAnalysisUserContext({
      address: "85 Gamble Ave",
      city: "Toronto",
      customer_email: "customer@example.com",
      customer_name: "Private Customer",
      customer_phone: "416-555-0100",
      checklist: { rooms: { small: 1, medium: 0, large: 0 } },
      notes: "Private Customer saw a water stain at 85 Gamble Ave, Toronto. Call 416-555-0100 or customer@example.com."
    }, [mediaId]);

    expect(context.checklist).toEqual({ rooms: { small: 1, medium: 0, large: 0 } });
    expect(context.photoEvidenceIds).toEqual([mediaId]);
    expect(context.notes).toContain("water stain");
    expect(JSON.stringify(context)).not.toMatch(/Gamble|customer@example|Private Customer|416-555/);
  });

  it("requires every visual claim to cite request media", () => {
    expect(() => assertPhotoAnalysisEvidence(analysis, [mediaId])).not.toThrow();
    expect(() => assertPhotoAnalysisEvidence({
      ...analysis,
      tasks: [{ ...analysis.tasks[0]!, evidence_media_ids: [otherMediaId] }]
    }, [mediaId])).toThrow("outside this request");
  });

  it("normalizes analysis into provider-review suggestions", () => {
    const rows = photoAnalysisSuggestionRows(
      "00000000-0000-4000-8000-000000000201",
      "00000000-0000-4000-8000-000000000301",
      analysis
    );

    expect(rows.map((row) => row.suggestion_type)).toEqual(["task", "site_condition", "question"]);
    expect(rows[0]?.evidence_media_ids).toEqual([mediaId]);
    expect(rows[2]?.evidence_media_ids).toEqual([]);
  });

  it("rejects person-dominant photos before scope analysis", () => {
    const suitability = {
      media: [{
        media_id: mediaId,
        classification: "person_dominant" as const,
        reason: "A person is the primary subject and the job area is only incidental background."
      }]
    };

    expect(() => assertPhotoSuitability(suitability, [mediaId])).not.toThrow();
    expect(usablePhotoMediaIds(suitability)).toEqual([]);
    expect(photoAnalysisSuggestionRows("request", "org", noUsablePhotoAnalysis())).toEqual([]);
  });

  it("requires every request photo to receive exactly one suitability result", () => {
    expect(() => assertPhotoSuitability({ media: [] }, [mediaId])).toThrow("exactly once");
    expect(() => assertPhotoSuitability({
      media: [{ media_id: otherMediaId, classification: "job_site", reason: "A room is visible." }]
    }, [mediaId])).toThrow("outside this request");
  });
});
