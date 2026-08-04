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
        <p>Fix any words — you can still edit every line after.</p>

        <div className="qv-flow-locked-checklist">
          <i aria-hidden="true" />
          <strong>Checklist locked: 2 medium rooms · walls, ceilings, trim · 2 doors · 2 coats. Voice only adds the extras below.</strong>
        </div>

        <div className="qv-flow-transcript-head">
          <span>What you said</span>
          <b>tap to edit</b>
        </div>

        <div className="qv-flow-transcript-card">
          <div>
            <span>0:07</span>
            <b>Re-listen</b>
          </div>
          <p>No extra notes. The quote will be built from the locked checklist.</p>
        </div>

        <div className="qv-flow-transcript-head">
          <span>Extras detected</span>
          <b>confirm before drafting</b>
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
