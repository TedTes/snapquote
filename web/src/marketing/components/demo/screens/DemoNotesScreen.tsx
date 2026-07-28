import { AppHeader, DemoButton, PhoneFrame, StepBar } from "../primitives";
import type { DemoPlaybackState } from "../engine/types";

interface DemoNotesScreenProps {
  playback: DemoPlaybackState;
}

export function DemoNotesScreen({ playback }: DemoNotesScreenProps) {
  const isRecording = playback.activeEvent?.type === "record";

  return (
    <PhoneFrame time="11:28">
      <AppHeader centered leftAction="‹" title="New quote" subtitle="3 / 4" />
      <StepBar steps={["Customer", "Job", "Notes", "Review"]} activeIndex={2} />

      <section className="qv-flow-notes">
        <h3>Anything else on this job?</h3>
        <p>Talk it through, or tap extras below.</p>
        <div className={isRecording ? "qv-flow-recording is-active" : "qv-flow-recording"}>
          <span />
          <strong>{isRecording ? "0:24 · tap to stop" : "Tap to talk"}</strong>
          <div aria-hidden="true">
            {Array.from({ length: 22 }, (_, index) => <i key={index} />)}
          </div>
        </div>
        <small>Saved on your phone as you talk</small>
        <div className="qv-flow-chip-row">
          <button type="button">+ patch holes</button>
          <button type="button">+ wallpaper</button>
          <button type="button">+ primer</button>
          <button type="button">+ materials</button>
        </div>
      </section>

      <div className="qv-flow-bottom-cta">
        <DemoButton disabled={isRecording}>{isRecording ? "Stop recording to continue" : "Next — review →"}</DemoButton>
      </div>
    </PhoneFrame>
  );
}
