import { DemoButton, PhoneFrame, StepBar, WizardHeader } from "../primitives";
import { hasPassedEvent, isActiveTarget } from "../engine/playback";
import type { DemoPlaybackState } from "../engine/types";

interface DemoNotesScreenProps {
  playback: DemoPlaybackState;
}

const recordedNoteText =
  "Paint the living room, hallway, and two bedrooms. Patch small nail holes, sand rough areas, apply primer where needed, then two coats on the walls.";

export function DemoNotesScreen({ playback }: DemoNotesScreenProps) {
  const isRecording = isActiveTarget(playback, "mic", "record");
  const hasRecorded = isRecording || hasPassedEvent(playback, "mic", "record");
  const visibleNoteText = hasRecorded
    ? recordedNoteText.slice(0, Math.ceil(recordedNoteText.length * (isRecording ? playback.eventProgress : 1)))
    : "";
  const noteClassName = [
    "qv-flow-unified-note",
    isRecording ? "is-recording" : "",
    hasRecorded ? "has-transcript" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <PhoneFrame time="9:14">
      <WizardHeader step="3 / 4" />
      <StepBar steps={["Customer", "Job", "Notes", "Review"]} activeIndex={2} />

      <section className="qv-flow-notes">
        <h3>Anything else on this job?</h3>
        <p>Talk it through or type it — whatever's faster on site.</p>

        <div className={noteClassName}>
          <div className="qv-flow-note-placeholder">
            {hasRecorded ? (
              <span className="qv-flow-note-transcript">
                {visibleNoteText}
                {isRecording ? <i aria-hidden="true" /> : null}
              </span>
            ) : (
              <span>Type anything the checklist didn't cover...</span>
            )}
          </div>
          <div className="qv-flow-note-footer">
            <small>{isRecording ? "Capturing scope" : hasRecorded ? "Voice note added" : "Adds scope, never prices"}</small>
            <button aria-label="Record note" aria-pressed={isRecording} data-demo-target="mic" type="button">
              <span className="qv-flow-mic-glyph" aria-hidden="true" />
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
