import { AppHeader, DemoButton, PhoneFrame, TapIndicator, Timeline } from "../primitives";
import { isActiveTarget, targetCoordinates } from "../engine/playback";
import type { DemoPlaybackState } from "../engine/types";

interface DemoSentScreenProps {
  playback: DemoPlaybackState;
}

export function DemoSentScreen({ playback }: DemoSentScreenProps) {
  const tapTarget = targetCoordinates(playback.activeEvent?.target);
  const scrollOffset = getSentScrollOffset(playback.elapsedMs);
  const statusState = getSentStatusState(playback.elapsedMs);
  const timelineItems = [
    { label: "Created", meta: "Aug 4 at 9:18 AM" },
    { label: "Sent · email", meta: "Aug 4 at 9:19 AM" },
    ...(playback.elapsedMs >= 1080
      ? [{ label: "Viewed", meta: "Aug 4 at 9:22 AM" }]
      : [{ label: "Not viewed yet", meta: "We'll tell you when they open it", pending: true }]),
    ...(playback.elapsedMs >= 1540 ? [{ label: "Accepted", meta: "Aug 4 at 9:24 AM" }] : []),
    ...(playback.elapsedMs >= 1980 ? [{ label: "Deposit paid", meta: "$1,009 paid by card" }] : []),
  ];

  return (
    <PhoneFrame className="qv-flow-sent-detail-screen" time="9:14">
      <div className="qv-flow-sent-scroll" style={{ transform: `translateY(-${scrollOffset}px)` }}>
        <AppHeader
          leftAction={<span data-demo-target="backToQuotes">‹</span>}
          rightAction="···"
          title="John Doe"
          subtitle="Toronto"
        />
        <div className="qv-flow-sent-total">$2,018</div>
        <div className={`qv-flow-sent-status ${statusState.className}`}>
          <span>{statusState.label}</span>
          <p>{statusState.meta}</p>
        </div>
        <section className="qv-flow-sent-card">
          <div><span>What you sent</span><b>7 lines</b></div>
          <PreviewLine title="Paint walls" sub="2 rooms" price="$840" />
          <PreviewLine title="Paint ceilings" sub="2 rooms" price="$360" />
          <PreviewLine title="Paint trim" sub="2 rooms" price="$320" />
          <PreviewLine title="Paint 2 doors" sub="2 each" price="$190" />
          <span className="qv-flow-sent-more">+ 3 more lines</span>
          <div className="qv-flow-sent-summary">
            <p>Subtotal <b>$1,786</b></p>
            <p>Tax (13%) <b>$232</b></p>
          </div>
          <strong>Total <em>$2,018</em></strong>
        </section>
        <section className="qv-flow-timeline-card">
          <span>Status timeline</span>
          <Timeline items={timelineItems} />
        </section>
      </div>
      {tapTarget && isActiveTarget(playback, "backToQuotes", "tap") ? (
        <TapIndicator x={tapTarget.x} y={tapTarget.y} label="Back to quotes" />
      ) : null}
      <div className="qv-flow-bottom-cta qv-flow-follow-up-cta">
        <DemoButton>Follow-up available after 3 days</DemoButton>
      </div>
    </PhoneFrame>
  );
}

function smoothProgress(value: number) {
  const progress = Math.min(Math.max(value, 0), 1);
  return progress * progress * (3 - 2 * progress);
}

function getSentScrollOffset(elapsedMs: number) {
  const scrollDown = smoothProgress((elapsedMs - 320) / 1350);
  const scrollBackUp = smoothProgress((elapsedMs - 2350) / 850);
  return Math.round(scrollDown * (1 - scrollBackUp) * 308);
}

function getSentStatusState(elapsedMs: number) {
  if (elapsedMs >= 1980) {
    return { className: "is-deposited", label: "Deposited", meta: "deposit paid · schedule ready" };
  }
  if (elapsedMs >= 1540) {
    return { className: "is-accepted", label: "Accepted", meta: "accepted today · deposit pending" };
  }
  if (elapsedMs >= 1080) {
    return { className: "is-viewed", label: "Viewed", meta: "viewed today · valid to Aug 17" };
  }
  return { className: "is-sent", label: "Sent", meta: "today at 9:19 AM · valid to Aug 17" };
}

function PreviewLine(props: { title: string; sub: string; price: string }) {
  return (
    <div className="qv-flow-sent-line">
      <span><b>{props.title}</b><small>{props.sub}</small></span>
      <strong>{props.price}</strong>
    </div>
  );
}
