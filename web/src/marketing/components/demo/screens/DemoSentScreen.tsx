import { AppHeader, DemoButton, PhoneFrame, Timeline } from "../primitives";
import { hasPassedEvent, isActiveTarget } from "../engine/playback";
import type { DemoPlaybackState } from "../engine/types";

interface DemoSentScreenProps {
  playback: DemoPlaybackState;
}

export function DemoSentScreen({ playback }: DemoSentScreenProps) {
  const hasViewed = hasPassedEvent(playback, "viewedStatus", "status") || isActiveTarget(playback, "viewedStatus", "status");
  const hasPaid = hasPassedEvent(playback, "payStatus", "status") || isActiveTarget(playback, "payStatus", "status");

  return (
    <PhoneFrame time="11:28">
      <AppHeader leftAction="‹" rightAction="···" title="Michael" subtitle="18 Victor Ave" />
      <div className="qv-flow-sent-total">$1,932</div>
      <div className="qv-flow-sent-status">
        <span>{hasPaid ? "Accepted" : hasViewed ? "Viewed" : "Sent"}</span>
        <p>{hasPaid ? "Deposit paid · ready to schedule" : hasViewed ? "Jul 26 at 1:18 PM · valid to Aug 7" : "Waiting for customer view"}</p>
      </div>
      <section className="qv-flow-sent-card">
        <div><span>What you sent</span><b>4 lines</b></div>
        <PreviewLine title="Paint walls" sub="2 rooms" price="$840" />
        <PreviewLine title="Paint ceilings" sub="2 rooms" price="$360" />
        <PreviewLine title="Paint trim" sub="2 rooms" price="$320" />
        <PreviewLine title="Paint 2 doors" sub="2 each" price="$190" />
        <strong>Total <em>$1,932</em></strong>
      </section>
      <section className="qv-flow-timeline-card">
        <span>Status timeline</span>
        <Timeline
          items={[
            { label: "Created", meta: "Jul 26 at 1:16 PM" },
            { label: "Sent · email", meta: "Jul 26 at 1:17 PM" },
            hasViewed ? { label: "Viewed", meta: "Jul 26 at 1:18 PM" } : { label: "Not viewed yet", meta: "We'll tell you when they open it", pending: true },
            hasPaid ? { label: "Accepted · deposit paid", meta: "Jul 26 at 1:19 PM" } : { label: "Waiting for response", meta: "We'll tell you when they accept", pending: true },
          ]}
        />
      </section>
      <div className="qv-flow-bottom-cta">
        <DemoButton>Send follow-up</DemoButton>
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
