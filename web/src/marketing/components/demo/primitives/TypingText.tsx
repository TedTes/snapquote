import type { CSSProperties } from "react";

interface TypingTextProps {
  children: string;
  delay?: string;
}

export function TypingText({ children, delay = "0s" }: TypingTextProps) {
  const style = { "--typing-delay": delay } as CSSProperties;

  return (
    <span className="qv-demo-typing" style={style}>
      {children}
    </span>
  );
}
