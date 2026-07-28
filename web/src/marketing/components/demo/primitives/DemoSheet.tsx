import type { ReactNode } from "react";
import { cx } from "./utils";

interface DemoSheetProps {
  title: string;
  body?: string;
  children?: ReactNode;
  className?: string;
}

export function DemoSheet({ title, body, children, className }: DemoSheetProps) {
  return (
    <section className={cx("qv-demo-sheet", className)}>
      <i aria-hidden="true" />
      <h3>{title}</h3>
      {body ? <p>{body}</p> : null}
      {children}
    </section>
  );
}
