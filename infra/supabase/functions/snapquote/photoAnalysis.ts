export type PhotoAnalysisResult = {
  summary: string;
  tasks: Array<{
    description: string;
    quantity: number | null;
    unit: "room" | "each" | "hour" | "flat" | "sqft" | "lnft" | "day" | null;
    kind: "labour" | "material";
    assumptions: string[];
    confidence: number;
    evidence_media_ids: string[];
  }>;
  site_conditions: Array<{
    description: string;
    confidence: number;
    evidence_media_ids: string[];
  }>;
  questions_for_contractor: string[];
  coverage: {
    sufficient: boolean;
    missing: string[];
  };
};

export type PhotoSuitabilityResult = {
  media: Array<{
    media_id: string;
    classification: "job_site" | "person_dominant" | "unrelated" | "unusable";
    reason: string;
  }>;
};

export function photoAnalysisUserContext(requestRow: Record<string, unknown>, mediaIds: string[]) {
  return {
    checklist: requestRow.checklist,
    notes: redactRequestNotes(requestRow),
    photoEvidenceIds: mediaIds
  };
}

function redactRequestNotes(requestRow: Record<string, unknown>) {
  let notes = typeof requestRow.notes === "string" ? requestRow.notes : "";
  const knownSensitiveValues = [
    requestRow.customer_name,
    requestRow.customer_email,
    requestRow.customer_phone,
    requestRow.address,
    requestRow.city
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);

  for (const value of knownSensitiveValues) {
    notes = notes.replace(new RegExp(escapeRegExp(value.trim()), "gi"), "[redacted]");
  }

  return notes
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted email]")
    .replace(/\+?\d[\d\s().-]{6,}\d/g, "[redacted phone]");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function assertPhotoAnalysisEvidence(analysis: PhotoAnalysisResult, allowedMediaIds: string[]) {
  const allowed = new Set(allowedMediaIds);
  const referenced = [
    ...analysis.tasks.flatMap((task) => task.evidence_media_ids),
    ...analysis.site_conditions.flatMap((condition) => condition.evidence_media_ids)
  ];

  if (referenced.some((id) => !allowed.has(id))) {
    throw new Error("Photo analysis referenced media outside this request");
  }
}

export function assertPhotoSuitability(result: PhotoSuitabilityResult, allowedMediaIds: string[]) {
  const allowed = new Set(allowedMediaIds);
  const returnedIds = result.media.map((item) => item.media_id);

  if (returnedIds.length !== allowed.size || new Set(returnedIds).size !== returnedIds.length) {
    throw new Error("Photo suitability must classify every request photo exactly once");
  }

  if (returnedIds.some((id) => !allowed.has(id))) {
    throw new Error("Photo suitability referenced media outside this request");
  }
}

export function usablePhotoMediaIds(result: PhotoSuitabilityResult) {
  return result.media
    .filter((item) => item.classification === "job_site")
    .map((item) => item.media_id);
}

export function noUsablePhotoAnalysis(): PhotoAnalysisResult {
  return {
    summary: "The submitted photos do not clearly show the job area, so no work was inferred.",
    tasks: [],
    site_conditions: [],
    questions_for_contractor: [],
    coverage: {
      sufficient: false,
      missing: ["Add clear photos focused on the rooms, surfaces, or damage that need work."]
    }
  };
}

export function photoAnalysisSuggestionRows(requestId: string, orgId: string, analysis: PhotoAnalysisResult) {
  return [
    ...analysis.tasks.map((task) => ({
      request_id: requestId,
      org_id: orgId,
      suggestion_type: "task",
      description: task.description,
      quantity: task.quantity,
      unit: task.unit,
      line_kind: task.kind,
      confidence: task.confidence,
      assumptions: task.assumptions,
      evidence_media_ids: task.evidence_media_ids
    })),
    ...analysis.site_conditions.map((condition) => ({
      request_id: requestId,
      org_id: orgId,
      suggestion_type: "site_condition",
      description: condition.description,
      quantity: null,
      unit: null,
      line_kind: null,
      confidence: condition.confidence,
      assumptions: [],
      evidence_media_ids: condition.evidence_media_ids
    })),
    ...analysis.questions_for_contractor.map((question) => ({
      request_id: requestId,
      org_id: orgId,
      suggestion_type: "question",
      description: question,
      quantity: null,
      unit: null,
      line_kind: null,
      confidence: 1,
      assumptions: [],
      evidence_media_ids: []
    }))
  ];
}

export function photoAnalysisJsonSchema() {
  const evidenceIds = {
    type: "array",
    minItems: 1,
    maxItems: 4,
    items: { type: "string" }
  };

  return {
    type: "object",
    additionalProperties: false,
    required: ["summary", "tasks", "site_conditions", "questions_for_contractor", "coverage"],
    properties: {
      summary: { type: "string" },
      tasks: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["description", "quantity", "unit", "kind", "assumptions", "confidence", "evidence_media_ids"],
          properties: {
            description: { type: "string" },
            quantity: { anyOf: [{ type: "number", exclusiveMinimum: 0 }, { type: "null" }] },
            unit: { anyOf: [{ type: "string", enum: ["room", "each", "hour", "flat", "sqft", "lnft", "day"] }, { type: "null" }] },
            kind: { type: "string", enum: ["labour", "material"] },
            assumptions: { type: "array", items: { type: "string" } },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            evidence_media_ids: evidenceIds
          }
        }
      },
      site_conditions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["description", "confidence", "evidence_media_ids"],
          properties: {
            description: { type: "string" },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            evidence_media_ids: evidenceIds
          }
        }
      },
      questions_for_contractor: { type: "array", items: { type: "string" } },
      coverage: {
        type: "object",
        additionalProperties: false,
        required: ["sufficient", "missing"],
        properties: {
          sufficient: { type: "boolean" },
          missing: { type: "array", items: { type: "string" } }
        }
      }
    }
  };
}

export function photoSuitabilityJsonSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["media"],
    properties: {
      media: {
        type: "array",
        minItems: 1,
        maxItems: 4,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["media_id", "classification", "reason"],
          properties: {
            media_id: { type: "string" },
            classification: {
              type: "string",
              enum: ["job_site", "person_dominant", "unrelated", "unusable"]
            },
            reason: { type: "string" }
          }
        }
      }
    }
  };
}
