import { useEffect, useRef, useState } from "react";
import { contactEmails, mailtoUrl } from "../contact";
import { ProductFlowDemo } from "./components/demo/ProductFlowDemo";
import { ProgressMeter, QuoteVanMark, StatusPill } from "./components/demo/primitives";
import "./landing.css";

const helloMailto = mailtoUrl(contactEmails.hello, { subject: "QuoteVan early access" });

export function LandingPage() {
  const landingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = landingRef.current;
    if (!root) return;

    const sections = Array.from(root.querySelectorAll<HTMLElement>("[data-animate-section]"));
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    root.classList.add("motion-ready");

    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      sections.forEach((section) => section.classList.add("is-active"));
      return () => root.classList.remove("motion-ready");
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => entry.target.classList.toggle("is-active", entry.isIntersecting));
      },
      { rootMargin: "-12% 0px -16%", threshold: 0.12 },
    );

    const frame = window.requestAnimationFrame(() => {
      sections.forEach((section) => observer.observe(section));
    });

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      root.classList.remove("motion-ready");
    };
  }, []);

  return (
    <div className="landing" ref={landingRef}>
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <a aria-label="QuoteVan home" className="landing-brand" href="/">
            <QuoteVanMark className="landing-brand-mark" size={34} />
            <span>QuoteVan</span>
          </a>
          <nav aria-label="Landing page" className="landing-nav-links">
            <a href="#how">How it works</a>
            <a href="#book">Price book</a>
            <a href="#customer">Customer view</a>
            <a href="#trades">Trades</a>
            <a href="#demo">App demo</a>
          </nav>
          <a className="btn btn-primary btn-small" href={helloMailto}>Request early access</a>
        </div>
      </header>

      <main>
        <section className="hero" id="flow" aria-label="QuoteVan hero" data-animate-section>
          <div className="copy">
            <p className="eyebrow">QuoteVan for painters and fencers</p>
            <h1>They request.<br />You quote before<br /><span>they call someone else.</span></h1>
            <p className="sub">Share one link. The request opens as a draft in the app — with photos.</p>
            <div className="cta-row">
              <a className="btn btn-dark" href={helloMailto}>Request early access</a>
              <a className="btn btn-store" href="https://apps.apple.com/us/app/quotevan/id6796754211">
                <span className="apple" aria-hidden="true">
                  <svg width="16" height="18" viewBox="0 0 16 18" fill="currentColor">
                    <path d="M13.2 9.4c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.2-2.8.8-3.5.8-.7 0-1.9-.8-3.1-.8-1.6 0-3.1 1-3.9 2.4-1.7 2.9-.4 7.2 1.2 9.6.8 1.1 1.8 2.4 3 2.4 1.2 0 1.6-.8 3.1-.8s1.8.8 3.1.8c1.3 0 2.1-1.2 2.9-2.3.9-1.3 1.3-2.5 1.3-2.6-.1 0-2.5-1-2.5-3.8zM11.1 2.8c.6-.8 1.1-1.9.9-3-.9 0-2 .6-2.6 1.4-.6.7-1.1 1.8-.9 2.9 1 .1 2-.5 2.6-1.3z" />
                  </svg>
                </span>
                <span><small>Download on the</small><b>App Store</b></span>
              </a>
            </div>
            <p className="fine">They use a browser. You use the app.</p>
          </div>

          <div className="stage">
            <article className="browser">
              <div className="chrome">
                <div className="dots" aria-hidden="true"><span /><span /><span /></div>
                <div className="url">
                  <svg className="lock" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
                    <rect x="2.5" y="5.5" width="7" height="5" rx="1.2" />
                    <path d="M4 5.5V3.8a2 2 0 0 1 4 0v1.7" />
                  </svg>
                  quotevan.com/p/brightcoat
                </div>
              </div>
              <div className="browser-body">
                <h2>Bright Coat Painting /<br />Request a quote.</h2>
                <div className="meta">
                  <div className="meta-row">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                      <path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11z" />
                      <circle cx="12" cy="10" r="2.3" />
                    </svg>
                    <span><small>Address</small><strong>18 Victor Ave</strong></span>
                  </div>
                  <div className="meta-row">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                      <path d="M4 20l7.5-7.5M14 6l4 4M8.5 15.5L6 18M15 5l4 4-9 9H6v-4l9-9z" />
                    </svg>
                    <span><small>Project</small><strong>Interior paint</strong></span>
                  </div>
                  <div className="meta-row">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                      <rect x="3" y="4" width="18" height="16" rx="2" />
                      <path d="M3 9h18M9 4v16" />
                    </svg>
                    <span><small>Scope</small><strong>2 rooms + hallway</strong></span>
                  </div>
                </div>
                <div className="photos-label">Photos</div>
                <div className="photos">
                  <img
                    src="/marketing/room-1.jpg"
                    alt="Empty room with hardwood floor"
                  />
                  <img
                    src="/marketing/room-2.jpg"
                    alt="Bright empty room with window"
                  />
                </div>
                <div className="submit" aria-hidden="true">Submit request</div>
              </div>
            </article>

            <aside className="phone" aria-label="iPhone lock screen">
              <div className="island" />
              <div className="status"><span>9:41</span><span>5G</span></div>
              <div className="lock-icon" aria-hidden="true">
                <svg width="14" height="16" viewBox="0 0 14 16" fill="none" stroke="#1d1c19" strokeWidth="1.5">
                  <rect x="2" y="7" width="10" height="8" rx="1.6" />
                  <path d="M4.2 7V4.6a2.8 2.8 0 0 1 5.6 0V7" />
                </svg>
              </div>
              <div className="clock">9:41</div>
              <div className="date">Tuesday, May 13</div>
              <div className="notif">
                <div className="notif-top">
                  <span className="qmark">Q</span>
                  <span>QuoteVan</span>
                  <em>now</em>
                </div>
                <strong>New quote request</strong>
                <p>18 Victor Ave · 2 rooms · 2 photos</p>
              </div>
            </aside>

            <div className="flow" aria-hidden="true">
              <svg className="flow-svg" viewBox="0 0 228 78" fill="none">
                <path className="flow-curve" d="M4 12 C58 72, 146 74, 222 20" />
                <path className="flow-head" d="M208 18 L223 20 L216 34" />
              </svg>
              <p className="flow-label">lands in the app</p>
            </div>
          </div>
        </section>

        <RequestLinkSection />

        <section className="book-section" id="book" data-animate-section>
          <PriceBookScreen />
          <div className="section-copy">
            <p className="landing-eyebrow">Your prices, not an estimate</p>
            <h2>Nothing reaches the customer until you approve it.</h2>
            <p>
              Requests open as drafts. QuoteVan matches confirmed items from your price book and blocks unknown work
              until you set the price.
            </p>
          </div>
        </section>

        <section className="email-delivery-section" data-animate-section>
          <div className="email-delivery-copy section-copy">
            <p className="landing-eyebrow">After you tap send</p>
            <h2>The finished quote arrives in their inbox.</h2>
            <p>
              QuoteVan emails the homeowner a private quote link. They open it in any browser to review the scope,
              accept or decline, and pay a deposit when enabled.
            </p>
            <p className="email-delivery-note"><span aria-hidden="true">✓</span> Drafts are never sent automatically</p>
          </div>
          <EmailDashboardPreview />
        </section>

        <section className="customer-section" id="customer" data-animate-section>
          <div className="section-copy">
            <p className="landing-eyebrow">Customer experience</p>
            <h2>Price the draft. Then send the private quote.</h2>
            <p>
              Customers review the scope, accept or decline, and pay a deposit in their browser after you choose to send.
            </p>
            <ul className="customer-proof-list">
              <li><span aria-hidden="true">✓</span> No customer account required</li>
              <li><span aria-hidden="true">✓</span> Accept or decline in browser</li>
              <li><span aria-hidden="true">✓</span> Deposit-ready when payments are enabled</li>
            </ul>
          </div>
          <CustomerQuoteCard />
        </section>

        <section className="audience-section" id="trades" data-animate-section>
          <div className="audience-inner">
            <div className="section-copy is-centered">
              <p className="landing-eyebrow">Separate trade kits</p>
              <h2>One quote engine. The right scope for each trade.</h2>
              <p>Painting keeps rooms, coats, and surfaces. Fencing keeps runs, posts, gates, and linear feet.</p>
            </div>

            <AudienceExamples />
          </div>
        </section>

        <section className="app-demo-section" id="demo" data-animate-section>
          <div className="app-demo-copy">
            <p className="landing-eyebrow">On the job</p>
            <h2>Walk the job. Review the draft. Send before you leave.</h2>
            <p>
              Follow the real provider workflow from customer and scope capture through price-book review, preview,
              and send.
            </p>
            <ol className="app-demo-steps" aria-label="QuoteVan app workflow">
              <li><span>01</span><strong>Capture the job</strong></li>
              <li><span>02</span><strong>Confirm your prices</strong></li>
              <li><span>03</span><strong>Send the quote</strong></li>
            </ol>
          </div>
          <div className="app-demo-visual" aria-label="Animated QuoteVan app demo">
            <span className="app-demo-live" aria-hidden="true"><i /> Live app flow</span>
            <ProductFlowDemo />
          </div>
        </section>

        <section className="final-cta" data-animate-section>
          <div className="final-cta-card">
            <p className="landing-eyebrow">quotevan.com/p/yourname</p>
            <h2>Give customers one place to start the quote.</h2>
            <p>
              Request early access and we’ll help set up your link, trade kit, and first price-book items.
            </p>
            <a className="final-cta-button" href={helloMailto}>
              <span className="final-cta-button-icon" aria-hidden="true" />
              <span className="final-cta-button-label">Request early access</span>
            </a>
            <div className="final-cta-trust">
              <span>quotevan.com/p/yourname</span>
              <span>Homeowner uses a browser</span>
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
            <p className="landing-footer-note">Quote links are available only to people who receive the URL.</p>
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

function RequestLinkSection() {
  return (
    <section className="request-link-section" id="how" data-animate-section>
      <div className="section-copy is-centered request-link-heading">
        <p className="landing-eyebrow">How it works</p>
        <h2>One link in. One draft ready to price.</h2>
        <p>Share the link anywhere. The homeowner sends the details, and the same job opens in QuoteVan.</p>
      </div>
      <div className="request-link-grid">
        <article className="public-page-card" aria-label="QuoteVan public request page">
          <div className="public-page-browser">
            <div className="public-page-bar" aria-hidden="true">
              <span /><span /><span />
              <b>quotevan.com/p/brightcoat</b>
            </div>
            <p className="landing-eyebrow">Your public request page</p>
            <h2>Bright Coat quote request</h2>
            <div className="public-page-form">
              <div className="public-page-toggle">
                <span className="is-active">Interior</span>
                <span>Exterior</span>
                <span>Fence</span>
              </div>
              <div className="public-page-field">
                <small>Name</small>
                <strong>Michael R.</strong>
              </div>
              <div className="public-page-field">
                <small>Phone</small>
                <strong>647-450-8736</strong>
              </div>
              <div className="public-page-field">
                <small>Email</small>
                <strong>michael@email.com</strong>
              </div>
              <div className="public-page-field">
                <small>Address</small>
                <strong>18 Victor Ave</strong>
              </div>
              <div className="public-page-field is-wide">
                <small>Task description</small>
                <strong>Paint 2 rooms and the hallway. Water stain on ceiling.</strong>
              </div>
              <div className="public-page-photo-field">
                <div><small>Photos</small><span>Optional</span></div>
                <div className="public-page-photos" aria-hidden="true">
                  <span className="has-photo"><img src="/marketing/room-1.jpg" alt="" /></span>
                  <span className="has-photo"><img src="/marketing/room-2.jpg" alt="" /></span>
                  <span className="add-photo">+</span>
                </div>
              </div>
              <div className="public-page-submit" aria-hidden="true">Request a quote</div>
            </div>
            <footer>Opens in any browser · no customer account</footer>
          </div>
        </article>

        <div className="request-link-handoff" aria-hidden="true">
          <span>→</span>
          <small>opens as a draft</small>
        </div>

        <article className="request-app-phone" aria-label="Request draft as seen in the QuoteVan mobile app">
          <div className="request-phone-hardware" aria-hidden="true">
            <span>9:41</span>
            <i />
            <span>5G</span>
          </div>
          <div className="request-phone-screen">
            <div className="request-phone-appbar">
              <span><QuoteVanMark size={22} /><strong>QuoteVan</strong></span>
              <b>Drafts</b>
            </div>
            <header>
              <div>
                <span className="landing-eyebrow">From your request link</span>
                <h2>Request draft</h2>
              </div>
              <span className="app-push-badge">New</span>
            </header>
            <div className="app-request-summary">
              <strong>18 Victor Ave, Toronto</strong>
              <span>2 photos · Interior repaint · Michael R.</span>
            </div>
            <div className="app-request-lines">
              <div><strong>Paint walls</strong><small>Suggested from request</small><span>Matched</span></div>
              <div><strong>Patch ceiling stain</strong><small>Needs review from photo</small><span>Confirm</span></div>
              <div><strong>Primer where needed</strong><small>Unpriced until you approve</small><span>Confirm</span></div>
            </div>
            <div className="app-pricing-note">
              <span aria-hidden="true">✓</span>
              <p><strong>You set the price.</strong> Nothing is shown to the customer until you send.</p>
            </div>
            <div className="app-request-actions">
              <span>Open draft</span>
              <span>Call</span>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}

function EmailDashboardPreview() {
  const rows = [
    {
      sender: "Bright Coat Painting",
      via: "QuoteVan",
      subject: "Your quote is ready",
      preview: "Michael, your private quote is ready to review",
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
      subject: "Tomorrow: exterior walkthrough",
      preview: "Reminder for 10:30 AM with Daniel Ortega.",
      time: "Yesterday",
    },
  ];

  return (
    <div className="email-dashboard" aria-label="Customer inbox showing a quote email from Bright Coat Painting">
      <div className="email-topbar">
        <span className="email-menu" aria-hidden="true"><i /></span>
        <div className="email-logo" aria-hidden="true">
          <svg fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
            <rect height="14" rx="2.5" width="19" x="2.5" y="5" />
            <path d="M3.5 6.5 12 13 20.5 6.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>Mail</span>
        </div>
        <div className="email-search">Search mail</div>
        <div className="email-avatar" aria-hidden="true">MR</div>
      </div>
      <div className="email-main">
        <div className="email-tabs" aria-hidden="true">
          <span className="is-active">Primary</span>
          <span>Updates</span>
          <small>1 new</small>
        </div>
        <div className="email-list">
          {rows.map((row) => (
            <article className={row.important ? "email-row is-quote" : "email-row"} key={`${row.sender}-${row.subject}`}>
              <span className="email-checkbox" aria-hidden="true" />
              <strong>
                {row.sender}
                {row.via ? <span className="email-row-via">via {row.via}</span> : null}
              </strong>
              <p><b>{row.subject}</b> <span>— {row.preview}</span></p>
              <time>{row.time}</time>
            </article>
          ))}
        </div>
      </div>
      <div className="email-quote-pop" aria-hidden="true">
        <QuoteVanMark size={24} />
        <div>
          <strong>New quote received</strong>
          <span>Private link from Bright Coat Painting</span>
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
          <span>12 items</span>
        </div>
        <span className="price-book-add" aria-hidden="true">+</span>
      </header>

      <section className="price-book-strength-card">
        <div>
          <span className="landing-eyebrow">Book strength</span>
          <strong>9 of 12 confirmed</strong>
        </div>
        <ProgressMeter confirmed={9} total={12} />
      </section>

      <section className="price-book-list-section">
        <div className="price-book-list-title">
          <span>Confirmed prices</span>
          <b>9</b>
        </div>
        <div className="price-book-group is-active">
          <PriceBookRow title="Paint walls" detail="Per room · Small $294 · Large $672" price="$420" tone="active" />
          <PriceBookRow title="Paint ceiling" detail="Per room · Small $126 · Large $288" price="$180" tone="active" />
          <PriceBookRow title="Paint trim" detail="Per room · Small $112 · Large $256" price="$160" tone="active" />
          <PriceBookRow title="Paint door" detail="Each" price="$95" tone="active" />
          <PriceBookRow title="Patch drywall" detail="Per patch · confirmed" price="$85" tone="active" />
        </div>
      </section>

      <section className="price-book-list-section">
        <div className="price-book-list-title">
          <span>Needs your confirmation</span>
          <b>3</b>
        </div>
        <div className="price-book-group is-starter">
          <PriceBookRow title="Patch nail holes" detail="Per room · Small $35 · Large $75" price="$50" tone="starter" />
          <PriceBookRow title="Primer coat" detail="Per room · Small $80 · Large $180" price="$120" tone="starter" />
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
        <span>Accept quote</span>
        <span>Decline</span>
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
