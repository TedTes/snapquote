import { BrowserFrame, DemoButton, QuoteVanMark, TapIndicator } from "../primitives";
import { isActiveTarget, targetCoordinates } from "../engine/playback";
import type { DemoPlaybackState } from "../engine/types";

interface DemoPublicQuoteScreenProps {
  playback: DemoPlaybackState;
}

export function DemoPublicQuoteScreen({ playback }: DemoPublicQuoteScreenProps) {
  const tapTarget = targetCoordinates(playback.activeEvent?.target);

  return (
    <BrowserFrame address="quotevan.com/q/8f21ac">
      <article className="qv-flow-public-quote">
        <header>
          <QuoteVanMark size={42} framed />
          <div>
            <span>Quote from</span>
            <strong>Bright Coat Painting</strong>
            <p>Quote prepared with QuoteVan</p>
          </div>
        </header>
        <div className="qv-flow-public-meta">
          <span><b>Quote</b>#1024</span>
          <span><b>Valid until</b>Aug 7</span>
        </div>
        <section>
          <b>Prepared for</b>
          <strong>Michael</strong>
          <p>18 Victor Ave, Toronto</p>
        </section>
        <PublicLine title="Paint walls" sub="2 rooms" price="$840" />
        <PublicLine title="Paint ceilings" sub="2 rooms" price="$360" />
        <PublicLine title="Paint trim" sub="2 rooms" price="$320" />
        <PublicLine title="Paint 2 doors" sub="2 each" price="$190" />
        <div className="qv-flow-public-total">
          <span>Total</span>
          <strong>$1,932</strong>
        </div>
      </article>
      {tapTarget && isActiveTarget(playback, "acceptQuote", "tap") ? (
        <TapIndicator x={tapTarget.x} y={tapTarget.y} label="Accept" />
      ) : null}
      <div className="qv-flow-public-actions">
        <DemoButton className={isActiveTarget(playback, "acceptQuote", "tap") ? "is-pressed" : undefined}>
          Accept quote
        </DemoButton>
        <DemoButton tone="secondary">Decline</DemoButton>
      </div>
    </BrowserFrame>
  );
}

function PublicLine(props: { title: string; sub: string; price: string }) {
  return (
    <div className="qv-flow-public-line">
      <span><b>{props.title}</b><small>{props.sub}</small></span>
      <strong>{props.price}</strong>
    </div>
  );
}
