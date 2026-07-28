import { DemoButton, PhoneFrame, StepBar, TapIndicator, WizardHeader } from "../primitives";
import { isActiveTarget, targetCoordinates, typedValue } from "../engine/playback";
import type { DemoPlaybackState } from "../engine/types";

interface DemoCustomerScreenProps {
  playback: DemoPlaybackState;
}

export function DemoCustomerScreen({ playback }: DemoCustomerScreenProps) {
  const tapTarget = targetCoordinates(playback.activeEvent?.target);

  return (
    <PhoneFrame time="11:28">
      <WizardHeader leftAction="×" step="1 / 4" />
      <StepBar steps={["Customer", "Job", "Notes", "Review"]} activeIndex={0} />

      <section className="qv-flow-form">
        <h3>Who's it for?</h3>
        <DemoField active={isActiveTarget(playback, "customerName", "type")} label="Customer name">
          {typedValue(playback, "customerName")}
        </DemoField>
        <DemoField label="Phone" muted>Mobile</DemoField>
        <DemoField label="Email · sends the quote" muted>name@email.com</DemoField>
        <DemoField active={isActiveTarget(playback, "jobAddress", "type")} label="Job address">
          {typedValue(playback, "jobAddress")}
        </DemoField>
        <DemoField active={isActiveTarget(playback, "jobTitle", "type")} label="Job title · optional">
          {typedValue(playback, "jobTitle")}
        </DemoField>
      </section>

      {tapTarget && playback.activeEvent?.type === "tap" ? (
        <TapIndicator x={tapTarget.x} y={tapTarget.y} label="Tap next" />
      ) : null}
      <div className="qv-flow-bottom-cta">
        <DemoButton className={isActiveTarget(playback, "nextButton", "tap") ? "is-pressed" : undefined}>
          Next — the job →
        </DemoButton>
      </div>
    </PhoneFrame>
  );
}

function DemoField(props: { label: string; children: React.ReactNode; muted?: boolean; active?: boolean }) {
  return (
    <label className="qv-flow-field">
      <span>{props.label}</span>
      <em className={`${props.muted ? "is-muted" : ""} ${props.active ? "is-active" : ""}`}>{props.children}</em>
    </label>
  );
}
