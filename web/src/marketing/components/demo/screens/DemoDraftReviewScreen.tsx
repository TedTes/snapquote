import { AppHeader, DemoButton, DraftLine, PhoneFrame, TapIndicator, TrustSwatch } from "../primitives";
import { hasPassedEvent, isActiveTarget, targetCoordinates } from "../engine/playback";
import type { DemoPlaybackState } from "../engine/types";

interface DemoDraftReviewScreenProps {
  playback: DemoPlaybackState;
}

const draftLines = [
  ["line-1", "Paint walls", "2 rooms · from your book", "$840"],
  ["line-2", "Paint ceilings", "2 rooms · from your book", "$360"],
  ["line-3", "Paint trim", "2 rooms · from your book", "$320"],
  ["line-4", "Paint 2 doors", "2 each · from your book", "$190"],
  ["line-5", "Surface preparation for painting", "2 flat fee · from your book", "$20"],
  ["line-6", "Painting walls in two medium rooms", "2 flat fee · from your book", "$46"],
  ["line-7", "Providing painting labour", "2 flat fee · from your book", "$10"],
] as const;

export function DemoDraftReviewScreen({ playback }: DemoDraftReviewScreenProps) {
  const tapTarget = targetCoordinates(playback.activeEvent?.target);
  const resolvedCount = draftLines.filter(([id]) => (
    hasPassedEvent(playback, id, "resolve") || isActiveTarget(playback, id, "resolve")
  )).length;
  const visibleLines = draftLines.filter(([id]) => (
    hasPassedEvent(playback, id, "resolve") || isActiveTarget(playback, id, "resolve")
  ));
  const coverageText = resolvedCount === draftLines.length
    ? "All 7 lines priced from your book"
    : resolvedCount === 0
      ? "Voice captured. Matching your book..."
      : `${resolvedCount} of 7 lines matched from your book`;

  return (
    <PhoneFrame className="qv-flow-draft-review-screen" time="9:14">
      <AppHeader leftAction="‹" rightAction="···" title="John Doe" subtitle="Draft" />

      <div className={resolvedCount === draftLines.length ? "qv-flow-priced-banner" : "qv-flow-priced-banner is-building"}>
        <TrustSwatch state="confirmed" size="dot" />
        <strong>{coverageText}</strong>
      </div>

      <div className="qv-flow-card-stack">
        {visibleLines.map(([id, title, detail, price]) => {
          const isActiveLine = isActiveTarget(playback, id, "resolve");
          const priceHasLanded = hasPassedEvent(playback, id, "resolve") || !isActiveLine || playback.eventProgress >= 0.52;

          return (
            <DraftLine
              className={priceHasLanded ? "is-transcribed is-price-landed" : "is-transcribed is-price-pending"}
              detail={priceHasLanded ? detail : "transcribing from voice..."}
              key={id}
              price={priceHasLanded ? price : "$--"}
              title={title}
              trustState={priceHasLanded ? "confirmed" : "neutral"}
            />
          );
        })}
      </div>

      {tapTarget && isActiveTarget(playback, "previewSend", "tap") ? (
        <TapIndicator x={tapTarget.x} y={tapTarget.y} label="Tap preview and send" />
      ) : null}
      <div className="qv-flow-total-footer">
        <span>Total <b>{resolvedCount === draftLines.length ? "Ready to send" : "Building quote"}</b></span>
        <strong>
          {resolvedCount === draftLines.length ? "$2,018" : "$--"}
          <small>{resolvedCount === draftLines.length ? "incl. $232 tax" : "matching prices"}</small>
        </strong>
        <DemoButton
          className={isActiveTarget(playback, "previewSend", "tap") ? "is-pressed" : undefined}
          disabled={resolvedCount !== draftLines.length}
        >
          {resolvedCount === draftLines.length ? "Preview & send" : "Matching prices..."}
        </DemoButton>
        <button className="qv-flow-save-draft-link" type="button">Save draft for later</button>
      </div>
    </PhoneFrame>
  );
}
