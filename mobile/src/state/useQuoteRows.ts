import { useMemo } from "react";
import type { Customer, QuoteStatus, QuoteTotals, SendBlockers } from "@snapquote/shared";
import {
  getQuoteBlockers,
  getQuoteCustomer,
  getQuoteIsStale,
  getQuoteStatus,
  getQuoteTotals,
  useQuoteStore,
  type QuoteRecord
} from "./quoteStore";

export type QuoteRow = {
  quote: QuoteRecord;
  customer: Customer | null;
  status: QuoteStatus;
  blockers: SendBlockers;
  stale: boolean;
  totals: QuoteTotals | null;
};

export function useQuoteRows(): QuoteRow[] {
  const quotes = useQuoteStore((state) => state.quotes);
  const customers = useQuoteStore((state) => state.customers);
  const events = useQuoteStore((state) => state.events);

  return useMemo(
    () =>
      quotes.map((quote) => ({
        quote,
        customer: getQuoteCustomer(quote, customers),
        status: getQuoteStatus(quote, events),
        blockers: getQuoteBlockers(quote),
        stale: getQuoteIsStale(quote),
        totals: getQuoteTotals(quote)
      })),
    [quotes, customers, events]
  );
}
