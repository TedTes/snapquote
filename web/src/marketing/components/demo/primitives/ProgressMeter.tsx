import type { CSSProperties } from "react";
import { cx } from "./utils";

interface ProgressMeterProps {
  total: number;
  confirmed: number;
  className?: string;
}

export function ProgressMeter({ total, confirmed, className }: ProgressMeterProps) {
  const style = { "--meter-count": total } as CSSProperties;

  return (
    <div className={cx("qv-demo-progress", className)} style={style}>
      {Array.from({ length: total }, (_, index) => (
        <span className={index < confirmed ? "is-confirmed" : "is-pending"} key={index} />
      ))}
    </div>
  );
}
