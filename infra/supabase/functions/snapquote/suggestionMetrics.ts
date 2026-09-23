export type SuggestionMetricsPeriod = "7d" | "30d" | "90d" | "all";

export type SuggestionMetricRow = {
  id: string;
  request_id: string;
  suggestion_type: string;
  description: string;
  confidence: number | string;
  status: string;
  created_at: string;
  decided_at: string | null;
};

export type AnalysisRequestMetricRow = {
  id: string;
  analysis_status: string;
  analysis_model: string | null;
  analysis_version: string | null;
  analysis_started_at: string | null;
  analysis_completed_at: string | null;
  created_at: string;
};

type CountedMetric = {
  generated: number;
  reviewed: number;
  accepted: number;
  rejected: number;
  acceptanceRate: number | null;
};

export type SuggestionMetrics = {
  period: {
    key: SuggestionMetricsPeriod;
    from: string | null;
    to: string;
  };
  totals: CountedMetric & {
    pending: number;
    attemptedAnalyses: number;
    completedAnalyses: number;
    failedAnalyses: number;
    completionRate: number | null;
    medianDecisionHours: number | null;
  };
  byType: Array<CountedMetric & { type: string }>;
  confidenceBands: Array<{
    key: "low" | "medium" | "high";
    label: string;
    reviewed: number;
    accepted: number;
    rejected: number;
    acceptanceRate: number | null;
  }>;
  trend: Array<{
    key: string;
    label: string;
    accepted: number;
    rejected: number;
  }>;
  topRejected: Array<{
    description: string;
    count: number;
    averageConfidence: number;
  }>;
  models: Array<{
    model: string;
    version: string | null;
    attempted: number;
    completed: number;
    failed: number;
    completionRate: number | null;
  }>;
};

const periodDays: Record<Exclude<SuggestionMetricsPeriod, "all">, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90
};

export function suggestionMetricsPeriodStart(period: SuggestionMetricsPeriod, now = new Date()) {
  if (period === "all") return null;

  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - periodDays[period]);
  return start.toISOString();
}

export function aggregateSuggestionMetrics(input: {
  suggestions: SuggestionMetricRow[];
  requests: AnalysisRequestMetricRow[];
  period: SuggestionMetricsPeriod;
  now?: Date | undefined;
}): SuggestionMetrics {
  const now = input.now ?? new Date();
  const from = suggestionMetricsPeriodStart(input.period, now);
  const nowTime = now.getTime();
  const fromTime = from === null ? null : Date.parse(from);
  const inPeriod = (value: string | null) => {
    if (value === null) return false;
    const time = Date.parse(value);
    return Number.isFinite(time) && (fromTime === null || time >= fromTime) && time <= nowTime;
  };
  const generated = input.suggestions.filter((row) => inPeriod(row.created_at));
  const reviewed = input.suggestions.filter((row) =>
    (row.status === "accepted" || row.status === "rejected") && inPeriod(row.decided_at)
  );
  const accepted = reviewed.filter((row) => row.status === "accepted");
  const rejected = reviewed.filter((row) => row.status === "rejected");
  const pending = generated.filter((row) => row.status === "pending");
  const attempts = input.requests.filter((row) => inPeriod(row.analysis_started_at));
  const completed = attempts.filter((row) => row.analysis_status === "completed");
  const failed = attempts.filter((row) => row.analysis_status === "failed");
  const decisionHours = reviewed
    .map((row) => elapsedHours(row.created_at, row.decided_at))
    .filter((value): value is number => value !== null)
    .sort((left, right) => left - right);

  return {
    period: { key: input.period, from, to: now.toISOString() },
    totals: {
      generated: generated.length,
      pending: pending.length,
      reviewed: reviewed.length,
      accepted: accepted.length,
      rejected: rejected.length,
      acceptanceRate: rate(accepted.length, reviewed.length),
      attemptedAnalyses: attempts.length,
      completedAnalyses: completed.length,
      failedAnalyses: failed.length,
      completionRate: rate(completed.length, attempts.length),
      medianDecisionHours: median(decisionHours)
    },
    byType: byType(generated, reviewed),
    confidenceBands: confidenceBands(reviewed),
    trend: decisionTrend(reviewed, input.period),
    topRejected: rejectedSuggestions(rejected),
    models: modelMetrics(attempts)
  };
}

function byType(generated: SuggestionMetricRow[], reviewed: SuggestionMetricRow[]) {
  const types = [...new Set([...generated, ...reviewed].map((row) => row.suggestion_type))].sort();

  return types.map((type) => {
    const generatedForType = generated.filter((row) => row.suggestion_type === type);
    const reviewedForType = reviewed.filter((row) => row.suggestion_type === type);
    const accepted = reviewedForType.filter((row) => row.status === "accepted").length;
    const rejected = reviewedForType.length - accepted;

    return {
      type,
      generated: generatedForType.length,
      reviewed: reviewedForType.length,
      accepted,
      rejected,
      acceptanceRate: rate(accepted, reviewedForType.length)
    };
  });
}

