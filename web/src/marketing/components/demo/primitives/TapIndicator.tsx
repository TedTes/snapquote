interface TapIndicatorProps {
  x?: string;
  y?: string;
  label?: string;
}

export function TapIndicator({ x = "50%", y = "50%", label = "Tap" }: TapIndicatorProps) {
  return (
    <span className="qv-demo-tap-indicator" style={{ left: x, top: y }} aria-label={label}>
      <span aria-hidden="true">👆</span>
    </span>
  );
}
