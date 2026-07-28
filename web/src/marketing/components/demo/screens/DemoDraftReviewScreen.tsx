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
] as const;

export function DemoDraftReviewScreen({ playback }: DemoDraftReviewScreenProps) {
  const tapTarget = targetCoordinates(playback.activeEvent?.target);
  const resolvedCount = draftLines.filter(([id]) => (
    hasPassedEvent(playback, id, "resolve") || isActiveTarget(playback, id, "resolve")
  )).length;
  const visibleLines = draftLines.filter(([id]) => (
    hasPassedEvent(playback, id, "resolve") || isActiveTarget(playback, id, "resolve")
  ));
  const coverageText = resolvedCount === 4
    ? "All 4 lines priced from your book"
    : resolvedCount === 0
      ? "Voice captured. Matching your book..."
      : `${resolvedCount} of 4 lines matched from your book`;

  return (
    <PhoneFrame time="11:28">
      <AppHeader leftAction="‹" rightAction="···" title="Michael" subtitle="Draft · Add" />

      <div className={resolvedCount === 4 ? "qv-flow-priced-banner" : "qv-flow-priced-banner is-building"}>
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

      <button className="qv-flow-add-line" type="button">+ Add a line</button>

      {tapTarget && isActiveTarget(playback, "previewSend", "tap") ? (
        <TapIndicator x={tapTarget.x} y={tapTarget.y} label="Tap preview and send" />
      ) : null}
      <div className="qv-flow-total-footer">
        <span>Total <b>{resolvedCount === 4 ? "Ready to send" : "Building quote"}</b></span>
        <strong>
          {resolvedCount === 4 ? "$1,932" : "$--"}
          <small>{resolvedCount === 4 ? "incl. $222 tax" : "matching prices"}</small>
        </strong>
        <DemoButton
          className={isActiveTarget(playback, "previewSend", "tap") ? "is-pressed" : undefined}
          disabled={resolvedCount !== 4}
        >
          {resolvedCount === 4 ? "Preview & send" : "Matching prices..."}
        </DemoButton>
      </div>
    </PhoneFrame>
  );
}
