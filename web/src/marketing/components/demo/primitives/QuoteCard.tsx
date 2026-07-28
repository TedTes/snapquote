import type { QuoteStatusTone, TrustState } from "./types";
import { StatusPill } from "./StatusPill";
import { TrustSwatch } from "./TrustSwatch";
import { cx, formatDemoMoney } from "./utils";

interface QuoteCardProps {
  name: string;
  meta?: string;
  price?: string | number;
  status: QuoteStatusTone;
  statusLabel?: string;
  note?: string;
  trustState?: TrustState;
  revisionNote?: string;
  muted?: boolean;
  className?: string;
}

export function QuoteCard({
  name,
  meta,
  price,
  status,
  statusLabel,
  note,
  trustState = "neutral",
  revisionNote,
  muted = false,
  className,
}: QuoteCardProps) {
  return (
    <article className={cx("qv-demo-quote-card", muted && "is-muted", className)}>
      <TrustSwatch state={trustState} size="stripe" />
      <div className="qv-demo-quote-card-main">
        <div>
          <h4>{name}</h4>
          {meta ? <p>{meta}</p> : null}
          {note ? <small>{note}</small> : null}
        </div>
        <div className="qv-demo-quote-card-side">
          {price !== undefined ? <strong>{formatDemoMoney(price)}</strong> : null}
          <StatusPill tone={status}>{statusLabel ?? status}</StatusPill>
        </div>
      </div>
      {revisionNote ? <div className="qv-demo-quote-revision">{revisionNote}</div> : null}
    </article>
  );
}
