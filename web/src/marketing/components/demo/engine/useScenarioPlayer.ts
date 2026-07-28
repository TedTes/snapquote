import { useEffect, useMemo, useState } from "react";
import type { DemoPlaybackState, DemoScenarioEvent, DemoScenarioStep } from "./types";

interface ScenarioPlayerOptions {
  autoPlay?: boolean;
  timeScale?: number;
}

export function useScenarioPlayer(steps: DemoScenarioStep[], options: ScenarioPlayerOptions = {}) {
  const { autoPlay = true, timeScale = 1 } = options;
  const prefersReducedMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  // Reduced motion: skip the autoplay loop entirely and render one settled, final
  // state (last step, fully elapsed) instead of continuing to cycle through screens.
  const initialStepIndex = prefersReducedMotion ? steps.length - 1 : 0;
  const [stepIndex, setStepIndex] = useState(initialStepIndex);
  const [isPlaying, setIsPlaying] = useState(autoPlay && !prefersReducedMotion);
  const [elapsedMs, setElapsedMs] = useState(prefersReducedMotion ? steps[initialStepIndex]?.durationMs ?? 0 : 0);
  const [progress, setProgress] = useState(prefersReducedMotion ? 1 : 0);

  const step = steps[stepIndex] ?? steps[0];

  useEffect(() => {
    if (prefersReducedMotion) {
      return;
    }

    setProgress(0);
    setElapsedMs(0);
  }, [stepIndex, prefersReducedMotion]);

  useEffect(() => {
    if (!isPlaying || !step || prefersReducedMotion) {
      return;
    }

    const startedAt = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const scaledDurationMs = step.durationMs * timeScale;
      const nextProgress = Math.min((now - startedAt) / scaledDurationMs, 1);
      const nextElapsedMs = Math.min((now - startedAt) / timeScale, step.durationMs);
      setElapsedMs(nextElapsedMs);
      setProgress(nextProgress);

      if (nextProgress >= 1) {
        setStepIndex((current) => (current + 1) % steps.length);
        return;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, step, steps.length, timeScale]);

  const activeEvent = useMemo(
    () => getActiveEvent(step?.events ?? [], elapsedMs),
    [elapsedMs, step?.events],
  );

  const eventProgress = useMemo(
    () => {
      if (!activeEvent) {
        return 0;
      }

      const durationMs = activeEvent.durationMs ?? 450;
      return Math.min(Math.max((elapsedMs - activeEvent.atMs) / durationMs, 0), 1);
    },
    [activeEvent, elapsedMs],
  );

  const state = useMemo<DemoPlaybackState>(
    () => ({
      step,
      activeEvent,
      stepIndex,
      totalSteps: steps.length,
      elapsedMs,
      progress,
      eventProgress,
      isPlaying,
    }),
    [activeEvent, elapsedMs, eventProgress, isPlaying, progress, step, stepIndex, steps.length],
  );

  return {
    state,
    pause: () => setIsPlaying(false),
    play: () => setIsPlaying(true),
    toggle: () => setIsPlaying((current) => !current),
    next: () => setStepIndex((current) => (current + 1) % steps.length),
    previous: () => setStepIndex((current) => (current - 1 + steps.length) % steps.length),
    goTo: (index: number) => setStepIndex(clampStep(index, steps.length)),
  };
}

function clampStep(index: number, length: number) {
  return Math.max(0, Math.min(index, length - 1));
}

function getActiveEvent(events: DemoScenarioEvent[], elapsedMs: number) {
  return events.find((event) => {
    const durationMs = event.durationMs ?? 450;
    return elapsedMs >= event.atMs && elapsedMs <= event.atMs + durationMs;
  });
}
