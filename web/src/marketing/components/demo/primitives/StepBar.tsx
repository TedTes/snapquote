interface StepBarProps {
  steps: string[];
  activeIndex: number;
}

export function StepBar({ steps, activeIndex }: StepBarProps) {
  return (
    <div className="qv-demo-stepbar">
      <div className="qv-demo-stepbar-lines">
        {steps.map((step, index) => (
          <span className={index <= activeIndex ? "is-active" : undefined} key={step} />
        ))}
      </div>
      <div className="qv-demo-stepbar-labels">
        {steps.map((step, index) => (
          <span className={index === activeIndex ? "is-active" : undefined} key={step}>
            {step}
          </span>
        ))}
      </div>
    </div>
  );
}
