import {
  buildPainterStarterPriceBook,
  createPainterDraftLines,
  painterCorePriceKeys,
  painterStarterDefinitions,
  painterStarterPriceKeys,
  painterTrade,
  type PainterCorePriceInput,
  type PainterPriceBookKey
} from "./painter.js";
import type { DraftConflict, PainterChecklist, PriceBookItem, QuoteLineItem } from "./schemas.js";

export const tradeIds = [painterTrade] as const;
export type TradeId = (typeof tradeIds)[number];

export type TradeChecklist = PainterChecklist;
export type TradeCorePriceInput = PainterCorePriceInput;
export type TradePriceBookKey = PainterPriceBookKey;

export type TradeCorePriceField = {
  key: keyof PainterCorePriceInput;
  label: string;
  kind: "room_size_medium" | "fixed";
  priceBookKey: PainterPriceBookKey;
};

export type TradeChecklistConfig = {
  title: string;
  helper: string;
  quantitySectionLabel: string;
  quantityRows: Array<{
    key: keyof PainterChecklist["rooms"];
    label: string;
  }>;
  toggleSectionLabel: string;
  surfaceRows: Array<{
    key: keyof PainterChecklist["surfaces"];
    label: string;
  }>;
  countRows: Array<{
    key: "doorCount";
    label: string;
  }>;
  coatSectionLabel: string;
  suppliedBySectionLabel: string;
  suppliedByOptions: {
    customer: string;
    business: string;
  };
  prepSectionLabel: string;
};

export type TradeNotesConfig = {
  title: string;
  helper: string;
  chips: Array<{
    label: string;
    phrase: string;
  }>;
  placeholder: string;
  lockedCopy: string;
};

export type TradeConfig = {
  id: TradeId;
  label: string;
  businessCategory: string;
  defaultBusinessName: string;
  defaultTerms: string;
  starterDefinitions: typeof painterStarterDefinitions;
  corePriceKeys: readonly PainterPriceBookKey[];
  starterPriceKeys: readonly PainterPriceBookKey[];
  setup: {
    title: string;
    signedInHelper: string;
    offlineHelper: string;
    saveButtonLabel: string;
    corePriceFields: TradeCorePriceField[];
    derivedPriceHelper: string;
  };
  checklist: TradeChecklistConfig;
  notes: TradeNotesConfig;
};

export const tradeConfigs = {
  [painterTrade]: {
    id: painterTrade,
    label: "Painting",
    businessCategory: "Home service",
    defaultBusinessName: "QuoteVan Services",
    defaultTerms: "50% deposit due to schedule the job, balance due on completion.",
    starterDefinitions: painterStarterDefinitions,
    corePriceKeys: painterCorePriceKeys,
    starterPriceKeys: painterStarterPriceKeys,
    setup: {
      title: "Confirm your core prices",
      signedInHelper: "Required once before this account can sync and send quotes.",
      offlineHelper: "You can continue offline now. Sign in later to sync these prices.",
      saveButtonLabel: "Save Prices",
      corePriceFields: [
        {
          key: "paintWalls",
          label: "Walls, medium room $",
          kind: "room_size_medium",
          priceBookKey: "paint_walls"
        },
        {
          key: "paintCeiling",
          label: "Ceiling, medium room $",
          kind: "room_size_medium",
          priceBookKey: "paint_ceiling"
        },
        {
          key: "paintTrim",
          label: "Trim, medium room $",
          kind: "room_size_medium",
          priceBookKey: "paint_trim"
        },
        {
          key: "paintDoorEachCents",
          label: "Door, each $",
          kind: "fixed",
          priceBookKey: "paint_door"
        },
        {
          key: "heavyPrepHourlyCents",
          label: "Heavy prep, hourly $",
          kind: "fixed",
          priceBookKey: "heavy_wall_prep"
        }
      ],
      derivedPriceHelper:
        "Small and large prices are derived from these visible defaults. The backend stores explicit prices, not AI guesses."
    },
    checklist: {
      title: "The job",
      helper: "These numbers set your quantities — the prices come later, from your book.",
      quantitySectionLabel: "Rooms by size",
      quantityRows: [
        { key: "small", label: "Small" },
        { key: "medium", label: "Medium" },
        { key: "large", label: "Large" }
      ],
      toggleSectionLabel: "Surfaces",
      surfaceRows: [
        { key: "walls", label: "Walls" },
        { key: "ceilings", label: "Ceilings" },
        { key: "trim", label: "Trim" }
      ],
      countRows: [{ key: "doorCount", label: "Doors" }],
      coatSectionLabel: "Coats",
      suppliedBySectionLabel: "Paint by",
      suppliedByOptions: {
        customer: "Customer",
        business: "Me"
      },
      prepSectionLabel: "Prep level"
    },
    notes: {
      title: "Anything else on this job?",
      helper: "Talk it through, or tap the extras below.",
      chips: [
        { label: "patch holes", phrase: "patch nail holes" },
        { label: "wallpaper", phrase: "remove wallpaper" },
        { label: "primer", phrase: "primer coat" },
        { label: "materials", phrase: "material allowance" }
      ],
      placeholder: "Type anything the checklist didn't cover...",
      lockedCopy: "Voice only adds the extras below."
    }
  }
} satisfies Record<TradeId, TradeConfig>;

export function getTradeConfig(trade: TradeId): TradeConfig {
  return tradeConfigs[trade];
}

export function buildStarterPriceBookForTrade(params: {
  trade: TradeId;
  orgId: string;
  now: string;
  makeId: (key: TradePriceBookKey) => string;
  corePrices?: TradeCorePriceInput;
}): PriceBookItem[] {
  switch (params.trade) {
    case "painting":
      return buildPainterStarterPriceBook({
        orgId: params.orgId,
        now: params.now,
        makeId: params.makeId,
        ...(params.corePrices ? { corePrices: params.corePrices } : {})
      });
  }
}

export function createDraftLinesForTrade(params: {
  trade: TradeId;
  checklist: TradeChecklist;
  transcript: string;
  priceBookItems: PriceBookItem[];
}): {
  lineItems: QuoteLineItem[];
  conflicts: DraftConflict[];
  scopeNotes: string[];
} {
  switch (params.trade) {
    case "painting":
      return createPainterDraftLines({
        checklist: params.checklist,
        transcript: params.transcript,
        priceBookItems: params.priceBookItems
      });
  }
}
