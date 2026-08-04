import {
  AppHeader,
  BottomTabs,
  IconTile,
  PhoneFrame,
  QuoteCard,
  TapIndicator,
} from "../primitives";
import { isActiveTarget, targetCoordinates } from "../engine/playback";
import type { DemoPlaybackState } from "../engine/types";

interface DemoDashboardScreenProps {
  playback: DemoPlaybackState;
}

export function DemoDashboardScreen({ playback }: DemoDashboardScreenProps) {
  const tapTarget = targetCoordinates(playback.activeEvent?.target);

  return (
    <PhoneFrame className="qv-flow-dashboard" time="9:14">
      <AppHeader eyebrow="Add business name" title="Today" subtitle="Tuesday, Aug 4" avatarText="YB" />

      <section className="qv-flow-pipeline">
        <div>
          <span>Open pipeline</span>
          <b>8 quotes</b>
        </div>
        <strong>$14,717</strong>
        <div className="qv-flow-pipeline-bars" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <p>Draft · Sent · Accepted</p>
      </section>

      <p className="qv-flow-section-label">Needs you today</p>
      <section className="qv-flow-action-list">
        <div>
          <IconTile tone="red">!</IconTile>
          <span><b>1 draft needs a price</b><small>Red lines are blocking send</small></span>
          <strong>Price</strong>
        </div>
        <div>
          <IconTile tone="green">✓</IconTile>
          <span><b>4 drafts ready to send</b><small>$8,118 fully priced & waiting</small></span>
          <strong>Send</strong>
        </div>
        <div>
          <IconTile tone="amber">◷</IconTile>
          <span><b>6 quotes to follow up</b><small>Sent 3+ days ago, no reply</small></span>
          <strong>Nudge</strong>
        </div>
      </section>

      <p className="qv-flow-section-label">Active quotes</p>
      <div className="qv-flow-card-stack">
        <QuoteCard
          name="Interior repaint · 2 rooms"
          meta="James · Toronto"
          note="2 lines need a price"
          price="$2,290+"
          status="draft"
          statusLabel="Draft"
          trustState="needsPrice"
        />
        <QuoteCard
          name="Ceiling repaint · 1 room"
          meta="Maya · Etobicoke"
          note="Ready to send"
          price="$980"
          status="draft"
          statusLabel="Draft"
          trustState="confirmed"
        />
        <QuoteCard
          name="Exterior trim + 2 doors"
          meta="Avery · Toronto"
          note="Follow up · sent 3 days ago"
          price="$1,640"
          status="stale"
          statusLabel="Sent"
          trustState="needsOk"
        />
      </div>

      {isActiveTarget(playback, "fab", "tap") && tapTarget ? (
        <TapIndicator x={tapTarget.x} y={tapTarget.y} label="Tap new quote" />
      ) : null}

      <span className={isActiveTarget(playback, "fab", "tap") ? "qv-flow-fab-focus is-active" : "qv-flow-fab-focus"} />

      <BottomTabs active="today" />
    </PhoneFrame>
  );
}
