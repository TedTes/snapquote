import { z } from "zod";
import {
  DEFAULT_MATCH_AUTO_THRESHOLD,
  DEFAULT_MATCH_SUGGEST_THRESHOLD
} from "@snapquote/shared";

const optionalNonEmptyString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional()
);

export const appConfigSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    DATABASE_URL: optionalNonEmptyString,
    REDIS_URL: optionalNonEmptyString,
    AWS_REGION: optionalNonEmptyString.default("us-east-1"),
    S3_BUCKET: optionalNonEmptyString,
    ANTHROPIC_API_KEY: optionalNonEmptyString,
    ANTHROPIC_MODEL: optionalNonEmptyString.default("claude-sonnet-4-6"),
    OPENAI_API_KEY: optionalNonEmptyString,
    CLERK_SECRET_KEY: optionalNonEmptyString,
    CLERK_PUBLISHABLE_KEY: optionalNonEmptyString,
    RESEND_API_KEY: optionalNonEmptyString,
    TWILIO_ACCOUNT_SID: optionalNonEmptyString,
    TWILIO_AUTH_TOKEN: optionalNonEmptyString,
    TWILIO_FROM: optionalNonEmptyString,
    STRIPE_SECRET_KEY: optionalNonEmptyString,
    STRIPE_WEBHOOK_SECRET: optionalNonEmptyString,
    STRIPE_PRICE_SOLO: optionalNonEmptyString,
    PUBLIC_QUOTE_BASE_URL: optionalNonEmptyString.default(
      "http://localhost:3001/public/quotes"
    ),
    MATCH_AUTO_THRESHOLD: z.coerce
      .number()
      .min(0)
      .max(1)
      .default(DEFAULT_MATCH_AUTO_THRESHOLD),
    MATCH_SUGGEST_THRESHOLD: z.coerce
      .number()
      .min(0)
      .max(1)
      .default(DEFAULT_MATCH_SUGGEST_THRESHOLD),
    LLM_DAILY_BUDGET_CENTS_PER_ORG: z.coerce.number().int().min(0).default(200),
    SENTRY_DSN: optionalNonEmptyString,
    POSTHOG_KEY: optionalNonEmptyString
  })
  .superRefine((config, ctx) => {
    if (config.MATCH_SUGGEST_THRESHOLD > config.MATCH_AUTO_THRESHOLD) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["MATCH_SUGGEST_THRESHOLD"],
        message: "MATCH_SUGGEST_THRESHOLD cannot exceed MATCH_AUTO_THRESHOLD"
      });
    }
  });

export type AppConfig = z.infer<typeof appConfigSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return appConfigSchema.parse(env);
}
