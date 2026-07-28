import type { TrustState } from "./types";
import { TrustSwatch } from "./TrustSwatch";
import { cx, formatDemoMoney } from "./utils";

interface PriceBookRowProps {
  name: string;
  unit: string;
  price: string | number;
  sizePrices?: string;
  trustState?: TrustState;
  starter?: boolean;
  className?: string;
}

export function PriceBookRow({
  name,
  unit,
  price,
  sizePrices,
  trustState = "confirmed",
  starter = false,
  className,
}: PriceBookRowProps) {
  return (
    <article className={cx("qv-demo-price-row", starter && "is-starter", className)}>
      <TrustSwatch state={trustState} size="stripe" />
      <div className="qv-demo-price-row-copy">
        <h4>{name}</h4>
        <p>{unit}{sizePrices ? ` - ${sizePrices}` : ""}</p>
      </div>
      <strong>{formatDemoMoney(price)}</strong>
      <span className="qv-demo-chevron" aria-hidden="true" />
    </article>
  );
}
