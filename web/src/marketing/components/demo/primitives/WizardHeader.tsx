import type { ReactNode } from "react";

interface WizardHeaderProps {
  leftAction?: ReactNode;
  step: string;
  title?: string;
}

export function WizardHeader({ leftAction = "‹", step, title = "New quote" }: WizardHeaderProps) {
  return (
    <header className="qv-demo-wizard-header">
      <div className="qv-demo-header-action">{leftAction}</div>
      <strong>{title}</strong>
      <span>{step}</span>
    </header>
  );
}
