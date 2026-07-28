import type { ReactNode } from "react";

interface FloatingActionButtonProps {
  children?: ReactNode;
  label?: string;
}

export function FloatingActionButton({ children = "+", label = "New quote" }: FloatingActionButtonProps) {
  return (
    <button className="qv-demo-floating-action" type="button" aria-label={label}>
      {children}
    </button>
  );
}
