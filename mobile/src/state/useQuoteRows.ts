import { useMemo } from "react";
import { deriveJobLabel, type Customer, type QuoteStatus, type QuoteTotals, type SendBlockers } from "@snapquote/shared";
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

/**
 * Search predicate for the Quotes list: matches the derived job label and the
 * linked customer's name/address/city.
 */
export function matchesQuoteSearch(row: QuoteRow, term: string): boolean {
  const query = term.trim().toLowerCase();

  if (query.length === 0) {
    return true;
  }

  const haystack = `${deriveJobLabel(row.quote)} ${row.customer?.name ?? ""} ${row.customer?.address ?? ""} ${row.customer?.city ?? ""}`.toLowerCase();
  return haystack.includes(query);
}

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
