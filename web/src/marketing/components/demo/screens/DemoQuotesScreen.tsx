import { BottomTabs, PhoneFrame, QuoteCard } from "../primitives";

export function DemoQuotesScreen() {
  return (
    <PhoneFrame time="11:28">
      <div className="qv-flow-list-title">
        <strong>Quotes</strong>
        <span>3 active</span>
      </div>
      <div className="qv-flow-card-stack">
        <QuoteCard
          name="Michael"
          meta="18 Victor Ave"
          note="Deposit paid · Jul 26"
          price="$1,932"
          status="accepted"
          statusLabel="Accepted"
          trustState="confirmed"
        />
        <QuoteCard
          name="Brandon"
          meta="Toronto"
          note="Accepted · Jul 25"
          price="$2,147"
          status="accepted"
          statusLabel="Accepted"
          trustState="confirmed"
        />
        <QuoteCard
          name="James"
          meta="Toronto"
          note="Fully priced · ready to send"
          price="$1,540"
          status="ready"
          statusLabel="Ready"
          trustState="confirmed"
          revisionNote="1 earlier revision"
        />
      </div>
      <p className="qv-flow-subtle-add">Tap + to add another quote</p>
      <BottomTabs active="quotes" />
    </PhoneFrame>
  );
}
