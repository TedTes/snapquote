import type { QuoteDiscount, QuoteLineItem, QuoteStatus, TradeId } from "@snapquote/shared";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

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
  payment?: {
    status: "not_requested" | "checkout_created" | "paid" | "failed" | "refunded";
    depositPercent: number;
    depositAmountCents: number | null;
    paidAmountCents: number;
    currency: string;
    paidAt: string | null;
    checkoutSessionId: string | null;
    providerConnected: boolean;
  };
  createdAt: string;
  updatedAt: string;
};

type PublicPaymentStart = {
  provider: "stripe";
  checkoutUrl: string;
  sessionId: string;
  amountCents: number;
  currency: string;
};

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; quote: PublicQuote };

type PaymentNotice = "paid" | "cancelled" | null;

export function QuotePage(props: { token: string }) {
  const { token } = props;
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [action, setAction] = useState<"accept" | "decline" | null>(null);
  const [paymentAction, setPaymentAction] = useState<"starting" | "confirming" | null>(null);
  const [paymentNotice, setPaymentNotice] = useState<PaymentNotice>(null);

  useEffect(() => {
    let canceled = false;

    async function load() {
      if (!token) {
        setState({ kind: "error", message: "This quote link is missing a token." });
        return;
      }

      try {
        const urlParams = new URLSearchParams(window.location.search);
        const paymentSessionId = urlParams.get("session_id");
        const paymentState = urlParams.get("payment");
        let quote = await api<PublicQuote>(`/public/quotes/${encodeURIComponent(token)}`);

        if (paymentState === "success" && paymentSessionId) {
          setPaymentAction("confirming");
          quote = await api<PublicQuote>(`/public/quotes/${encodeURIComponent(token)}/pay/confirm`, {
            method: "POST",
            body: JSON.stringify({ sessionId: paymentSessionId })
          });
          setPaymentNotice("paid");
          window.history.replaceState({}, document.title, window.location.pathname);
        } else if (paymentState === "cancelled") {
          setPaymentNotice("cancelled");
          window.history.replaceState({}, document.title, window.location.pathname);
        }

        if (!canceled) {
          setState({ kind: "ready", quote });
          setPaymentAction(null);
          if (urlParams.get("print") === "1") {
            window.setTimeout(() => window.print(), 350);
          }
        }
      } catch {
        if (!canceled) {
          setState({ kind: "error", message: "This quote could not be opened. Ask the sender for a fresh link." });
          setPaymentAction(null);
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

  async function startDepositPayment() {
    if (state.kind !== "ready" || paymentAction !== null) {
      return;
    }

    setPaymentAction("starting");

    try {
      const payment = await api<PublicPaymentStart>(`/public/quotes/${encodeURIComponent(state.quote.publicToken)}/pay`, {
        method: "POST",
        body: JSON.stringify({})
      });
      window.location.assign(payment.checkoutUrl);
    } catch {
      window.alert("Online deposit payment is not available for this quote yet. Please reply to the email.");
      setPaymentAction(null);
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

        <PaymentNoticeBanner notice={paymentNotice} quote={quote} />

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
              <strong>{line.unitPriceCents === null ? "$--" : formatMoney(Math.round(line.quantity * line.unitPriceCents), quoteCurrency(quote))}</strong>
            </div>
          ))}
        </section>

        <section className="totals">
          <TotalRow label="Subtotal" value={formatMoney(quote.totals?.subtotalCents ?? null, quoteCurrency(quote))} />
          {quote.totals && quote.totals.discountCents > 0 ? (
            <TotalRow label="Discount" value={`-${formatMoney(quote.totals.discountCents, quoteCurrency(quote))}`} />
          ) : null}
          <TotalRow label={`Tax (${Math.round(quote.taxRate * 100)}%)`} value={formatMoney(quote.totals?.taxCents ?? null, quoteCurrency(quote))} />
          <TotalRow strong label="Total" value={formatMoney(quote.totals?.totalCents ?? null, quoteCurrency(quote))} />
        </section>

        <section className="terms">
          <strong>Terms.</strong> {quote.terms}
        </section>

        <PaymentPanel quote={quote} action={paymentAction} onPay={startDepositPayment} />
        <ResponsePanel quote={quote} action={action} onRespond={respond} />
      </main>
      <p className="footnote">No account needed. Questions? Reply to the email.</p>
    </Shell>
  );
}

function depositAmountCents(quote: PublicQuote) {
  const payment = quote.payment;
  const totalCents = quote.totals?.totalCents ?? null;

  if (!payment || totalCents === null) {
    return null;
  }

  return payment.depositAmountCents ?? Math.round(totalCents * (payment.depositPercent / 100));
}

function remainingBalanceCents(quote: PublicQuote) {
  const totalCents = quote.totals?.totalCents ?? null;

  if (totalCents === null) {
    return null;
  }

  return Math.max(0, totalCents - (quote.payment?.paidAmountCents ?? 0));
}

function quoteCurrency(quote: PublicQuote) {
  return quote.payment?.currency ?? "USD";
}

function quoteIsExpired(quote: PublicQuote) {
  return new Date() > new Date(`${quote.validUntil}T23:59:59`);
}

function PaymentNoticeBanner(props: { notice: PaymentNotice; quote: PublicQuote }) {
  if (props.quote.payment?.status === "paid") {
    return (
      <section className="quote-notice paid">
        <strong>Quote accepted, deposit paid.</strong>
        <span>Receipt sent. The service provider has been notified.</span>
      </section>
    );
  }

  if (props.notice === "cancelled") {
    return (
      <section className="quote-notice muted">
        <strong>Payment was cancelled.</strong>
        <span>Your quote is still available. You can pay the deposit when ready.</span>
      </section>
    );
  }

  return null;
}

function PaymentPanel(props: {
  quote: PublicQuote;
  action: "starting" | "confirming" | null;
  onPay: () => Promise<void>;
}) {
  const payment = props.quote.payment;
  const totalCents = props.quote.totals?.totalCents ?? null;
  const depositAmount = depositAmountCents(props.quote);
  const currency = quoteCurrency(props.quote);

  if (!payment || totalCents === null || depositAmount === null || depositAmount <= 0) {
    return null;
  }

  if (payment.status === "paid") {
    const remaining = remainingBalanceCents(props.quote);

    return (
      <section className="payment-panel paid">
        <div>
          <p className="section-label">Deposit</p>
          <strong>{formatMoney(payment.paidAmountCents, currency)} paid</strong>
          <span>{remaining === null ? "Receipt sent. The sender has been notified." : `${formatMoney(remaining, currency)} remaining. Receipt sent.`}</span>
        </div>
      </section>
    );
  }

  if (!payment.providerConnected) {
    return (
      <section className="payment-panel muted">
        <div>
          <p className="section-label">Deposit</p>
          <strong>{formatMoney(depositAmount, currency)} due to schedule</strong>
          <span>Online payment is not enabled yet. Reply to the email to arrange payment.</span>
        </div>
      </section>
    );
  }

  if (props.quote.status === "declined" || props.quote.status === "expired" || props.quote.status === "superseded" || quoteIsExpired(props.quote)) {
    return null;
  }

  if (props.quote.status !== "accepted") {
    return (
      <section className="payment-panel muted">
        <div>
          <p className="section-label">Deposit</p>
          <strong>{formatMoney(depositAmount, currency)} due to schedule</strong>
          <span>Accept the quote first, then pay online. Secure payment by Stripe.</span>
        </div>
      </section>
    );
  }

  const buttonLabel = props.action === "confirming"
    ? "Confirming payment..."
    : props.action === "starting"
      ? "Opening secure checkout..."
      : `Pay ${formatMoney(depositAmount, currency)} deposit`;

  return (
    <section className="payment-panel">
      <div>
        <p className="section-label">Deposit</p>
        <strong>{formatMoney(depositAmount, currency)} due to schedule</strong>
        <span>Secure payment by Stripe. Apple Pay, Google Pay, Link, and cards are available when supported.</span>
      </div>
      <button disabled={props.action !== null} onClick={() => void props.onPay()}>{buttonLabel}</button>
    </section>
  );
}

function ResponsePanel(props: {
  quote: PublicQuote;
  action: "accept" | "decline" | null;
  onRespond: (action: "accept" | "decline") => Promise<void>;
}) {
  if (props.quote.status === "accepted") {
    const paid = props.quote.payment?.status === "paid";

    return (
      <div className="response-wrap">
        <div className="response accepted">
          <strong>{paid ? "Quote accepted and deposit paid" : "Quote accepted"}</strong>
          <span>{paid ? "Receipt sent. The sender has been notified." : "The sender has been notified. You can pay the deposit above."}</span>
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

  const expired = quoteIsExpired(props.quote);

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

function formatMoney(cents: number | null, currency = "USD") {
  if (cents === null) return "$--";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: normalizeCurrencyCode(currency),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(cents / 100);
}

function normalizeCurrencyCode(currency: string) {
  const normalized = currency.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : "USD";
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
