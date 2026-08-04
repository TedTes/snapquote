import { DemoButton, PhoneFrame, QuoteCard } from "../primitives";

export function DemoCustomerProfileScreen() {
  return (
    <PhoneFrame className="qv-flow-customer-profile" time="11:31">
      <header className="qv-flow-profile-nav">
        <button aria-label="Back" type="button">‹</button>
        <span>Customer</span>
        <button aria-label="Edit customer" type="button">✎</button>
      </header>

      <section className="qv-flow-profile-hero">
        <div className="qv-flow-profile-avatar">M</div>
        <div>
          <h3>Michael</h3>
          <p>Toronto · customer since Jul</p>
        </div>
      </section>

      <div className="qv-flow-profile-actions" aria-label="Customer contact actions">
        <button type="button">Call</button>
        <button type="button">Email</button>
      </div>

      <section className="qv-flow-profile-stats" aria-label="Customer quote summary">
        <span><b>4</b>Quotes</span>
        <span><b>2</b>Active</span>
        <span><b>$1,932</b>Won</span>
      </section>

      <div className="qv-flow-profile-section-head">
        <span>Quotes</span>
        <b>4</b>
      </div>

      <button className="qv-flow-profile-new-quote" type="button">
        + New quote for Michael
      </button>

      <div className="qv-flow-card-stack">
        <QuoteCard
          name="Interior repaint · 2 rooms"
          meta="Viewed · follow-up due"
          note="Send follow-up or copy link"
          price="$1,932"
          status="viewed"
          statusLabel="Viewed"
          trustState="needsOk"
        />
        <QuoteCard
          name="Kitchen + hallway"
          meta="Accepted · deposit paid"
          note="Ready to schedule"
          price="$2,237"
          status="accepted"
          statusLabel="Accepted"
          trustState="confirmed"
        />
      </div>

      <div className="qv-flow-profile-toolbar">
        <DemoButton tone="secondary">Resend link</DemoButton>
        <DemoButton tone="secondary">Copy link</DemoButton>
        <DemoButton tone="secondary">Archive</DemoButton>
      </div>
    </PhoneFrame>
  );
}
