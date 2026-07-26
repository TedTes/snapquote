import type { QuoteDiscount, QuoteLineItem, QuoteStatus, TradeId } from "@snapquote/shared";
import type { ReactNode } from "react";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const apiBaseUrl = (import.meta.env.VITE_SNAPQUOTE_API_URL ?? "https://dctmpfrbkgntiuhjbblu.functions.supabase.co/snapquote").replace(/\/$/, "");

type PublicCustomer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string;
};

type PublicOrg = {
  id: string;
  name: string;
  trade: TradeId;
  logoUrl: string | null;
  contactPhone: string | null;
  website: string | null;
  defaultTaxRate: number;
  defaultTerms: string;
  quoteValidDays: number;
  setupCompletedAt: string | null;
  plan: "trial" | "solo" | "crew" | "expired";
};

type PublicQuote = {
  id: string;
  orgId: string;
  org: PublicOrg;
  customerId: string;
  customer: PublicCustomer | null;
  address: string;
  jobTitle: string;
  status: QuoteStatus;
  publicToken: string;
  publicUrl: string;
  validUntil: string;
  lineItems: (QuoteLineItem & { id: string })[];
  discount: QuoteDiscount;
  taxRate: number;
  totals: {
    subtotalCents: number;
    discountCents: number;
    taxCents: number;
    totalCents: number;
  } | null;
  terms: string;
  scopeSummary: string;
  sentAt: string | null;
  firstViewedAt: string | null;
  respondedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; quote: PublicQuote };

function App() {
  const token = quoteTokenFromPath();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [action, setAction] = useState<"accept" | "decline" | null>(null);

  useEffect(() => {
    let canceled = false;

    async function load() {
      if (!token) {
        setState({ kind: "error", message: "This quote link is missing a token." });
        return;
      }

      try {
        const quote = await api<PublicQuote>(`/public/quotes/${encodeURIComponent(token)}`);
        if (!canceled) {
          setState({ kind: "ready", quote });
        }
      } catch {
        if (!canceled) {
          setState({ kind: "error", message: "This quote could not be opened. Ask the sender for a fresh link." });
        }
      }
    }

    void load();
    return () => {
      canceled = true;
    };
  }, [token]);

  async function respond(responseAction: "accept" | "decline") {
    if (state.kind !== "ready" || action !== null) {
      return;
    }

    setAction(responseAction);

    try {
      const quote = await api<PublicQuote>(`/public/quotes/${encodeURIComponent(state.quote.publicToken)}/respond`, {
        method: "POST",
        body: JSON.stringify({ action: responseAction })
      });
      setState({ kind: "ready", quote });
    } catch {
      window.alert("We could not save your response. Please try again.");
    } finally {
      setAction(null);
    }
  }

  if (state.kind === "loading") {
    return <Shell><Centered title="Opening quote" body="Loading the proposal..." /></Shell>;
  }

  if (state.kind === "error") {
    return <Shell><Centered title="Quote unavailable" body={state.message} /></Shell>;
  }

  const quote = state.quote;

  return (
    <Shell>
      <main className="quote-card" aria-label="Quote">
        <header className="quote-header">
          <BrandMark org={quote.org} />
          <div>
            <p className="eyebrow">Quote from</p>
            <h1>{quote.org.name}</h1>
            <p>{contactLine(quote.org)}</p>
          </div>
        </header>

        <div className="quote-meta">
          <Meta label="Quote" value={`#${quote.id.slice(0, 4).toUpperCase()}`} />
          <Meta label="Issued" value={formatDate(quote.sentAt ?? quote.createdAt)} />
          <Meta label="Valid Until" value={formatDate(quote.validUntil)} />
        </div>

        <section className="customer-section">
          <p className="section-label">Prepared for</p>
          <h2>{quote.customer?.name ?? "Customer"}</h2>
          <p>{quote.address}</p>
        </section>

        <section>
          <p className="section-label">Scope of work</p>
          <p className="scope">{quote.scopeSummary || quote.jobTitle || "Work described in the line items below."}</p>
        </section>

        <section className="lines">
          <div className="lines-heading">
            <p className="section-label">Line items</p>
            <span>{quote.lineItems.length} {quote.lineItems.length === 1 ? "line" : "lines"}</span>
          </div>
          {quote.lineItems.map((line) => (
            <div className="line-row" key={line.id}>
              <div>
                <strong>{line.description}</strong>
                <span>{describeQuantity(line.quantity, line.unit)}</span>
              </div>
              <strong>{line.unitPriceCents === null ? "$--" : formatMoney(Math.round(line.quantity * line.unitPriceCents))}</strong>
            </div>
          ))}
        </section>

        <section className="totals">
          <TotalRow label="Subtotal" value={formatMoney(quote.totals?.subtotalCents ?? null)} />
          {quote.totals && quote.totals.discountCents > 0 ? (
            <TotalRow label="Discount" value={`-${formatMoney(quote.totals.discountCents)}`} />
          ) : null}
          <TotalRow label={`Tax (${Math.round(quote.taxRate * 100)}%)`} value={formatMoney(quote.totals?.taxCents ?? null)} />
          <TotalRow strong label="Total" value={formatMoney(quote.totals?.totalCents ?? null)} />
        </section>

        <section className="terms">
          <strong>Terms.</strong> {quote.terms}
        </section>

        <ResponsePanel quote={quote} action={action} onRespond={respond} />
      </main>
      <p className="footnote">No account needed. Questions? Reply to the email.</p>
    </Shell>
  );
}

