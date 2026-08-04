import { BottomTabs, PhoneFrame, QuoteCard } from "../primitives";

export function DemoQuotesScreen() {
  return (
    <PhoneFrame className="qv-flow-quotes-list" time="9:14">
      <div className="qv-flow-list-title">
        <strong>Quotes</strong>
        <span>9 active</span>
      </div>
      <div className="qv-flow-search">Search customers or addresses</div>
      <div className="qv-flow-filter-row" aria-label="Quote filters">
        <span>All <b>19</b></span>
        <span>Draft <b>5</b></span>
        <span className="is-active">Sent <b>1</b></span>
        <span>Viewed <b>3</b></span>
      </div>

      <p className="qv-flow-section-label">All quotes</p>
      <div className="qv-flow-card-stack">
        <QuoteCard
          name="Interior repaint · 2 rooms"
          meta="John Doe · Toronto"
          note="Sent today · not viewed"
          price="$2,018"
          status="sent"
          statusLabel="Sent"
          trustState="neutral"
        />
      </div>
      <BottomTabs active="quotes" />
    </PhoneFrame>
  );
}
