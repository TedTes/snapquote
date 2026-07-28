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
    <PhoneFrame className="qv-flow-dashboard" time="8:15">
      <AppHeader eyebrow="Bright Coat Painting" title="Today" subtitle="Sunday, Jul 26" avatarText="BC" />

      <section className="qv-flow-pipeline">
        <div>
          <span>Open pipeline</span>
          <b>9 quotes</b>
        </div>
        <strong>$10,416</strong>
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
          <span><b>4 drafts need a price</b><small>Red lines are blocking send</small></span>
          <strong>Price</strong>
        </div>
        <div>
          <IconTile tone="green">✓</IconTile>
          <span><b>3 drafts ready to send</b><small>$6,235 fully priced & waiting</small></span>
          <strong>Send</strong>
        </div>
      </section>

      <p className="qv-flow-section-label">Active quotes</p>
      <div className="qv-flow-card-stack">
        <QuoteCard
          name="Priya"
          meta="Toronto"
          note="Ready to send"
          price="$2,100"
          status="draft"
          statusLabel="Draft"
          trustState="confirmed"
        />
        <QuoteCard
          name="Amara"
          meta="Toronto"
          note="Viewed · today"
          price="$1,540"
          status="viewed"
          statusLabel="Viewed"
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
