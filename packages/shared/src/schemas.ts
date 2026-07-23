import { z } from "zod";
import {
  customerResponseActions,
  deliveryChannels,
  jobStatuses,
  lineItemMatchStates,
  lineItemKinds,
  lineItemSources,
  prepLevels,
  quoteEventTypes,
  quoteStatuses,
  quoteUnits,
  roomSizes
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

export const quoteUnitSchema = z.enum(quoteUnits);
export const nullableUnitSchema = quoteUnitSchema.nullable();

export const lineItemKindSchema = z.enum(lineItemKinds);
export const lineItemSourceSchema = z.enum(lineItemSources);
export const lineItemMatchStateSchema = z.enum(lineItemMatchStates);
export const quoteStatusSchema = z.enum(quoteStatuses);
export const jobStatusSchema = z.enum(jobStatuses);
export const deliveryChannelSchema = z.enum(deliveryChannels);
export const customerResponseActionSchema = z.enum(customerResponseActions);
export const quoteEventTypeSchema = z.enum(quoteEventTypes);
export const roomSizeSchema = z.enum(roomSizes);
export const prepLevelSchema = z.enum(prepLevels);

export const healthResponseSchema = z.object({
  ok: z.literal(true),
  service: z.literal("snapquote-api"),
  version: z.string(),
  timestamp: z.string().datetime()
});

export const orgProfileSchema = z.object({
  id: idSchema,
  name: z.string().trim().max(120),
  trade: z.literal("painting"),
  logoUrl: z.string().url().nullable(),
  defaultTaxRate: z.number().min(0).max(1),
  defaultTerms: z.string().trim().max(4000),
  quoteValidDays: z.number().int().min(1).max(365),
  setupCompletedAt: z.string().datetime().nullable(),
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
}).extend({
  email: emailSchema,
  phone: phoneSchema.nullable().optional()
});

export const roomSizePricesSchema = z.object({
  small: moneyCentsSchema,
  medium: moneyCentsSchema,
  large: moneyCentsSchema
});

export const priceBookPricingSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("fixed"),
    unitPriceCents: moneyCentsSchema
  }),
  z.object({
    type: z.literal("room_size"),
    prices: roomSizePricesSchema
  })
]);

export const priceBookItemSchema = z.object({
  id: idSchema,
  orgId: idSchema,
  key: z.string().trim().min(1).max(80).nullable(),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000),
  unit: quoteUnitSchema,
  pricing: priceBookPricingSchema,
  kind: lineItemKindSchema,
  starter: z.boolean(),
  confirmedAt: z.string().datetime().nullable(),
  usageCount: z.number().int().min(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const createPriceBookItemSchema = priceBookItemSchema.omit({
  id: true,
  orgId: true,
  usageCount: true,
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
  unit: quoteUnitSchema,
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
    quantity: z.number().positive(),
    unit: nullableUnitSchema,
    unitPriceCents: moneyCentsSchema.nullable(),
    kind: lineItemKindSchema,
    source: lineItemSourceSchema,
    priceBookItemId: idSchema.nullable(),
    priceBookItemKey: z.string().trim().min(1).max(80).nullable().optional(),
    matchConfidence: z.number().min(0).max(1).nullable(),
    matchState: lineItemMatchStateSchema
  })
  .superRefine((item, ctx) => {
    if (item.matchState === "green" && item.unitPriceCents === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["unitPriceCents"],
        message: "Green lines must include unitPriceCents"
      });
    }

    if (item.source === "price_book" && item.priceBookItemId === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["priceBookItemId"],
        message: "Price-book lines must reference a price book item"
      });
    }

    if (item.matchState === "green" && item.source === "price_book" && item.matchConfidence === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["matchConfidence"],
        message: "Green price-book lines must include match confidence"
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
  channels: z.array(deliveryChannelSchema).min(1).max(1)
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

export const painterChecklistSchema = z.object({
  rooms: z.object({
    small: z.number().int().min(0).max(20),
    medium: z.number().int().min(0).max(20),
    large: z.number().int().min(0).max(20)
  }),
  surfaces: z.object({
    walls: z.boolean(),
    ceilings: z.boolean(),
    trim: z.boolean()
  }),
  doorCount: z.number().int().min(0).max(100),
  prepLevel: prepLevelSchema,
  coatCount: z.union([z.literal(1), z.literal(2)]).default(2),
  customerSuppliesPaint: z.boolean()
});

export const draftConflictSchema = z.object({
  field: z.string().trim().min(1),
  checklistValue: z.string().trim().min(1),
  transcriptValue: z.string().trim().min(1),
  message: z.string().trim().min(1)
});

export const draftQuoteInputSchema = z.object({
  checklist: painterChecklistSchema,
  transcript: z.string().trim().max(5000),
  typedNotes: z.string().trim().max(5000).optional()
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type OrgProfile = z.infer<typeof orgProfileSchema>;
export type Customer = z.infer<typeof customerSchema>;
export type PriceBookItem = z.infer<typeof priceBookItemSchema>;
export type PriceBookPricing = z.infer<typeof priceBookPricingSchema>;
export type PriceBookCsvRow = z.infer<typeof priceBookCsvRowSchema>;
export type ExtractedTask = z.infer<typeof extractedTaskSchema>;
export type ExtractionResult = z.infer<typeof extractionResultSchema>;
export type QuoteLineItem = z.infer<typeof quoteLineItemSchema>;
export type QuoteDiscount = z.infer<typeof quoteDiscountSchema>;
export type QuotePatch = z.infer<typeof quotePatchSchema>;
export type QuoteEvent = z.infer<typeof quoteEventSchema>;
export type PainterChecklist = z.infer<typeof painterChecklistSchema>;
export type DraftConflict = z.infer<typeof draftConflictSchema>;
export type DraftQuoteInput = z.infer<typeof draftQuoteInputSchema>;
