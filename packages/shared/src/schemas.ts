import { z } from "zod";
import {
  customerResponseActions,
  deliveryChannels,
  jobStatuses,
  lineItemKinds,
  lineItemSources,
  quoteEventTypes,
  quoteStatuses
} from "./constants.js";

export const idSchema = z.string().uuid();

export const moneyCentsSchema = z.number().int().min(0);

export const emailSchema = z.string().email().max(320);

export const phoneSchema = z
  .string()
  .trim()
  .min(7)
  .max(32)
  .regex(/^[+()\-\s0-9.]+$/, "Phone contains unsupported characters");

export const nullableUnitSchema = z
  .enum(["each", "hour", "sqft", "lnft", "day"])
  .nullable();

export const lineItemKindSchema = z.enum(lineItemKinds);
export const lineItemSourceSchema = z.enum(lineItemSources);
export const quoteStatusSchema = z.enum(quoteStatuses);
export const jobStatusSchema = z.enum(jobStatuses);
export const deliveryChannelSchema = z.enum(deliveryChannels);
export const customerResponseActionSchema = z.enum(customerResponseActions);
export const quoteEventTypeSchema = z.enum(quoteEventTypes);

export const healthResponseSchema = z.object({
  ok: z.literal(true),
  service: z.literal("snapquote-api"),
  version: z.string(),
  timestamp: z.string().datetime()
});

export const orgProfileSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1).max(120),
  trade: z.string().trim().min(1).max(80),
  logoUrl: z.string().url().nullable(),
  defaultTaxRate: z.number().min(0).max(1),
  defaultTerms: z.string().trim().max(4000),
  quoteValidDays: z.number().int().min(1).max(365),
  plan: z.enum(["trial", "solo", "crew", "expired"])
});

export const updateOrgProfileSchema = orgProfileSchema
  .omit({
    id: true,
    plan: true
  })
  .partial();

export const customerSchema = z.object({
  id: idSchema,
  orgId: idSchema,
  name: z.string().trim().min(1).max(160),
  email: emailSchema.nullable(),
  phone: phoneSchema.nullable(),
  address: z.string().trim().min(1).max(400),
  createdAt: z.string().datetime()
});

export const createCustomerSchema = customerSchema.omit({
  id: true,
  orgId: true,
  createdAt: true
});

export const priceBookItemSchema = z.object({
  id: idSchema,
  orgId: idSchema,
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000),
  unit: z.enum(["each", "hour", "sqft", "lnft", "day"]),
  unitPriceCents: moneyCentsSchema,
  kind: lineItemKindSchema,
  usageCount: z.number().int().min(0),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const createPriceBookItemSchema = priceBookItemSchema.omit({
  id: true,
  orgId: true,
  usageCount: true,
  isActive: true,
  createdAt: true,
  updatedAt: true
});

export const updatePriceBookItemSchema = createPriceBookItemSchema.partial();

const csvMoneyToCentsSchema = z.union([z.string(), z.number()]).transform((value, ctx) => {
  const normalized = typeof value === "number" ? value : Number(value.replace(/[$,\s]/g, ""));

  if (!Number.isFinite(normalized) || normalized < 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "unit_price must be a non-negative number"
    });
    return z.NEVER;
  }

  return Math.round(normalized * 100);
});

export const priceBookCsvRowSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().default(""),
  unit: z.enum(["each", "hour", "sqft", "lnft", "day"]),
  unit_price: csvMoneyToCentsSchema,
  type: lineItemKindSchema
});

export const extractedTaskSchema = z.object({
  description: z.string().trim().min(1).max(240),
  quantity: z.number().positive().nullable(),
  unit: nullableUnitSchema,
  kind: lineItemKindSchema,
  assumptions: z.array(z.string().trim().min(1).max(240)).max(10),
  confidence: z.number().min(0).max(1)
});

export const extractionResultSchema = z.object({
  scope_summary: z.string().trim().min(1).max(1200),
  tasks: z.array(extractedTaskSchema).max(40),
  site_conditions: z.array(z.string().trim().min(1).max(240)).max(20),
  questions_for_contractor: z.array(z.string().trim().min(1).max(240)).max(20)
});

export const matchedPriceBookCandidateSchema = z.object({
  priceBookItemId: idSchema,
  name: z.string().trim().min(1),
  unit: z.string().trim().min(1),
  confidence: z.number().min(0).max(1)
});

export const quoteLineItemSchema = z
  .object({
    id: idSchema.optional(),
    position: z.number().int().min(0),
    description: z.string().trim().min(1).max(500),
    qty: z.number().positive(),
    unit: nullableUnitSchema,
    unitPriceCents: moneyCentsSchema.nullable(),
    kind: lineItemKindSchema,
    source: lineItemSourceSchema,
    priceBookItemId: idSchema.nullable(),
    matchConfidence: z.number().min(0).max(1).nullable(),
    needsPrice: z.boolean()
  })
  .superRefine((item, ctx) => {
    if (!item.needsPrice && item.unitPriceCents === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["unitPriceCents"],
        message: "Priced lines must include unitPriceCents"
      });
    }

    if (item.source === "price_book" && item.priceBookItemId === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["priceBookItemId"],
        message: "Price-book lines must reference a price book item"
      });
    }
  });

export const quoteDiscountSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("none"),
    value: z.literal(0)
  }),
  z.object({
    type: z.literal("percent"),
    value: z.number().min(0).max(100)
  }),
  z.object({
    type: z.literal("cents"),
    value: moneyCentsSchema
  })
]);

export const quotePatchSchema = z.object({
  lineItems: z.array(quoteLineItemSchema).optional(),
  discount: quoteDiscountSchema.optional(),
  taxRate: z.number().min(0).max(1).optional(),
  notes: z.string().trim().max(4000).optional(),
  terms: z.string().trim().max(4000).optional(),
  validUntil: z.string().date().optional()
});

export const sendQuoteSchema = z.object({
  channels: z.array(deliveryChannelSchema).min(1).max(2)
});

export const customerQuoteResponseSchema = z.object({
  action: customerResponseActionSchema
});

export const quoteEventSchema = z.object({
  id: idSchema,
  quoteId: idSchema,
  type: quoteEventTypeSchema,
  meta: z.record(z.unknown()),
  createdAt: z.string().datetime()
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type OrgProfile = z.infer<typeof orgProfileSchema>;
export type Customer = z.infer<typeof customerSchema>;
export type PriceBookItem = z.infer<typeof priceBookItemSchema>;
export type PriceBookCsvRow = z.infer<typeof priceBookCsvRowSchema>;
export type ExtractedTask = z.infer<typeof extractedTaskSchema>;
export type ExtractionResult = z.infer<typeof extractionResultSchema>;
export type QuoteLineItem = z.infer<typeof quoteLineItemSchema>;
export type QuoteDiscount = z.infer<typeof quoteDiscountSchema>;
export type QuotePatch = z.infer<typeof quotePatchSchema>;
