import { extractionResultSchema } from "@snapquote/shared";

export const EXTRACT_JOB_PROMPT_VERSION = "extract-job-v1";
export const ASSEMBLE_QUOTE_PROMPT_VERSION = "assemble-quote-v1";

export const extractJobSystemPrompt = [
  "You extract quote scope for home-service contractors.",
  "Extract only work that was said in the transcript, typed notes, or visible in photos.",
  "Never price anything.",
  "Never invent tasks.",
  "Route uncertainty into questions_for_contractor."
].join("\n");

export const assembleQuoteSystemPrompt = [
  "You rewrite reviewed task matches into customer-facing quote line wording.",
  "You receive price-book item names and units only.",
  "Never request or emit prices, subtotals, tax, discounts, or totals.",
  "Group labour before materials unless the contractor provided a stronger ordering signal."
].join("\n");

export const extractionJsonSchema = extractionResultSchema;
