import { useEffect, useState, type RefObject } from "react";
import { targetCoordinates, type TargetCoordinates } from "./playback";

export function useMeasuredTargetCoordinates(
  containerRef: RefObject<HTMLElement | null>,
  target?: string,
): TargetCoordinates | undefined {
  const [coordinates, setCoordinates] = useState<TargetCoordinates | undefined>(() => targetCoordinates(target));

  useEffect(() => {
    if (!target) {
      setCoordinates(undefined);
      return;
    }

    const measure = () => {
      const container = containerRef.current;
      const targetElement = container?.querySelector<HTMLElement>(`[data-demo-target="${target}"]`);
      const frame = container?.closest<HTMLElement>(".qv-demo-phone, .qv-demo-browser");

      if (!targetElement || !frame) {
        setCoordinates(targetCoordinates(target));
        return;
      }

      const targetRect = targetElement.getBoundingClientRect();
      const frameRect = frame.getBoundingClientRect();

      setCoordinates({
        x: `${targetRect.left - frameRect.left + targetRect.width / 2}px`,
        y: `${targetRect.top - frameRect.top + targetRect.height / 2}px`,
      });
    };

    const frameId = window.requestAnimationFrame(measure);
    window.addEventListener("resize", measure);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", measure);
    };
  }, [containerRef, target]);

  return coordinates;
}
