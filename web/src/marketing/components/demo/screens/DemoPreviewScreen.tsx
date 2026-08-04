import { AppHeader, DemoButton, DemoSheet, PhoneFrame, TapIndicator } from "../primitives";
import { isActiveTarget, targetCoordinates } from "../engine/playback";
import type { DemoPlaybackState } from "../engine/types";

interface DemoPreviewScreenProps {
  playback: DemoPlaybackState;
}

export function DemoPreviewScreen({ playback }: DemoPreviewScreenProps) {
  const tapTarget = targetCoordinates(playback.activeEvent?.target);
  const showSendSheet = playback.elapsedMs >= 2300;
  const sendingNow = isActiveTarget(playback, "sendQuote", "send");
  const previewScrollOffset = getPreviewScrollOffset(playback.elapsedMs);

  return (
    <PhoneFrame className="qv-flow-preview-screen" time="9:14">
      <AppHeader centered leftAction="‹ Back" rightAction="Edit" title="Preview" subtitle="As customer sees it" />
      <div className="qv-flow-preview-scroll" style={{ transform: `translateY(-${previewScrollOffset}px)` }}>
        <article className="qv-flow-preview">
          <header>
            <div className="qv-flow-business-mark">QV</div>
            <div>
              <strong>QuoteVan</strong>
              <p>np8cscwhf5@privaterelay.appleid.com</p>
            </div>
          </header>
          <div className="qv-flow-preview-meta">
            <span><b>Quote</b>#6DAF</span>
            <span><b>Issued</b>Aug 4</span>
            <span><b>Valid until</b>Aug 17</span>
          </div>
          <section>
            <b>Prepared for</b>
            <strong>John Doe</strong>
            <p>Toronto</p>
          </section>
          <section>
            <b>Scope of work</b>
            <p>Painting of two medium-sized rooms including walls, ceilings, and trim with two coats, using customer-supplied paint and normal surface preparation.</p>
          </section>
          <PreviewLine title="Paint walls in 2 medium rooms" price="$840" />
          <PreviewLine title="Paint ceilings in 2 medium rooms" price="$360" />
          <PreviewLine title="Paint trim in 2 medium rooms" price="$320" />
          <PreviewLine title="Paint 2 doors" price="$190" />
          <PreviewLine title="Surface preparation for painting in two medium rooms" price="$20" />
          <PreviewLine title="Painting walls in two medium rooms with two coats" price="$46" />
          <PreviewLine title="Providing painting labour" price="$10" />
          <div className="qv-flow-preview-total">
            <span><b>Subtotal</b>$1,786</span>
            <span><b>Tax (13%)</b>$232</span>
            <strong>$2,018</strong>
          </div>
          <p className="qv-flow-preview-terms">
            <b>Terms.</b> 50% deposit due to schedule the job, balance due on completion.
          </p>
          <div className="qv-flow-preview-actions">
            <button type="button">Accept quote</button>
            <button type="button">Decline</button>
          </div>
        </article>
      </div>
      {showSendSheet ? <div className="qv-flow-preview-dim" aria-hidden="true" /> : null}
      {showSendSheet ? (
        <DemoSheet className="qv-flow-send-sheet" title="Send quote" body="$2,018 to John Doe">
          <div className="qv-flow-send-option is-ready">
            <span aria-hidden="true">✉</span>
            <b>Email link<small>tedtfu@gmail.com</small></b>
            <strong>Ready</strong>
          </div>
          <div className="qv-flow-send-option is-disabled">
            <span aria-hidden="true">◌</span>
            <b>Text link<small>Coming soon</small></b>
          </div>
          <div className="qv-flow-send-safe">All lines priced — safe to send.</div>
          <DemoButton className={sendingNow ? "is-pressed" : undefined}>Send email now</DemoButton>
          <button className="qv-flow-send-cancel" type="button">Cancel</button>
        </DemoSheet>
      ) : null}
      {tapTarget && sendingNow ? (
        <TapIndicator x={tapTarget.x} y={tapTarget.y} label="Tap send quote" />
      ) : null}
      <div className={showSendSheet ? "qv-flow-bottom-cta is-hidden" : "qv-flow-bottom-cta"}>
        <DemoButton className={isActiveTarget(playback, "sendQuote", "send") ? "is-pressed" : undefined}>
          Send quote
        </DemoButton>
      </div>
    </PhoneFrame>
  );
}

function getPreviewScrollOffset(elapsedMs: number) {
  const scrollDown = smoothProgress((elapsedMs - 320) / 1300);
  const settle = smoothProgress((elapsedMs - 1820) / 360);
  return Math.round(scrollDown * (1 - settle * 0.18) * 250);
}

function smoothProgress(value: number) {
  const progress = Math.min(Math.max(value, 0), 1);
  return progress * progress * (3 - 2 * progress);
}

function PreviewLine(props: { title: string; price: string }) {
  return (
    <div className="qv-flow-preview-line">
      <span>{props.title}</span>
      <b>{props.price}</b>
    </div>
  );
}
