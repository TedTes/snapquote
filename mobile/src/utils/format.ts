export function formatMoney(cents: number | null): string {
  if (cents === null) {
    return "$--";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(cents / 100);
}

export function formatShortDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(iso));
}

export function formatLongDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(iso)
  );
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(iso));
}

const unitLabels: Record<string, [string, string]> = {
  room: ["room", "rooms"],
  each: ["each", "each"],
  hour: ["hour", "hours"],
  flat: ["flat fee", "flat fee"],
  sqft: ["sq ft", "sq ft"],
  lnft: ["linear ft", "linear ft"],
  day: ["day", "days"]
};

export function describeQuantity(quantity: number, unit: string | null): string {
  const qty = Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(1);

  if (unit === null) {
    return qty;
  }

  return `${qty} ${unitLabel(unit, quantity)}`;
}

function unitLabel(unit: string, quantity: number): string {
  const pair = unitLabels[unit];

  if (!pair) {
    return unit;
  }

  return quantity === 1 ? pair[0] : pair[1];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "QV";
  }

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function displayBusinessName(name: string | null | undefined, fallback = "Your business"): string {
  const trimmedName = typeof name === "string" ? name.trim() : "";
  return trimmedName.length > 0 ? trimmedName : fallback;
}

export function businessInitials(name: string | null | undefined): string {
  return initials(displayBusinessName(name));
}

export function formatRelativeToNow(iso: string, now = new Date()): string {
  const then = new Date(iso);
  const diffMs = now.getTime() - then.getTime();
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  if (days <= 0) {
    return "today";
  }

  if (days === 1) {
    return "yesterday";
  }

  return `${days} days ago`;
}
