import { useEffect, useRef, useState } from "react";
import { contactEmails, mailtoUrl } from "../contact";
import { ProductFlowDemo } from "./components/demo/ProductFlowDemo";
import { ProgressMeter, QuoteVanMark, StatusPill } from "./components/demo/primitives";
import "./landing.css";

const helloMailto = mailtoUrl(contactEmails.hello, { subject: "QuoteVan early access" });

export function LandingPage() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <a aria-label="QuoteVan home" className="landing-brand" href="/">
            <QuoteVanMark className="landing-brand-mark" size={34} />
            <span>QuoteVan</span>
          </a>
          <nav aria-label="Landing page" className="landing-nav-links">
            <a href="#trust">Customer email</a>
            <a href="#how">How it works</a>
            <a href="#customer">Customer view</a>
            <a href="#book">Price book</a>
          </nav>
          <a className="btn btn-primary btn-small" href={helloMailto}>Get started</a>
        </div>
      </header>

      <main>
        <section className="hero" id="flow">
          <div className="hero-copy">
            <p className="landing-eyebrow">QuoteVan for field-service providers</p>
            <h1>Quote the job before you leave it.</h1>
            <p className="landing-lede">
              Walk the job, capture the scope, and send a professional quote with prices from your own book.
            </p>
            <StoreBadges />
          </div>

          <div className="hero-demo" aria-label="QuoteVan provider quote creation flow">
            <ProductFlowDemo />
          </div>
        </section>

        <section className="email-dashboard-section" id="trust">
          <div className="landing-story-wire" aria-hidden="true">
            <svg viewBox="0 0 1120 260" preserveAspectRatio="none">
              <path
                d="M890 8 C 796 38 835 82 752 105 C 648 134 673 184 548 210 C 492 222 438 218 386 236"
              />
              <path
                className="wire-echo"
                d="M932 34 C 824 65 835 115 747 136 C 642 162 642 205 520 228 C 466 238 417 236 362 250"
              />
              <circle className="wire-dot wire-dot-1" cx="826" cy="43" r="3.2" />
              <circle className="wire-dot wire-dot-2" cx="728" cy="116" r="2.4" />
              <circle className="wire-dot wire-dot-3" cx="620" cy="187" r="2.8" />
              <circle className="wire-dot wire-dot-4" cx="464" cy="228" r="2.3" />
            </svg>
          </div>
          <div className="email-dashboard-layout">
            <EmailDashboardPreview />
            <div className="section-copy email-section-copy">
              <h2>The quote lands where customers already are.</h2>
              <p>
                Send a private quote link by email. Customers open the proposal in a browser, accept or decline, and
                reply with questions.
              </p>
              <p className="email-no-install">
                <span aria-hidden="true">✓</span> Nothing to install — it opens in any browser
              </p>
            </div>
          </div>
        </section>

        <section className="how-section" id="how">
          <div className="section-copy is-centered">
            <p className="landing-eyebrow">How it works</p>
            <h2>Checklist. Talk it through. Send.</h2>
          </div>
          <ol className="how-rail" aria-label="Three steps from job walkthrough to sent quote">
            <HowStep index="01" title="Walk the job" text="Capture details, rooms, and quantities." />
            <HowStep index="02" title="Review the quote" text="Lines match your price book." />
            <HowStep index="03" title="Send and track" text="See when it's viewed or accepted." />
          </ol>
        </section>

        <section className="customer-section" id="customer">
          <div className="section-copy">
            <p className="landing-eyebrow">Customer experience</p>
            <h2>A clean quote page your customer can act on.</h2>
            <p>
              They open the private link, review the scope, accept or decline, and pay a deposit when payments are
              enabled.
            </p>
            <ul className="customer-proof-list">
              <li><span aria-hidden="true">✓</span> No customer account required</li>
              <li><span aria-hidden="true">✓</span> Accept / decline in browser</li>
              <li><span aria-hidden="true">✓</span> Deposit-ready when payments are enabled</li>
            </ul>
          </div>
          <CustomerQuoteCard />
        </section>

        <section className="book-section" id="book">
          <PriceBookScreen />
          <div className="section-copy">
            <p className="landing-eyebrow">Price book flywheel</p>
            <h2>Confirm a price once. Reuse it every quote.</h2>
            <p>
              The first few quotes train your personal price book. After that, common work matches automatically and
              every quote gets faster without letting AI invent prices.
            </p>
          </div>
        </section>

        <section className="audience-section">
          <div className="audience-inner">
            <div className="section-copy is-centered">
              <p className="landing-eyebrow">Built for small service teams</p>
              <h2>Purpose-built for quoting, not another CRM to manage.</h2>
              <p>For field-service pros who need to quote before the customer moves on.</p>
            </div>

            <ul className="audience-points" aria-label="QuoteVan is lighter than a CRM">
              <li>No pipelines to maintain</li>
              <li>No contacts to import</li>
              <li>No setup weekend</li>
            </ul>

            <AudienceExamples />
          </div>
        </section>

        <section className="final-cta">
          <div className="final-cta-card">
            <p className="landing-eyebrow">Ready to quote faster</p>
            <h2>Finish the quote before you get back in the van.</h2>
            <p>
              Build clean, customer-ready quotes with prices you control — right there on site.
            </p>
            <a className="final-cta-button" href={helloMailto}>
              <span className="final-cta-button-icon" aria-hidden="true" />
              <span className="final-cta-button-label">Start your first quote free</span>
            </a>
            <div className="final-cta-trust">
              <span>No card to start</span>
              <span>Works on your phone</span>
            </div>
            <p className="final-cta-support">
              Questions? <a href={helloMailto}>Talk to a real person</a>
            </p>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-copy">
            <span className="landing-footer-brand">QuoteVan</span>
            <p className="landing-footer-note">Customer quote links are private by URL.</p>
          </div>
          <nav className="landing-footer-links">
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="/account-deletion">Account deletion</a>
            <a href="/support">Support</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function HowStep(props: { index: string; title: string; text: string }) {
  return (
    <li>
      <span className="how-rail-index">{props.index}</span>
      <div>
        <strong>{props.title}</strong>
        <p>{props.text}</p>
      </div>
    </li>
  );
}