function confidenceBands(reviewed: SuggestionMetricRow[]): SuggestionMetrics["confidenceBands"] {
  const definitions = [
    { key: "low" as const, label: "Below 60%", includes: (value: number) => value < 0.6 },
    { key: "medium" as const, label: "60-79%", includes: (value: number) => value >= 0.6 && value < 0.8 },
    { key: "high" as const, label: "80-100%", includes: (value: number) => value >= 0.8 }
  ];

  return definitions.map((definition) => {
    const rows = reviewed.filter((row) => definition.includes(clampConfidence(Number(row.confidence))));
    const accepted = rows.filter((row) => row.status === "accepted").length;

    return {
      key: definition.key,
      label: definition.label,
      reviewed: rows.length,
      accepted,
      rejected: rows.length - accepted,
      acceptanceRate: rate(accepted, rows.length)
    };
  });
}

function decisionTrend(reviewed: SuggestionMetricRow[], period: SuggestionMetricsPeriod): SuggestionMetrics["trend"] {
  const buckets = new Map<string, { accepted: number; rejected: number }>();

  for (const row of reviewed) {
    if (!row.decided_at) continue;
    const date = new Date(row.decided_at);
    if (!Number.isFinite(date.getTime())) continue;
    const key = trendKey(date, period);
    const bucket = buckets.get(key) ?? { accepted: 0, rejected: 0 };
    bucket[row.status === "accepted" ? "accepted" : "rejected"] += 1;
    buckets.set(key, bucket);
  }

  return [...buckets.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([key, bucket]) => ({
    key,
    label: trendLabel(key, period),
    ...bucket
  }));
}

function trendKey(date: Date, period: SuggestionMetricsPeriod) {
  if (period === "all") return date.toISOString().slice(0, 7);
  if (period !== "90d") return date.toISOString().slice(0, 10);

  const monday = new Date(date);
  const day = monday.getUTCDay();
  monday.setUTCDate(monday.getUTCDate() - (day === 0 ? 6 : day - 1));
  return monday.toISOString().slice(0, 10);
}

function trendLabel(key: string, period: SuggestionMetricsPeriod) {
  const date = new Date(period === "all" ? `${key}-01T00:00:00.000Z` : `${key}T00:00:00.000Z`);
  return new Intl.DateTimeFormat("en", period === "all"
    ? { month: "short", year: "2-digit", timeZone: "UTC" }
    : { month: "short", day: "numeric", timeZone: "UTC" }).format(date);
}

function rejectedSuggestions(rows: SuggestionMetricRow[]): SuggestionMetrics["topRejected"] {
  const groups = new Map<string, { description: string; count: number; confidence: number }>();

  for (const row of rows) {
    const key = row.description.trim().replace(/\s+/g, " ").toLowerCase();
    if (!key) continue;
    const group = groups.get(key) ?? { description: row.description.trim(), count: 0, confidence: 0 };
    group.count += 1;
    group.confidence += clampConfidence(Number(row.confidence));
    groups.set(key, group);
  }

  return [...groups.values()]
    .sort((left, right) => right.count - left.count || left.description.localeCompare(right.description))
    .slice(0, 5)
    .map((group) => ({
      description: group.description,
      count: group.count,
      averageConfidence: round(group.confidence / group.count, 3)
    }));
}

function modelMetrics(rows: AnalysisRequestMetricRow[]): SuggestionMetrics["models"] {
  const groups = new Map<string, SuggestionMetrics["models"][number]>();

  for (const row of rows) {
    const model = row.analysis_model?.trim() || "Unknown model";
    const version = row.analysis_version?.trim() || null;
    const key = `${model}\u0000${version ?? ""}`;
    const group = groups.get(key) ?? {
      model,
      version,
      attempted: 0,
      completed: 0,
      failed: 0,
      completionRate: null
    };
    group.attempted += 1;
    if (row.analysis_status === "completed") group.completed += 1;
    if (row.analysis_status === "failed") group.failed += 1;
    group.completionRate = rate(group.completed, group.attempted);
    groups.set(key, group);
  }

  return [...groups.values()].sort((left, right) => right.attempted - left.attempted || left.model.localeCompare(right.model));
}

function elapsedHours(start: string, end: string | null) {
  if (!end) return null;
  const elapsed = new Date(end).getTime() - new Date(start).getTime();
  return Number.isFinite(elapsed) && elapsed >= 0 ? elapsed / 3_600_000 : null;
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const middle = Math.floor(values.length / 2);
  const value = values.length % 2 === 0
    ? ((values[middle - 1] ?? 0) + (values[middle] ?? 0)) / 2
    : values[middle] ?? 0;
  return round(value, 2);
}

function rate(numerator: number, denominator: number) {
  return denominator === 0 ? null : round(numerator / denominator, 4);
}

function clampConfidence(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function round(value: number, places: number) {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}
