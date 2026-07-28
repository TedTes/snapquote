import { BrowserFrame, DemoButton, TapIndicator } from "../primitives";
import { hasPassedEvent, isActiveTarget, targetCoordinates } from "../engine/playback";
import type { DemoPlaybackState } from "../engine/types";

interface DemoPaymentScreenProps {
  playback: DemoPlaybackState;
}

export function DemoPaymentScreen({ playback }: DemoPaymentScreenProps) {
  const tapTarget = targetCoordinates(playback.activeEvent?.target);
  const isPaid = hasPassedEvent(playback, "payDeposit", "tap");

  return (
    <BrowserFrame address="quotevan.com/q/8f21ac">
      <section className="qv-flow-payment">
        <div className={isPaid ? "qv-flow-payment-check is-paid" : "qv-flow-payment-check"}>{isPaid ? "✓" : "$"}</div>
        <p className="qv-flow-payment-kicker">{isPaid ? "Deposit paid" : "Quote accepted"}</p>
        <h2>{isPaid ? "You're on the schedule." : "Pay the deposit to start."}</h2>
        <p>
          {isPaid
            ? "Bright Coat Painting has your acceptance and deposit."
            : "No account needed. Pay securely from the quote link."}
        </p>
        <div className="qv-flow-payment-card">
          <span>50% deposit</span>
          <strong>$966</strong>
          <small>Remaining balance due on completion.</small>
        </div>
      </section>
      {tapTarget && isActiveTarget(playback, "payDeposit", "tap") ? (
        <TapIndicator x={tapTarget.x} y={tapTarget.y} label="Pay" />
      ) : null}
      <div className="qv-flow-bottom-cta">
        <DemoButton className={isActiveTarget(playback, "payDeposit", "tap") ? "is-pressed" : undefined}>
          {isPaid ? "Payment complete" : "Pay deposit"}
        </DemoButton>
      </div>
    </BrowserFrame>
  );
}
