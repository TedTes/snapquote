import { BottomTabs, PhoneFrame, QuoteCard, TapIndicator } from "../primitives";
import { hasPassedEvent, isActiveTarget, targetCoordinates } from "../engine/playback";
import type { DemoPlaybackState } from "../engine/types";

interface DemoQuotesScreenProps {
  playback: DemoPlaybackState;
}

export function DemoQuotesScreen({ playback }: DemoQuotesScreenProps) {
  const tapTarget = targetCoordinates(playback.activeEvent?.target);
  const allFilterActive = hasPassedEvent(playback, "allQuotesTab", "tap");

  return (
    <PhoneFrame className="qv-flow-quotes-list" time="9:14">
      <div className="qv-flow-list-title">
        <strong>Quotes</strong>
        <span>9 active</span>
      </div>
      <div className="qv-flow-search">Search customers or addresses</div>
      <div className="qv-flow-filter-row" aria-label="Quote filters">
        <span className={allFilterActive ? "is-active" : undefined} data-demo-target="allQuotesTab">All <b>19</b></span>
        <span>Draft <b>5</b></span>
        <span className={allFilterActive ? undefined : "is-active"}>Sent <b>1</b></span>
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
          className="qv-flow-sent-quote-card"
        />
        {allFilterActive ? (
          <>
            <QuoteCard
              name="Kitchen cabinets · 12 doors"
              meta="Maya Singh · East York"
              note="Ready to send"
              price="$3,450"
              status="ready"
              statusLabel="Ready"
              trustState="confirmed"
            />
            <QuoteCard
              name="Exterior trim · 2 doors"
              meta="Ravi Patel · Etobicoke"
              note="1 line needs a price"
              price="$--"
              status="draft"
              statusLabel="Draft"
              trustState="needsPrice"
            />
          </>
        ) : null}
      </div>
      {tapTarget && isActiveTarget(playback, "allQuotesTab", "tap") ? (
        <TapIndicator x={tapTarget.x} y={tapTarget.y} label="All quotes" />
      ) : null}
      <BottomTabs active="quotes" />
    </PhoneFrame>
  );
}
