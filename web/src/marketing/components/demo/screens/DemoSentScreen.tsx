import { AppHeader, DemoButton, PhoneFrame, Timeline } from "../primitives";
import { hasPassedEvent, isActiveTarget } from "../engine/playback";
import type { DemoPlaybackState } from "../engine/types";
import type { CSSProperties } from "react";

interface DemoSentScreenProps {
  playback: DemoPlaybackState;
}

export function DemoSentScreen({ playback }: DemoSentScreenProps) {
  const hasViewed = hasPassedEvent(playback, "viewedStatus", "status") || isActiveTarget(playback, "viewedStatus", "status");
  const hasAccepted = hasPassedEvent(playback, "acceptStatus", "status") || isActiveTarget(playback, "acceptStatus", "status");
  const hasPaid = hasPassedEvent(playback, "payStatus", "status") || isActiveTarget(playback, "payStatus", "status");
  const scrollProgress = playback.step.id === "status-update"
    ? Math.min(Math.max((playback.elapsedMs - 850) / 2300, 0), 1)
    : 0;
  const scrollStyle = { "--qv-sent-scroll-progress": scrollProgress } as CSSProperties;
  const statusLabel = hasPaid ? "Deposit paid" : hasAccepted ? "Accepted" : hasViewed ? "Viewed" : "Sent";
  const statusDetail = hasPaid
    ? "accepted · ready to schedule"
    : hasAccepted
      ? "Deposit requested"
      : hasViewed
        ? "Customer opened the quote"
        : "Waiting for customer view";
  const statusTone = hasAccepted || hasPaid ? "is-accepted" : hasViewed ? "is-viewed" : "is-sent";

  return (
    <PhoneFrame time="11:28">
      <div className="qv-flow-sent-scroll" style={scrollStyle}>
        <AppHeader leftAction="‹" rightAction="···" title="Michael" subtitle="18 Victor Ave" />
        <div className="qv-flow-sent-total">$1,932</div>
        <div className={`qv-flow-sent-status ${statusTone}`}>
          <span>{statusLabel}</span>
          <p>{statusDetail}</p>
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
              hasAccepted ? { label: "Accepted", meta: "Jul 26 at 1:19 PM" } : { label: "Waiting for response", meta: "We'll tell you when they accept", pending: true },
              hasPaid ? { label: "Deposit paid", meta: "Jul 26 at 1:20 PM" } : { label: "Deposit pending", meta: "Optional upfront payment", pending: true },
            ]}
          />
        </section>
      </div>
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
