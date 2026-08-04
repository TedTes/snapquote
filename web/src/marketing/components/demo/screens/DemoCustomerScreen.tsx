import { DemoButton, PhoneFrame, StepBar, TapIndicator, WizardHeader } from "../primitives";
import { isActiveTarget, targetCoordinates } from "../engine/playback";
import type { DemoPlaybackState } from "../engine/types";

interface DemoCustomerScreenProps {
  playback: DemoPlaybackState;
}

export function DemoCustomerScreen({ playback }: DemoCustomerScreenProps) {
  const tapTarget = targetCoordinates(playback.activeEvent?.target);

  return (
    <PhoneFrame time="9:14">
      <WizardHeader leftAction="×" step="1 / 4" />
      <StepBar steps={["Customer", "Job", "Notes", "Review"]} activeIndex={0} />

      <section className="qv-flow-form">
        <h3>Who's it for?</h3>
        <DemoField active={isActiveTarget(playback, "customerName", "type")} label="Customer name" selected>
          <span className="qv-flow-selected-customer-icon" aria-hidden="true" />
          <span><b>John Doe</b><small>Existing customer</small></span>
          <i aria-hidden="true">×</i>
        </DemoField>
        <DemoField label="Phone" icon="phone">4168208937</DemoField>
        <DemoField label="Email · sends the quote" icon="mail">tedtfu@gmail.com</DemoField>
        <DemoField label="Job address" icon="pin">Toronto</DemoField>
        <DemoField label="Job title · optional" muted>e.g. Interior repaint</DemoField>
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

function DemoField(props: {
  label: string;
  children: React.ReactNode;
  muted?: boolean;
  active?: boolean;
  selected?: boolean;
  icon?: "phone" | "mail" | "pin";
}) {
  return (
    <label className={props.selected ? "qv-flow-field is-selected-customer" : "qv-flow-field"}>
      <span>{props.label}</span>
      <em className={`${props.muted ? "is-muted" : ""} ${props.active ? "is-active" : ""}`}>
        {props.icon ? <span className={`qv-flow-field-icon is-${props.icon}`} aria-hidden="true" /> : null}
        {props.children}
      </em>
    </label>
  );
}
