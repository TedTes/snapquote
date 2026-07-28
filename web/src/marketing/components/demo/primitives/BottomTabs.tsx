import type { DemoTab } from "./types";
import { cx } from "./utils";

interface BottomTabsProps {
  active?: DemoTab;
}

const tabs: Array<{ id: DemoTab; label: string; icon?: DemoTabIcon }> = [
  { id: "today", label: "Today", icon: "home" },
  { id: "quotes", label: "Quotes", icon: "clipboardList" },
  { id: "new", label: "" },
  { id: "priceBook", label: "Price", icon: "book" },
  { id: "settings", label: "Settings", icon: "gear" },
];

type DemoTabIcon = "home" | "clipboardList" | "book" | "gear";

export function BottomTabs({ active = "today" }: BottomTabsProps) {
  return (
    <nav className="qv-demo-bottom-tabs" aria-label="Demo tabs">
      {tabs.map((tab) =>
        tab.id === "new" ? (
          <button className="qv-demo-tab-fab" key={tab.id} type="button" aria-label="New quote">
            <span>+</span>
          </button>
        ) : (
          <span className={cx("qv-demo-tab", active === tab.id && "is-active")} key={tab.id}>
            {tab.icon ? <TabIcon name={tab.icon} /> : null}
            {tab.label}
          </span>
        ),
      )}
    </nav>
  );
}

function TabIcon({ name }: { name: DemoTabIcon }) {
  return (
    <svg aria-hidden="true" className="qv-demo-tab-icon" fill="none" viewBox="0 0 24 24">
      {name === "home" ? (
        <>
          <path d="m3 10.5 9-7 9 7" />
          <path d="M5 10v10h14V10" />
          <path d="M9 20v-6h6v6" />
        </>
      ) : null}
      {name === "clipboardList" ? (
        <>
          <rect height="4" rx="1" width="8" x="8" y="2" />
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          <path d="M8 11h8" />
          <path d="M8 16h8" />
          <path d="M6 11h.01" />
          <path d="M6 16h.01" />
        </>
      ) : null}
      {name === "book" ? (
        <>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
        </>
      ) : null}
      {name === "gear" ? (
        <>
          <path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3a2 2 0 1 1 4 0v.1A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.13.38.35.72.6 1 .31.27.7.42 1.1.4h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.7.6Z" />
        </>
      ) : null}
    </svg>
  );
}
