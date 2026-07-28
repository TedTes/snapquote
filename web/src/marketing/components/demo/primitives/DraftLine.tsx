import type { TrustState } from "./types";
import { TrustSwatch } from "./TrustSwatch";
import { cx, formatDemoMoney } from "./utils";

interface DraftLineProps {
  title: string;
  detail?: string;
  price?: string | number;
  trustState?: TrustState;
  actionLabel?: string;
  className?: string;
}

export function DraftLine({
  title,
  detail,
  price,
  trustState = "confirmed",
  actionLabel,
  className,
}: DraftLineProps) {
  return (
    <article className={cx("qv-demo-draft-line", className)}>
      <TrustSwatch state={trustState} size="action" />
      <div className="qv-demo-draft-copy">
        <h4>{title}</h4>
        {detail ? <p>{detail}</p> : null}
      </div>
      {actionLabel ? <button type="button">{actionLabel}</button> : null}
      {price !== undefined ? <strong>{formatDemoMoney(price)}</strong> : null}
    </article>
  );
}
