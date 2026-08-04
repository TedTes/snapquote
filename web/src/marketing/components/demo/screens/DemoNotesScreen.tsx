import { DemoButton, PhoneFrame, StepBar, WizardHeader } from "../primitives";
import { isActiveTarget } from "../engine/playback";
import type { DemoPlaybackState } from "../engine/types";

interface DemoNotesScreenProps {
  playback: DemoPlaybackState;
}

export function DemoNotesScreen({ playback }: DemoNotesScreenProps) {
  const isRecording = playback.activeEvent?.type === "record";

  return (
    <PhoneFrame time="9:14">
      <WizardHeader step="3 / 4" />
      <StepBar steps={["Customer", "Job", "Notes", "Review"]} activeIndex={2} />

      <section className="qv-flow-notes">
        <h3>Anything else on this job?</h3>
        <p>Talk it through or type it — whatever's faster on site.</p>

        <div className={isRecording ? "qv-flow-unified-note is-recording" : "qv-flow-unified-note"}>
          <div className="qv-flow-note-placeholder">
            {isRecording ? (
              <span>Listening...</span>
            ) : (
              <span>Type anything the checklist didn't cover...</span>
            )}
          </div>
          <div className="qv-flow-note-footer">
            <small>{isRecording ? "0:07 · tap mic to stop" : "Adds scope, never prices"}</small>
            <button aria-label="Record note" data-demo-target="mic" type="button">
              {isRecording ? <i aria-hidden="true" /> : <span className="qv-flow-mic-glyph" aria-hidden="true" />}
            </button>
          </div>
          {isRecording ? (
            <div className="qv-flow-note-wave" aria-hidden="true">
              {Array.from({ length: 17 }, (_, index) => <i key={index} />)}
            </div>
          ) : null}
        </div>

        <b className="qv-flow-chip-label">Quick add</b>
        <div className="qv-flow-chip-row">
          <button type="button"><span />patch holes</button>
          <button type="button"><span />wallpaper</button>
          <button type="button"><span />primer</button>
          <button type="button"><span />materials</button>
        </div>
      </section>

      <div className="qv-flow-bottom-cta">
        <DemoButton className={isActiveTarget(playback, "nextButton", "tap") ? "is-pressed" : undefined}>
          Next — review →
        </DemoButton>
      </div>
    </PhoneFrame>
  );
}