function EmailDashboardPreview() {
  const dashboardRef = useRef<HTMLDivElement | null>(null);
  const [isInView, setIsInView] = useState(false);
  const rows = [
    {
      sender: "Bright Coat Painting",
      via: "QuoteVan",
      subject: "Your quote is ready",
      preview: "Michael, your quote is ready to view",
      time: "Now",
      important: true,
    },
    {
      sender: "Riverbend Supply",
      subject: "Paint order ready for pickup",
      preview: "Your contractor order is staged at the front counter.",
      time: "9:18 AM",
    },
    {
      sender: "Maya Chen",
      subject: "Re: hallway repaint",
      preview: "Thanks, can you send the estimate when you have it?",
      time: "8:42 AM",
    },
    {
      sender: "Calendar",
      subject: "Tomorrow: exterior touch-up walkthrough",
      preview: "Reminder for 10:30 AM with Daniel Ortega.",
      time: "Yesterday",
    },
    {
      sender: "Northline Hardware",
      subject: "Receipt for primer and tape",
      preview: "Your purchase receipt and warranty information.",
      time: "Jul 25",
    },
    {
      sender: "Avery Brooks",
      subject: "Front door paint color",
      preview: "We decided on the darker green you showed us.",
      time: "Jul 24",
    },
  ];

  useEffect(() => {
    const node = dashboardRef.current;

    if (!node) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(Boolean(entry?.isIntersecting));
      },
      { threshold: 0.35 },
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={isInView ? "email-dashboard is-in-view" : "email-dashboard"}
      ref={dashboardRef}
      aria-label="Customer inbox showing a new quote email from Bright Coat Painting"
    >
      <div className="email-topbar">
        <div className="email-menu" aria-hidden="true"><span /></div>
        <div className="email-logo" aria-hidden="true">
          <svg fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
            <rect height="14" rx="2.5" width="19" x="2.5" y="5" />
            <path d="M3.5 6.5 12 13 20.5 6.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>Mail</span>
        </div>
        <div className="email-search">Search mail</div>
        <div className="email-top-actions" aria-hidden="true">
          <span />
          <span />
          <b>MC</b>
        </div>
      </div>
      <div className="email-main">
        <div className="email-toolbar">
          <span className="email-checkbox" />
          <span>Primary</span>
          <small>1 new</small>
        </div>
        <div className="email-tabs" aria-hidden="true">
          <span className="is-active">Primary</span>
          <span>Updates</span>
          <span>Promotions</span>
        </div>
        <div className="email-list">
          {rows.map((row) => (
            <article className={row.important ? "email-row is-quote" : "email-row"} key={`${row.sender}-${row.subject}`}>
              <span className="email-checkbox" />
              <strong>
                {row.sender}
                {row.via ? <span className="email-row-via">via {row.via}</span> : null}
              </strong>
              <p><b>{row.subject}</b> <span>- {row.preview}</span></p>
              <span className="email-row-end">
                <time>{row.time}</time>
              </span>
            </article>
          ))}
        </div>
      </div>
      <div className="email-quote-pop" aria-hidden="true">
        <QuoteVanMark size={24} />
        <div>
          <strong>New quote received</strong>
          <span>Private quote link from Bright Coat Painting</span>
        </div>
      </div>
    </div>
  );
}

