import { useMemo } from "react";
import type { Customer, QuoteStatus, QuoteTotals, SendBlockers } from "@snapquote/shared";
import {
  getCustomer,
  getQuoteBlockers,
  getQuoteIsStale,
  getQuoteStatus,
  getQuoteTotals,
  useMvpStore,
  type QuoteRecord
} from "./mvp";

export type QuoteRow = {
  quote: QuoteRecord;
  customer: Customer | undefined;
  status: QuoteStatus;
  blockers: SendBlockers;
  stale: boolean;
  totals: QuoteTotals | null;
};

export function useQuoteRows(): QuoteRow[] {
  const quotes = useMvpStore((state) => state.quotes);
  const customers = useMvpStore((state) => state.customers);
  const events = useMvpStore((state) => state.events);

  return useMemo(
    () =>
      quotes.map((quote) => ({
        quote,
        customer: getCustomer(customers, quote.customerId),
        status: getQuoteStatus(quote, events),
        blockers: getQuoteBlockers(quote),
        stale: getQuoteIsStale(quote),
        totals: getQuoteTotals(quote)
      })),
    [quotes, customers, events]
  );
}
