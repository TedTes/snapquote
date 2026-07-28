import { ProductFlowDemo } from "./components/demo/ProductFlowDemo";
import { DraftLine, ProgressMeter, QuoteVanMark, StatusPill } from "./components/demo/primitives";
import "./landing.css";

const waitlistMailto = "mailto:hello@quotevan.com?subject=Early%20access%20request";
const supportMailto = "mailto:hello@quotevan.com?subject=QuoteVan%20support";

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
            <a href="#no-guesses">No guesses</a>
            <a href="#how">How it works</a>
            <a href="#customer">Customer view</a>
            <a href="#book">Price book</a>
          </nav>
          <a className="btn btn-primary btn-small" href={waitlistMailto}>Get early access</a>
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
            <div className="landing-hero-actions">
              <a className="btn btn-primary" href={waitlistMailto}>Join waitlist</a>
              <a className="landing-text-link" href="#how">See how it works</a>
            </div>
            <StoreBadges />
          </div>

          <div className="hero-demo" aria-label="QuoteVan provider quote creation flow">
            <ProductFlowDemo />
          </div>
        </section>

        <section className="promise-strip" aria-label="QuoteVan product promise">
          <PromiseItem title="On-site workflow" text="Start the quote while the job is still fresh." />
          <PromiseItem title="No guessed prices" text="AI can draft scope. Dollars come from your book." />
          <PromiseItem title="Customer-ready" text="Send a clean quote link by email." />
        </section>

        <section className="no-guess-section" id="no-guesses">
          <div className="section-copy">
            <p className="landing-eyebrow">No guessed prices</p>
            <h2>AI drafts scope. Your price book sets the dollars.</h2>
            <p>
              QuoteVan treats pricing as a trust state. Green lines are priced, yellow lines need your OK, and red
              lines block sending until you enter a real price.
            </p>
          </div>
          <div className="trust-stack">
            <DraftLine detail="2 rooms · from your book" price={840} title="Paint walls" trustState="confirmed" />
            <DraftLine
              actionLabel="Confirm"
              detail="$75 suggested · confirm once"
              title="Patch nail holes"
              trustState="needsOk"
            />
            <DraftLine
              actionLabel="Add price"
              detail="Hallway · no match found"
              title="Remove wallpaper"
              trustState="needsPrice"
            />
          </div>
        </section>

        <section className="how-section" id="how">
          <div className="section-copy is-centered">
            <p className="landing-eyebrow">How it works</p>
            <h2>Checklist. Talk it through. Send.</h2>
          </div>
          <div className="how-grid">
            <HowCard step="01" title="Walk the job" text="Capture customer details, address, rooms, surfaces, and quantities." />
            <HowCard step="02" title="Review the quote" text="Line items assemble from the walkthrough and match against your price book." />
            <HowCard step="03" title="Send and track" text="Email a private quote link and see when it is viewed, accepted, or stale." />
          </div>
        </section>

        <section className="customer-section" id="customer">
          <div className="section-copy">
            <p className="landing-eyebrow">Customer experience</p>
            <h2>The customer sees a quote, not your app.</h2>
            <p>
              They open a private link from email, review the scope, accept or decline, and can pay a deposit when
              payments are enabled.
            </p>
          </div>
          <CustomerQuoteCard />
        </section>

        <section className="book-section" id="book">
          <div className="book-demo-card">
            <div className="book-demo-head">
              <span className="landing-eyebrow">Book strength</span>
              <strong>8 of 11 confirmed</strong>
            </div>
            <ProgressMeter confirmed={8} total={11} />
            <div className="book-flow">
              <span>Suggested starter</span>
              <b>Patch nail holes · $75</b>
              <i aria-hidden="true" />
              <span>Next quote</span>
              <b>Auto-matches green</b>
            </div>
          </div>
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
          <div className="section-copy is-centered">
            <p className="landing-eyebrow">Built for small service teams</p>
            <h2>Purpose-built for quoting, not another CRM to manage.</h2>
            <p>
              Useful for painters, handymen, cleaners, repair pros, and other field-service providers who need to
              respond before the customer moves on.
            </p>
          </div>
          <div className="audience-chips" aria-label="Supported service provider examples">
            <span>Painters</span>
            <span>Handymen</span>
            <span>Cleaners</span>
            <span>Repair pros</span>
            <span>Field-service teams</span>
          </div>
        </section>

        <section className="final-cta">
          <p className="landing-eyebrow">Early access</p>
          <h2>Finish the quote before you get back in the van.</h2>
          <p>
            QuoteVan is still early. Join the waitlist if you want to test real quotes and shape the workflow.
          </p>
          <div className="landing-hero-actions">
            <a className="btn btn-primary" href={waitlistMailto}>Get early access</a>
            <a className="landing-support-link" href={supportMailto}>Questions? Contact support</a>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <span className="landing-footer-brand">QuoteVan</span>
          <nav className="landing-footer-links">
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="/support">Support</a>
          </nav>
        </div>
        <p className="landing-footer-note">Customer quote links are private by URL.</p>
      </footer>
    </div>
  );
}

