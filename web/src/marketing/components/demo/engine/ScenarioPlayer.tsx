import type { DemoScenarioStep, DemoScreenRenderer } from "./types";
import { useScenarioPlayer } from "./useScenarioPlayer";
import { cx } from "../primitives/utils";

interface ScenarioPlayerProps {
  steps: DemoScenarioStep[];
  renderScreen: DemoScreenRenderer;
  className?: string;
  timeScale?: number;
}

export function ScenarioPlayer({ steps, renderScreen, className, timeScale = 1.45 }: ScenarioPlayerProps) {
  const player = useScenarioPlayer(steps, { timeScale });
  const { state } = player;

  return (
    <div className={cx("qv-flow-player", className)}>
      <div className="qv-flow-screen-stage">{renderScreen(state)}</div>
    </div>
  );
}