function PriceBookScreen() {
  return (
    <article className="price-book-screen" aria-label="QuoteVan price book screen preview">
      <header className="price-book-screen-head">
        <div>
          <h3>Price book</h3>
          <span>11 items</span>
        </div>
        <button type="button" aria-label="Add price book item">+</button>
      </header>

      <section className="price-book-strength-card">
        <div>
          <span className="landing-eyebrow">Book strength</span>
          <strong>8 of 11 confirmed</strong>
        </div>
        <ProgressMeter confirmed={8} total={11} />
      </section>

      <section className="price-book-list-section">
        <div className="price-book-list-title">
          <span>Active - matches green</span>
          <b>8</b>
        </div>
        <div className="price-book-group is-active">
          <PriceBookRow title="Paint walls" detail="Per room · S $294 · L $672" price="$420" tone="active" />
          <PriceBookRow title="Paint ceiling" detail="Per room · S $126 · L $288" price="$180" tone="active" />
          <PriceBookRow title="Paint trim" detail="Per room · S $112 · L $256" price="$160" tone="active" />
          <PriceBookRow title="Paint door" detail="Each" price="$95" tone="active" />
        </div>
      </section>

      <section className="price-book-list-section">
        <div className="price-book-list-title">
          <span>Starters to confirm</span>
          <b>3</b>
        </div>
        <div className="price-book-group is-starter">
          <PriceBookRow title="Patch nail holes" detail="Per room · S $35 · L $75" price="$50" tone="starter" />
          <PriceBookRow title="Primer coat" detail="Per room · S $80 · L $180" price="$120" tone="starter" />
        </div>
      </section>
    </article>
  );
}

function PriceBookRow(props: { title: string; detail: string; price: string; tone: "active" | "starter" }) {
  return (
    <div className={`price-book-row is-${props.tone}`}>
      <span className="price-book-row-stripe" aria-hidden="true" />
      <span className="price-book-row-copy">
        <strong>{props.title}</strong>
        <small>{props.detail}</small>
      </span>
      <b>{props.price}</b>
      <i aria-hidden="true">›</i>
    </div>
  );
}

