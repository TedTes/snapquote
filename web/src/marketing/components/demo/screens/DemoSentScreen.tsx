import { AppHeader, DemoButton, PhoneFrame, TapIndicator, Timeline } from "../primitives";
import { isActiveTarget, targetCoordinates } from "../engine/playback";
import type { DemoPlaybackState } from "../engine/types";

interface DemoSentScreenProps {
  playback: DemoPlaybackState;
}

export function DemoSentScreen({ playback }: DemoSentScreenProps) {
  const tapTarget = targetCoordinates(playback.activeEvent?.target);

  return (
    <PhoneFrame className="qv-flow-sent-detail-screen" time="9:14">
      <div className="qv-flow-sent-scroll">
        <AppHeader
          leftAction={<span data-demo-target="backToQuotes">‹</span>}
          rightAction="···"
          title="John Doe"
          subtitle="Toronto"
        />
        <div className="qv-flow-sent-total">$2,018</div>
        <div className="qv-flow-sent-status is-sent">
          <span>Sent</span>
          <p>today at 9:19 AM · valid to Aug 17</p>
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
          <Timeline
            items={[
              { label: "Created", meta: "Aug 4 at 9:18 AM" },
              { label: "Sent · email", meta: "Aug 4 at 9:19 AM" },
              { label: "Not viewed yet", meta: "We'll tell you when they open it", pending: true },
            ]}
          />
        </section>
      </div>
      {tapTarget && isActiveTarget(playback, "backToQuotes", "tap") ? (
        <TapIndicator x={tapTarget.x} y={tapTarget.y} label="Back to quotes" />
      ) : null}
      <div className="qv-flow-bottom-cta">
        <DemoButton tone="secondary">Follow-up available after 3 days</DemoButton>
      </div>
    </PhoneFrame>
  );
}

function PreviewLine(props: { title: string; sub: string; price: string }) {
  return (
    <div className="qv-flow-sent-line">
      <span><b>{props.title}</b><small>{props.sub}</small></span>
      <strong>{props.price}</strong>
    </div>
  );
}
