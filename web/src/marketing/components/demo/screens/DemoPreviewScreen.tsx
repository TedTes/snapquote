import { AppHeader, DemoButton, PhoneFrame, TapIndicator } from "../primitives";
import { isActiveTarget, targetCoordinates } from "../engine/playback";
import type { DemoPlaybackState } from "../engine/types";

interface DemoPreviewScreenProps {
  playback: DemoPlaybackState;
}

export function DemoPreviewScreen({ playback }: DemoPreviewScreenProps) {
  const tapTarget = targetCoordinates(playback.activeEvent?.target);

  return (
    <PhoneFrame time="11:28">
      <AppHeader centered leftAction="‹ Back" rightAction="Edit" title="Preview" subtitle="As customer sees it" />
      <article className="qv-flow-preview">
        <header>
          <div className="qv-flow-business-mark">BC</div>
          <div>
            <strong>Bright Coat Painting</strong>
            <p>quotes@quotevan.com</p>
          </div>
        </header>
        <div className="qv-flow-preview-meta">
          <span><b>Quote</b>#1024</span>
          <span><b>Issued</b>Jul 26</span>
          <span><b>Valid until</b>Aug 7</span>
        </div>
        <section>
          <b>Prepared for</b>
          <strong>Michael</strong>
          <p>18 Victor Ave, Toronto</p>
        </section>
        <PreviewLine title="Paint walls in 2 medium rooms" price="$840" />
        <PreviewLine title="Paint ceilings in 2 medium rooms" price="$360" />
        <PreviewLine title="Paint trim in 2 medium rooms" price="$320" />
        <PreviewLine title="Paint 2 doors" price="$190" />
        <div className="qv-flow-preview-total">
          <span>Total</span>
          <strong>$1,932</strong>
        </div>
        <p className="qv-flow-preview-terms">
          <b>Terms.</b> 50% deposit due to schedule the job, balance due on completion.
        </p>
        <div className="qv-flow-preview-actions">
          <button type="button">Accept quote</button>
          <button type="button">Decline</button>
        </div>
      </article>
      {tapTarget && isActiveTarget(playback, "sendQuote", "send") ? (
        <TapIndicator x={tapTarget.x} y={tapTarget.y} label="Tap send quote" />
      ) : null}
      <div className="qv-flow-bottom-cta">
        <DemoButton className={isActiveTarget(playback, "sendQuote", "send") ? "is-pressed" : undefined}>
          Send quote
        </DemoButton>
      </div>
    </PhoneFrame>
  );
}

function PreviewLine(props: { title: string; price: string }) {
  return (
    <div className="qv-flow-preview-line">
      <span>{props.title}</span>
      <b>{props.price}</b>
    </div>
  );
}
