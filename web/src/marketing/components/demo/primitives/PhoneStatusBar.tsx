interface PhoneStatusBarProps {
  time?: string;
  rightLabel?: string;
}

export function PhoneStatusBar({ time = "9:41", rightLabel = "Wi-Fi 100" }: PhoneStatusBarProps) {
  return (
    <div className="qv-demo-statusbar" aria-hidden="true">
      <span>{time}</span>
      <span>{rightLabel}</span>
    </div>
  );
}