function ResponsePanel(props: {
  quote: PublicQuote;
  action: "accept" | "decline" | null;
  onRespond: (action: "accept" | "decline") => Promise<void>;
}) {
  if (props.quote.status === "accepted") {
    return (
      <div className="response-wrap">
        <div className="response accepted">
          <strong>Quote accepted</strong>
          <span>The sender has been notified.</span>
        </div>
      </div>
    );
  }

  if (props.quote.status === "declined") {
    return (
      <div className="response-wrap">
        <div className="response declined">
          <strong>Quote declined</strong>
          <span>The sender has been notified.</span>
        </div>
      </div>
    );
  }

  const expired = new Date() > new Date(`${props.quote.validUntil}T23:59:59`);

  if (expired) {
    return (
      <div className="response-wrap">
        <div className="response declined">
          <strong>Quote expired</strong>
          <span>Ask the sender for a revised quote.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="response-wrap">
      <div className="actions">
        <button className="accept" disabled={props.action !== null} onClick={() => void props.onRespond("accept")}>
          {props.action === "accept" ? "Accepting..." : "Accept quote"}
        </button>
        <button className="decline" disabled={props.action !== null} onClick={() => void props.onRespond("decline")}>
          {props.action === "decline" ? "Declining..." : "Decline"}
        </button>
      </div>
      <p className="action-note">Accepting or declining notifies the sender immediately.</p>
    </div>
  );
}

function Shell(props: { children: ReactNode }) {
  return <div className="page">{props.children}</div>;
}

function Centered(props: { title: string; body: string }) {
  return (
    <main className="centered">
      <div className="brand-mark large">QV</div>
      <h1>{props.title}</h1>
      <p>{props.body}</p>
    </main>
  );
}

function Meta(props: { label: string; value: string }) {
  return (
    <div>
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

function BrandMark(props: { org: PublicOrg }) {
  if (props.org.logoUrl) {
    return <img alt="" className="brand-mark image" src={props.org.logoUrl} />;
  }

  return <div className="brand-mark">{initials(props.org.name)}</div>;
}

function TotalRow(props: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={props.strong ? "total-row strong" : "total-row"}>
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }

  return await response.json() as T;
}

function quoteTokenFromPath() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  return parts[0] === "q" ? parts[1] ?? "" : "";
}

function formatMoney(cents: number | null) {
  if (cents === null) return "$--";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(cents / 100);
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(iso));
}

function describeQuantity(quantity: number, unit: string | null) {
  const qty = Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(1);
  if (unit === null) return qty;
  if (unit === "each") return `${qty} each`;
  if (unit === "flat") return "Flat";
  if (unit === "sqft") return `${qty} sq ft`;
  if (unit === "lnft") return `${qty} linear ft`;
  return `${qty} ${quantity === 1 ? unit : `${unit}s`}`;
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "QV";
}

function contactLine(org: PublicOrg) {
  return [org.contactPhone, org.website].filter(Boolean).join(" - ") || "Prepared with QuoteVan";
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
