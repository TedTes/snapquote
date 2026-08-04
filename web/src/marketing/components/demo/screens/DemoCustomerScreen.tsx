import { DemoButton, PhoneFrame, StepBar, TapIndicator, WizardHeader } from "../primitives";
import { hasPassedEvent, isActiveTarget, targetCoordinates, typedValue } from "../engine/playback";
import type { DemoPlaybackState } from "../engine/types";

interface DemoCustomerScreenProps {
  playback: DemoPlaybackState;
}

export function DemoCustomerScreen({ playback }: DemoCustomerScreenProps) {
  const tapTarget = targetCoordinates(playback.activeEvent?.target);
  const typedCustomerName = typedValue(playback, "customerName");
  const typedJobTitle = typedValue(playback, "jobTitle");
  const isTypingCustomer = isActiveTarget(playback, "customerName", "type");
  const isTypingJobTitle = isActiveTarget(playback, "jobTitle", "type");
  const isCustomerSelected = hasPassedEvent(playback, "customerName", "type");

  return (
    <PhoneFrame time="9:14">
      <WizardHeader leftAction="×" step="1 / 4" />
      <StepBar steps={["Customer", "Job", "Notes", "Review"]} activeIndex={0} />

      <section className="qv-flow-form">
        <h3>Who's it for?</h3>
        {isCustomerSelected ? (
          <DemoField label="Customer name" selected>
            <span className="qv-flow-selected-customer-icon" aria-hidden="true">JD</span>
            <span><b>John Doe</b><small>Existing customer</small></span>
            <i aria-hidden="true">×</i>
          </DemoField>
        ) : (
          <>
            <DemoField active={isTypingCustomer} label="Customer name">
              <span className={typedCustomerName ? "qv-flow-typed-value" : "qv-flow-typed-value is-placeholder"}>
                {typedCustomerName || "Search or add customer"}
              </span>
            </DemoField>
            {typedCustomerName ? (
              <div className={isTypingCustomer ? "qv-flow-customer-suggestion is-active" : "qv-flow-customer-suggestion"}>
                <span className="qv-flow-selected-customer-icon" aria-hidden="true">JD</span>
                <span><b>John Doe</b><small>Existing customer · tap to use saved details</small></span>
              </div>
            ) : null}
          </>
        )}
        <DemoField muted={!isCustomerSelected} label="Phone" icon="phone">
          {isCustomerSelected ? "4168208937" : "Auto-fills after customer pick"}
        </DemoField>
        <DemoField muted={!isCustomerSelected} label="Email · sends the quote" icon="mail">
          {isCustomerSelected ? "tedtfu@gmail.com" : "Saved email"}
        </DemoField>
        <DemoField muted={!isCustomerSelected} label="Job address" icon="pin">
          {isCustomerSelected ? "Toronto" : "Saved address"}
        </DemoField>
        <DemoField active={isTypingJobTitle} label="Job title · optional" muted={!typedJobTitle}>
          <span className={typedJobTitle ? "qv-flow-typed-value" : "qv-flow-typed-value is-placeholder"}>
            {typedJobTitle || "e.g. Interior repaint"}
          </span>
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