const audienceTrades = {
  painters: {
    chipLabel: "Painters",
    cardLabel: "A painter's quote",
    total: "$1,932",
    lines: [
      { title: "Paint walls", detail: "2 medium rooms · 2 coats", price: "$840" },
      { title: "Paint ceilings", detail: "2 rooms", price: "$360" },
      { title: "Paint trim", detail: "2 rooms", price: "$320" },
      { title: "Paint 2 doors", detail: "each", price: "$190" },
    ],
  },
  cleaners: {
    chipLabel: "Cleaners",
    cardLabel: "A cleaner's quote",
    total: "$490",
    lines: [
      { title: "Deep clean kitchen", detail: "1 visit", price: "$180" },
      { title: "Deep clean bathrooms", detail: "2 baths", price: "$150" },
      { title: "Interior windows", detail: "12 panes", price: "$90" },
      { title: "Fridge + oven detail", detail: "add-on", price: "$70" },
    ],
  },
  handymen: {
    chipLabel: "Handymen",
    cardLabel: "A handyman's quote",
    total: "$415",
    lines: [
      { title: "Drywall patch repair", detail: "2 spots", price: "$120" },
      { title: "Replace door hardware", detail: "3 doors", price: "$85" },
      { title: "Mount shelving", detail: "4 shelves", price: "$150" },
      { title: "Caulk and seal", detail: "kitchen + bath", price: "$60" },
    ],
  },
  fencing: {
    chipLabel: "Fencing",
    cardLabel: "A fencing quote",
    total: "$1,205",
    lines: [
      { title: "Replace fence panels", detail: "6 panels", price: "$560" },
      { title: "Reset posts", detail: "3 posts", price: "$240" },
      { title: "Gate hardware", detail: "1 gate", price: "$95" },
      { title: "Stain and seal", detail: "60 linear ft", price: "$310" },
    ],
  },
} as const satisfies Record<string, { chipLabel: string; cardLabel: string; total: string; lines: { title: string; detail: string; price: string }[] }>;

type AudienceTradeKey = keyof typeof audienceTrades;

function AudienceExamples() {
  const [trade, setTrade] = useState<AudienceTradeKey>("painters");

  return (
    <>
      <div className="audience-chips" aria-label="See an example quote by trade">
        {(Object.keys(audienceTrades) as AudienceTradeKey[]).map((key) => (
          <button
            aria-pressed={key === trade}
            className={key === trade ? "is-active" : undefined}
            key={key}
            onClick={() => setTrade(key)}
            type="button"
          >
            {audienceTrades[key].chipLabel}
          </button>
        ))}
      </div>
      <AudienceQuoteCard key={trade} trade={audienceTrades[trade]} />
    </>
  );
}

function AudienceQuoteCard(props: { trade: (typeof audienceTrades)[AudienceTradeKey] }) {
  const { trade } = props;

  return (
    <article aria-label={`Example ${trade.cardLabel.toLowerCase()}, priced from the price book`} className="audience-quote-card">
      <p className="landing-eyebrow">{trade.cardLabel}</p>
      <div className="audience-quote-lines">
        {trade.lines.map((line) => (
          <div className="audience-quote-line" key={line.title}>
            <span className="audience-quote-stripe" aria-hidden="true" />
            <span>
              <strong>{line.title}</strong>
              <small>{line.detail}</small>
            </span>
            <b>{line.price}</b>
          </div>
        ))}
      </div>
      <footer>
        <span>Total · priced from your book</span>
        <strong>{trade.total}</strong>
      </footer>
    </article>
  );
}