function PromiseItem(props: { title: string; text: string }) {
  return (
    <article>
      <strong>{props.title}</strong>
      <p>{props.text}</p>
    </article>
  );
}

function HowCard(props: { step: string; title: string; text: string }) {
  return (
    <article className="how-card">
      <span>{props.step}</span>
      <h3>{props.title}</h3>
      <p>{props.text}</p>
    </article>
  );
}

function CustomerQuoteCard() {
  return (
    <article className="customer-quote-card">
      <header>
        <QuoteVanMark size={38} framed />
        <div>
          <span>Quote from</span>
          <strong>Bright Coat Painting</strong>
          <p>Quote prepared with QuoteVan</p>
        </div>
        <StatusPill tone="viewed">Viewed</StatusPill>
      </header>
      <div className="customer-quote-meta">
        <span><b>Quote</b>#1024</span>
        <span><b>Issued</b>Jul 26</span>
        <span><b>Valid until</b>Aug 7</span>
      </div>
      <section>
        <b>Prepared for</b>
        <strong>Michael</strong>
        <p>18 Victor Ave, Toronto</p>
      </section>
      <QuotePreviewLine title="Paint walls in 2 medium rooms" price="$840" />
      <QuotePreviewLine title="Paint ceilings in 2 rooms" price="$360" />
      <QuotePreviewLine title="Paint trim in 2 rooms" price="$320" />
      <div className="customer-quote-total">
        <span>Total</span>
        <strong>$1,932</strong>
      </div>
      <div className="customer-quote-actions">
        <button type="button">Accept quote</button>
        <button type="button">Decline</button>
      </div>
      <small>No account needed. Questions? Reply to the email.</small>
    </article>
  );
}

function QuotePreviewLine(props: { title: string; price: string }) {
  return (
    <div className="customer-quote-line">
      <span>{props.title}</span>
      <b>{props.price}</b>
    </div>
  );
}

function StoreBadges() {
  return (
    <div aria-label="QuoteVan mobile app availability" className="store-badges">
      <a aria-label="Join the waitlist for QuoteVan on the App Store" className="store-badge" href={waitlistMailto}>
        <span aria-hidden="true" className="store-badge-icon store-badge-icon-apple">
          <svg viewBox="0 0 18 22">
            <path d="M14.8 11.6c0-2.4 2-3.6 2.1-3.7-1.1-1.6-2.8-1.9-3.4-1.9-1.4-.1-2.7.8-3.5.8-.7 0-1.9-.8-3.1-.8-1.6 0-3.1.9-3.9 2.4-1.7 2.9-.4 7.2 1.2 9.6.8 1.2 1.8 2.5 3.1 2.4 1.2 0 1.7-.8 3.1-.8s1.8.8 3.1.8c1.3 0 2.1-1.2 2.9-2.3.9-1.3 1.2-2.6 1.3-2.7 0 0-2.9-1.1-2.9-3.8ZM12.6 4.5c.7-.8 1.1-1.9 1-3-.9 0-2 .6-2.7 1.4-.6.7-1.1 1.8-1 2.9 1 .1 2-.5 2.7-1.3Z" />
          </svg>
        </span>
        <span>
          <small>Coming soon on</small>
          <strong>App Store</strong>
        </span>
      </a>
      <a aria-label="Join the waitlist for QuoteVan on Google Play" className="store-badge" href={waitlistMailto}>
        <span aria-hidden="true" className="store-badge-icon store-badge-icon-play">
          <svg viewBox="0 0 22 24">
            <path d="M2.1 1.1c-.4.3-.6.9-.6 1.6v18.6c0 .7.2 1.3.7 1.6l10.6-10.9L2.1 1.1Z" />
            <path d="m16.2 8.2-3.4 3.8 3.4 3.8 3.7-2.1c1.2-.7 1.2-2.4 0-3.1l-3.7-2.4Z" />
            <path d="m12.8 12-10.6 10.9c.5.3 1.1.3 1.8-.1l12.2-7-3.4-3.8Z" />
            <path d="M16.2 8.2 4 1.2C3.3.8 2.6.8 2.1 1.1L12.8 12l3.4-3.8Z" />
          </svg>
        </span>
        <span>
          <small>Coming soon on</small>
          <strong>Google Play</strong>
        </span>
      </a>
    </div>
  );
}
