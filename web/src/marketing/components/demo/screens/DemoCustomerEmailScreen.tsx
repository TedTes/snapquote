import { AppHeader, BrowserFrame, QuoteVanMark, TapIndicator } from "../primitives";
import { isActiveTarget, targetCoordinates } from "../engine/playback";
import type { DemoPlaybackState } from "../engine/types";

interface DemoCustomerEmailScreenProps {
  playback: DemoPlaybackState;
}

export function DemoCustomerEmailScreen({ playback }: DemoCustomerEmailScreenProps) {
  const tapTarget = targetCoordinates(playback.activeEvent?.target);

  return (
    <BrowserFrame className="qv-flow-mail-browser" address="mail.inboxapp.com/u/0/inbox">
      <div className="qv-flow-mail-shell">
        <aside className="qv-flow-mail-sidebar">
          <button type="button">Compose</button>
          <span className="is-selected">Inbox <b>197</b></span>
          <span>Starred</span>
          <span>Sent</span>
          <span>Drafts</span>
        </aside>
        <main className="qv-flow-mail-main">
          <AppHeader leftAction="‹" title="Inbox" subtitle="Michael's email" />
          <div className="qv-flow-mail-search">Search mail</div>
          <div className="qv-flow-mail-tabs">
            <span className="is-selected">Primary</span>
            <span>Promotions</span>
            <span>Updates</span>
          </div>
          <div className="qv-flow-email-list">
            <EmailListRow sender="Glassdoor Jobs" subject="New jobs near Toronto" time="10:48 AM" muted />
            <EmailListRow sender="Porkbun" subject="Domain registration receipt" time="10:42 AM" muted />
            <EmailListRow sender="QuoteVan" subject="Quote from Bright Coat Painting · $1,932" time="Now" active />
            <EmailListRow sender="Cloudflare" subject="quotevan.com is now active" time="9:51 AM" muted />
          </div>
          <article className="qv-flow-email-preview">
            <header>
              <QuoteVanMark size={30} framed />
              <div>
                <span>Quote from</span>
                <strong>Bright Coat Painting</strong>
              </div>
            </header>
            <p>Hi Michael, your quote for $1,932 is ready.</p>
            <button type="button">View quote</button>
          </article>
        </main>
      </div>
      {tapTarget && isActiveTarget(playback, "quoteEmail", "tap") ? (
        <TapIndicator x={tapTarget.x} y={tapTarget.y} label="Open email" />
      ) : null}
    </BrowserFrame>
  );
}

function EmailListRow(props: { sender: string; subject: string; time: string; active?: boolean; muted?: boolean }) {
  return (
    <div className={`qv-flow-email-row ${props.active ? "is-active" : ""} ${props.muted ? "is-muted" : ""}`}>
      <i />
      <div>
        <strong>{props.sender}</strong>
        <p>{props.subject}</p>
      </div>
      <time>{props.time}</time>
    </div>
  );
}