function CustomerQuoteCard() {
  return (
    <article className="customer-quote-card">
      <header>
        <QuoteVanMark size={36} framed />
        <div>
          <span>Quote from</span>
          <strong>Bright Coat Painting</strong>
          <p>(416) 555-0148 · quotes@brightcoat.co</p>
        </div>
        <StatusPill tone="viewed">Viewed</StatusPill>
      </header>
      <div className="customer-quote-meta">
        <span><b>Quote</b>#1024</span>
        <span><b>Issued</b>Jul 26</span>
        <span><b>Valid until</b>Aug 7</span>
      </div>
      <section className="customer-quote-party">
        <b>Prepared for</b>
        <p><strong>Michael</strong> · 18 Victor Ave, Toronto</p>
      </section>
      <section className="customer-quote-scope">
        <b>Scope of work</b>
        <p>
          Interior repaint for two medium rooms: walls, ceilings, trim, and two doors. Standard prep and two coats
          included.
        </p>
      </section>
      <div className="customer-quote-table" role="presentation">
        <div className="customer-quote-table-head">
          <span>Description</span>
          <span>Amount</span>
        </div>
        <QuotePreviewLine title="Paint walls" detail="2 medium rooms · 2 coats · $420/room" price="$840" />
        <QuotePreviewLine title="Paint ceilings" detail="2 rooms · $180/room" price="$360" />
        <QuotePreviewLine title="Paint trim" detail="2 rooms · $160/room" price="$320" />
        <QuotePreviewLine title="Paint 2 doors" detail="2 each · $95/door" price="$190" />
      </div>
      <div className="customer-quote-summary">
        <span>Subtotal</span>
        <b>$1,710</b>
        <span>Tax (13%)</span>
        <b>$222</b>
        <strong>Total</strong>
        <strong>$1,932</strong>
      </div>
      <div className="customer-quote-terms">
        <p><b>Terms.</b> 50% deposit (<span>$966</span>) to schedule the job — balance due on completion.</p>
      </div>
      <div className="customer-quote-actions">
        <button type="button">Accept quote</button>
        <button type="button">Decline</button>
      </div>
      <small>Private link · quotevan.app/q/8f2a1c</small>
    </article>
  );
}

function QuotePreviewLine(props: { title: string; detail: string; price: string }) {
  return (
    <div className="customer-quote-line">
      <span>
        <strong>{props.title}</strong>
        <small>{props.detail}</small>
      </span>
      <b>{props.price}</b>
    </div>
  );
}

function StoreBadges() {
  return (
    <div aria-label="QuoteVan mobile app availability" className="store-badges">
      <span aria-label="QuoteVan iOS app status" className="store-badge">
        <span aria-hidden="true" className="store-badge-icon store-badge-icon-apple">
          <svg viewBox="0 0 18 22">
            <path d="M14.8 11.6c0-2.4 2-3.6 2.1-3.7-1.1-1.6-2.8-1.9-3.4-1.9-1.4-.1-2.7.8-3.5.8-.7 0-1.9-.8-3.1-.8-1.6 0-3.1.9-3.9 2.4-1.7 2.9-.4 7.2 1.2 9.6.8 1.2 1.8 2.5 3.1 2.4 1.2 0 1.7-.8 3.1-.8s1.8.8 3.1.8c1.3 0 2.1-1.2 2.9-2.3.9-1.3 1.2-2.6 1.3-2.7 0 0-2.9-1.1-2.9-3.8ZM12.6 4.5c.7-.8 1.1-1.9 1-3-.9 0-2 .6-2.7 1.4-.6.7-1.1 1.8-1 2.9 1 .1 2-.5 2.7-1.3Z" />
          </svg>
        </span>
        <span>
          <small>App Store</small>
          <strong>Coming soon</strong>
        </span>
      </span>
      <span aria-label="QuoteVan Android app status" className="store-badge">
        <span aria-hidden="true" className="store-badge-icon store-badge-icon-play">
          <svg viewBox="0 0 22 24">
            <path d="M2.1 1.1c-.4.3-.6.9-.6 1.6v18.6c0 .7.2 1.3.7 1.6l10.6-10.9L2.1 1.1Z" />
            <path d="m16.2 8.2-3.4 3.8 3.4 3.8 3.7-2.1c1.2-.7 1.2-2.4 0-3.1l-3.7-2.4Z" />
            <path d="m12.8 12-10.6 10.9c.5.3 1.1.3 1.8-.1l12.2-7-3.4-3.8Z" />
            <path d="M16.2 8.2 4 1.2C3.3.8 2.6.8 2.1 1.1L12.8 12l3.4-3.8Z" />
          </svg>
        </span>
        <span>
          <small>Google Play</small>
          <strong>Coming soon</strong>
        </span>
      </span>
    </div>
  );
}
