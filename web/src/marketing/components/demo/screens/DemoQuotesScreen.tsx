import { BottomTabs, PhoneFrame, QuoteCard } from "../primitives";

export function DemoQuotesScreen() {
  return (
    <PhoneFrame className="qv-flow-quotes-list" time="11:31">
      <div className="qv-flow-list-title">
        <strong>Quotes</strong>
        <span>8 active</span>
      </div>
      <div className="qv-flow-search">Search customers or addresses</div>
      <div className="qv-flow-filter-row" aria-label="Quote filters">
        <span className="is-active">All <b>18</b></span>
        <span>Draft <b>5</b></span>
        <span>Viewed <b>3</b></span>
      </div>

      <p className="qv-flow-section-label">Needs attention</p>
      <div className="qv-flow-card-stack">
        <QuoteCard
          name="Interior repaint · 2 rooms"
          meta="James · Toronto"
          note="3 lines need a price"
          price="$--"
          status="draft"
          statusLabel="Draft"
          trustState="needsPrice"
        />
      </div>

      <p className="qv-flow-section-label">This week</p>
      <div className="qv-flow-card-stack">
        <QuoteCard
          name="Interior repaint · 2 rooms"
          meta="Michael · Toronto"
          note="Fully priced · ready to send"
          price="$2,050"
          status="ready"
          statusLabel="Ready"
          trustState="confirmed"
        />
        <QuoteCard
          name="Kitchen + hallway"
          meta="Avery · Etobicoke"
          note="Viewed · follow-up due"
          price="$2,237"
          status="stale"
          statusLabel="Sent"
          trustState="needsOk"
        />
        <QuoteCard
          name="Exterior trim + 2 doors"
          meta="Brandon · Toronto"
          note="Deposit paid · ready to schedule"
          price="$1,932"
          status="accepted"
          statusLabel="Accepted"
          trustState="confirmed"
          revisionNote="1 earlier revision ›"
        />
        <QuoteCard
          name="Ceiling repaint · 2 rooms"
          meta="Ravi Patel · Etobicoke"
          note="Fully priced · ready to send"
          price="$1,540"
          status="ready"
          statusLabel="Ready"
          trustState="confirmed"
        />
      </div>
      <BottomTabs active="quotes" />
    </PhoneFrame>
  );
}
