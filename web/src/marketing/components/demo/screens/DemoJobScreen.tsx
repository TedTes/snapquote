import { AppHeader, DemoButton, PhoneFrame, StepBar, TapIndicator } from "../primitives";
import { isActiveTarget, targetCoordinates } from "../engine/playback";
import type { DemoPlaybackState } from "../engine/types";

interface DemoJobScreenProps {
  playback: DemoPlaybackState;
}

export function DemoJobScreen({ playback }: DemoJobScreenProps) {
  const tapTarget = targetCoordinates(playback.activeEvent?.target);

  return (
    <PhoneFrame time="11:28">
      <AppHeader centered leftAction="‹" title="New quote" subtitle="2 / 4" />
      <StepBar steps={["Customer", "Job", "Notes", "Review"]} activeIndex={1} />

      <section className="qv-flow-job">
        <h3>The job</h3>
        <p>These numbers set quantities. Prices come later from the price book.</p>

        <div className="qv-flow-job-card">
          <CounterRow label="Small" value="0" />
          <CounterRow label="Medium" value="2" active pulse={isActiveTarget(playback, "mediumRooms", "select")} />
          <CounterRow label="Large" value="0" />
        </div>

        <div className="qv-flow-job-card">
          <ToggleRow label="Walls" />
          <ToggleRow label="Ceilings" />
          <ToggleRow label="Trim" />
          <CounterRow label="Doors" value="2" active />
        </div>

        <div className={isActiveTarget(playback, "coats", "select") ? "qv-flow-segmented is-active" : "qv-flow-segmented"}>
          <span>1 coat</span>
          <b>2 coats</b>
          <span>3 coats</span>
        </div>
      </section>

      {tapTarget ? <TapIndicator x={tapTarget.x} y={tapTarget.y} label="Tap checklist value" /> : null}
      <div className="qv-flow-bottom-cta">
        <DemoButton className={isActiveTarget(playback, "nextButton", "tap") ? "is-pressed" : undefined}>
          Next — describe it →
        </DemoButton>
      </div>
    </PhoneFrame>
  );
}

function CounterRow(props: { label: string; value: string; active?: boolean; pulse?: boolean }) {
  return (
    <div className={`${props.active ? "qv-flow-counter is-active" : "qv-flow-counter"} ${props.pulse ? "is-pulsing" : ""}`}>
      <span>{props.label}</span>
      <b>−</b>
      <strong>{props.value}</strong>
      <b>+</b>
    </div>
  );
}

function ToggleRow(props: { label: string }) {
  return (
    <div className="qv-flow-toggle-row">
      <span>{props.label}</span>
      <i />
    </div>
  );
}
