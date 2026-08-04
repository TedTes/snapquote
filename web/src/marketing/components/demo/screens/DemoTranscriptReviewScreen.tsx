import { DemoButton, PhoneFrame, StepBar, TapIndicator, WizardHeader } from "../primitives";
import { isActiveTarget, targetCoordinates } from "../engine/playback";
import type { DemoPlaybackState } from "../engine/types";

interface DemoTranscriptReviewScreenProps {
  playback: DemoPlaybackState;
}

export function DemoTranscriptReviewScreen({ playback }: DemoTranscriptReviewScreenProps) {
  const tapTarget = targetCoordinates(playback.activeEvent?.target);

  return (
    <PhoneFrame className="qv-flow-transcript-screen" time="9:14">
      <WizardHeader step="4 / 4" />
      <StepBar steps={["Customer", "Job", "Notes", "Review"]} activeIndex={3} />

      <section className="qv-flow-transcript">
        <h3>Check before drafting</h3>
        <p>The job details are locked. Review the note before QuoteVan builds the draft.</p>

        <div className="qv-flow-review-stack">
          <article className="qv-flow-locked-summary-card">
            <div className="qv-flow-locked-summary-head">
              <i aria-hidden="true" />
              <span>
                <b>Locked job checklist</b>
                <small>Prices will come from your price book.</small>
              </span>
            </div>
            <div className="qv-flow-summary-lines" aria-label="Draft source">
              <span><b>Rooms</b><small>2 medium</small></span>
              <span><b>Surfaces</b><small>Walls, ceilings, trim</small></span>
              <span><b>Doors</b><small>2 doors</small></span>
              <span><b>Coats</b><small>2 coats</small></span>
            </div>
          </article>

          <article className="qv-flow-note-review-card">
            <div className="qv-flow-note-review-head">
              <span>What you said</span>
              <button type="button">Re-listen</button>
            </div>
            <p>No extra notes.</p>
            <small>Nothing else will be added before drafting.</small>
          </article>

          <article className="qv-flow-draft-ready-card">
            <i aria-hidden="true" />
            <span>
              <b>Ready to generate 7 quote lines</b>
              <small>Walls, ceilings, trim, doors, prep, and labour stay editable.</small>
            </span>
          </article>
        </div>
      </section>

      {tapTarget && isActiveTarget(playback, "generateDraft", "tap") ? (
        <TapIndicator x={tapTarget.x} y={tapTarget.y} label="Generate draft" />
      ) : null}
      <div className="qv-flow-bottom-cta">
        <DemoButton className={isActiveTarget(playback, "generateDraft", "tap") ? "is-pressed" : undefined}>
          Generate draft →
        </DemoButton>
        <button className="qv-flow-back-link" type="button">← Back to notes</button>
      </div>
    </PhoneFrame>
  );
}
