interface TimelineProps {
  items: Array<{ label: string; meta?: string; pending?: boolean }>;
}

export function Timeline({ items }: TimelineProps) {
  return (
    <div className="qv-demo-timeline">
      {items.map((item) => (
        <div className={item.pending ? "is-pending" : undefined} key={item.label}>
          <i aria-hidden="true" />
          <strong>{item.label}</strong>
          {item.meta ? <p>{item.meta}</p> : null}
        </div>
      ))}
    </div>
  );
}
