import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";

const apiBaseUrl = (import.meta.env.VITE_SNAPQUOTE_API_URL ?? "https://dctmpfrbkgntiuhjbblu.functions.supabase.co/snapquote").replace(/\/$/, "");

type PainterChecklist = {
  rooms: { small: number; medium: number; large: number };
  surfaces: { walls: boolean; ceilings: boolean; trim: boolean };
  doorCount: number;
  prepLevel: "light" | "normal" | "heavy";
  coatCount: 1 | 2;
  customerSuppliesPaint: boolean;
};

type EstimateOrg = {
  id: string;
  name: string;
  trade: string;
  logoUrl: string | null;
  contactPhone: string | null;
  website: string | null;
  currency: string;
};

type EstimateOrgResponse = {
  org: EstimateOrg;
  defaults: {
    checklist: PainterChecklist;
    currency: string;
  };
};

type EstimateLine = {
  position: number;
  description: string;
  quantity: number;
  unit: string | null;
  unitPriceCents: number | null;
  matchState: "green" | "yellow" | "red";
  kind: "labour" | "material";
};

type EstimateResponse = {
  requestId: string;
  quoteId: string;
  org: EstimateOrg;
  estimate: {
    lowCents: number;
    highCents: number;
    currency: string;
    confidence: "price_book_confirmed" | "price_book_suggested" | "needs_review";
    disclaimer: string;
  };
  lineItems: EstimateLine[];
  scopeSummary: string;
  status: "draft_created";
};

type OrgState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; org: EstimateOrg; defaults: EstimateOrgResponse["defaults"] };

const fallbackChecklist: PainterChecklist = {
  rooms: { small: 0, medium: 2, large: 0 },
  surfaces: { walls: true, ceilings: false, trim: false },
  doorCount: 0,
  prepLevel: "normal",
  coatCount: 2,
  customerSuppliesPaint: true
};

export function EstimatePage(props: { orgId: string; embed?: boolean }) {
  const { orgId, embed = false } = props;
  const [orgState, setOrgState] = useState<OrgState>({ kind: "loading" });
  const [customerName, setCustomerName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [notes, setNotes] = useState("");
  const [company, setCompany] = useState("");
  const [checklist, setChecklist] = useState<PainterChecklist>(fallbackChecklist);
  const [submitState, setSubmitState] = useState<"idle" | "submitting">("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EstimateResponse | null>(null);

  useEffect(() => {
    let canceled = false;

    async function loadOrg() {
      try {
        const response = await api<EstimateOrgResponse>(`/public/estimate-orgs/${encodeURIComponent(orgId)}`);

        if (!canceled) {
          setOrgState({ kind: "ready", org: response.org, defaults: response.defaults });
          setChecklist(response.defaults.checklist);
        }
      } catch {
        if (!canceled) {
          setOrgState({ kind: "error", message: "This estimate form is not available. Ask the contractor for a direct link." });
        }
      }
    }

    void loadOrg();
    return () => {
      canceled = true;
    };
  }, [orgId]);

  const org = orgState.kind === "ready" ? orgState.org : null;
  const currency = org?.currency ?? "cad";
  const hasContact = email.trim().length > 0 || phone.trim().length > 0;
  const canSubmit = customerName.trim().length > 0 && address.trim().length > 0 && hasContact && submitState === "idle";
  const rangeText = useMemo(() => {
    if (!result) return "";
    return `${formatMoney(result.estimate.lowCents, result.estimate.currency)} - ${formatMoney(result.estimate.highCents, result.estimate.currency)}`;
  }, [result]);

  async function submitEstimate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) {
      setError("Add your name, job address, and either email or phone.");
      return;
    }

    setSubmitState("submitting");
    setError(null);

    try {
      const response = await api<EstimateResponse>("/public/estimates", {
        method: "POST",
        body: JSON.stringify({
          orgId,
          source: embed ? "website_widget" : "website_page",
          customer: {
            name: customerName,
            email: emptyToNull(email),
            phone: emptyToNull(phone)
          },
          address,
          city: city.trim() || undefined,
          checklist,
          notes,
          referrer: document.referrer || null,
          company
        })
      });
      setResult(response);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "We could not create the estimate. Try again.");
    } finally {
      setSubmitState("idle");
    }
  }

  if (orgState.kind === "error") {
    return (
      <main className={embed ? "estimate-page is-embed" : "estimate-page"}>
        <section className="estimate-unavailable">
          <p className="eyebrow">Estimate unavailable</p>
          <h1>Could not open this form.</h1>
          <p>{orgState.message}</p>
        </section>
      </main>
    );
  }

  return (
    <main className={embed ? "estimate-page is-embed" : "estimate-page"}>
      <section className="estimate-shell" aria-label="Instant painting estimate">
        <header className="estimate-page-header">
          <BrandMark org={org} />
          <div>
            <p className="eyebrow">Instant painting estimate</p>
            <h1>{org?.name ?? "QuoteVan estimate"}</h1>
            <p>{org ? estimateContactLine(org) : "Loading contractor details..."}</p>
          </div>
        </header>

        <div className="estimate-layout">
          <form className="estimate-form" onSubmit={submitEstimate}>
            <label className="estimate-hidden-field" aria-hidden="true">
              Company
              <input autoComplete="off" tabIndex={-1} value={company} onChange={(event) => setCompany(event.target.value)} />
            </label>

            <section className="estimate-form-section">
              <div className="estimate-section-head">
                <p className="section-label">Your details</p>
              </div>
              <div className="estimate-field-grid two">
                <TextField label="Name" value={customerName} onChange={setCustomerName} autoComplete="name" required />
                <TextField label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
              </div>
              <div className="estimate-field-grid two">
                <TextField label="Phone" type="tel" value={phone} onChange={setPhone} autoComplete="tel" />
                <TextField label="City" value={city} onChange={setCity} autoComplete="address-level2" />
              </div>
              <TextField label="Job address" value={address} onChange={setAddress} autoComplete="street-address" required />
            </section>

            <section className="estimate-form-section">
              <div className="estimate-section-head">
                <p className="section-label">Rooms</p>
              </div>
              <div className="estimate-stepper-grid">
                <Stepper label="Small" value={checklist.rooms.small} onChange={(value) => updateRoom("small", value)} />
                <Stepper label="Medium" value={checklist.rooms.medium} onChange={(value) => updateRoom("medium", value)} />
                <Stepper label="Large" value={checklist.rooms.large} onChange={(value) => updateRoom("large", value)} />
              </div>
            </section>

            <section className="estimate-form-section">
              <div className="estimate-section-head">
                <p className="section-label">Work</p>
              </div>
              <div className="estimate-toggle-grid" aria-label="Surfaces to paint">
                <Toggle label="Walls" checked={checklist.surfaces.walls} onChange={(checked) => updateSurface("walls", checked)} />
                <Toggle label="Ceilings" checked={checklist.surfaces.ceilings} onChange={(checked) => updateSurface("ceilings", checked)} />
                <Toggle label="Trim" checked={checklist.surfaces.trim} onChange={(checked) => updateSurface("trim", checked)} />
              </div>
              <div className="estimate-field-grid three">
                <SelectField label="Prep" value={checklist.prepLevel} onChange={(value) => setChecklist((current) => ({ ...current, prepLevel: value as PainterChecklist["prepLevel"] }))}>
                  <option value="light">Light</option>
                  <option value="normal">Normal</option>
                  <option value="heavy">Heavy</option>
                </SelectField>
                <SelectField label="Coats" value={String(checklist.coatCount)} onChange={(value) => setChecklist((current) => ({ ...current, coatCount: Number(value) as 1 | 2 }))}>
                  <option value="1">1 coat</option>
                  <option value="2">2 coats</option>
                </SelectField>
                <Stepper label="Doors" value={checklist.doorCount} onChange={(value) => setChecklist((current) => ({ ...current, doorCount: value }))} />
              </div>
              <Toggle
                label="I will supply the paint"
                checked={checklist.customerSuppliesPaint}
                onChange={(checked) => setChecklist((current) => ({ ...current, customerSuppliesPaint: checked }))}
              />
            </section>

            <section className="estimate-form-section">
              <label className="estimate-input-label">
                <span>Anything else?</span>
                <textarea
                  rows={4}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Example: Patch nail holes, sand rough areas, prime where needed."
                />
              </label>
            </section>

            {error ? <p className="estimate-error" role="alert">{error}</p> : null}

            <button className="estimate-submit" type="submit" disabled={!canSubmit}>
              {submitState === "submitting" ? "Creating estimate..." : "Get estimate range"}
            </button>
          </form>

          <aside className="estimate-result-panel" aria-live="polite">
            {result ? (
              <>
                <p className="section-label">Estimated range</p>
                <strong className="estimate-range">{rangeText}</strong>
                <p className="estimate-result-copy">{result.estimate.disclaimer}</p>
                <div className="estimate-result-status">
                  <span>Draft saved in QuoteVan</span>
                  <b>{result.lineItems.length} lines</b>
                </div>
                <div className="estimate-result-lines">
                  {result.lineItems.slice(0, 6).map((line) => (
                    <div className="estimate-result-line" key={`${line.position}-${line.description}`}>
                      <span>
                        <strong>{line.description}</strong>
                        <small>{line.quantity} {line.unit ?? "item"}</small>
                      </span>
                      <b>{line.unitPriceCents === null ? "Review" : formatMoney(Math.round(line.quantity * line.unitPriceCents), currency)}</b>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p className="section-label">Price-book estimate</p>
                <strong className="estimate-range">Instant range</strong>
                <p className="estimate-result-copy">
                  Submit the job details to see a preliminary range from the contractor's QuoteVan price book.
                </p>
                <div className="estimate-result-placeholder">
                  <span />
                  <span />
                  <span />
                </div>
              </>
            )}
          </aside>
        </div>
      </section>
    </main>
  );

  function updateRoom(size: keyof PainterChecklist["rooms"], value: number) {
    setChecklist((current) => ({
      ...current,
      rooms: { ...current.rooms, [size]: value }
    }));
  }

  function updateSurface(surface: keyof PainterChecklist["surfaces"], checked: boolean) {
    setChecklist((current) => ({
      ...current,
      surfaces: { ...current.surfaces, [surface]: checked }
    }));
  }
}

function TextField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className="estimate-input-label">
      <span>{props.label}</span>
      <input
        autoComplete={props.autoComplete}
        required={props.required}
        type={props.type ?? "text"}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </label>
  );
}

function SelectField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="estimate-input-label">
      <span>{props.label}</span>
      <select value={props.value} onChange={(event) => props.onChange(event.target.value)}>
        {props.children}
      </select>
    </label>
  );
}

function Stepper(props: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className="estimate-stepper">
      <span>{props.label}</span>
      <div>
        <button type="button" aria-label={`Decrease ${props.label}`} onClick={() => props.onChange(clampCount(props.value - 1))}>-</button>
        <strong>{props.value}</strong>
        <button type="button" aria-label={`Increase ${props.label}`} onClick={() => props.onChange(clampCount(props.value + 1))}>+</button>
      </div>
    </div>
  );
}

function Toggle(props: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className={props.checked ? "estimate-toggle is-checked" : "estimate-toggle"}>
      <input type="checkbox" checked={props.checked} onChange={(event) => props.onChange(event.target.checked)} />
      <span aria-hidden="true" />
      <strong>{props.label}</strong>
    </label>
  );
}

function BrandMark(props: { org: EstimateOrg | null }) {
  if (props.org?.logoUrl) {
    return <img alt="" className="estimate-brand-mark image" src={props.org.logoUrl} />;
  }

  const initial = props.org?.name?.trim().charAt(0).toUpperCase() || "Q";
  return <span className="estimate-brand-mark">{initial}</span>;
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init.headers
    }
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(body?.message ?? "Request failed. Try again.");
  }

  return await response.json() as T;
}

function estimateContactLine(org: EstimateOrg) {
  return [org.contactPhone, org.website].filter(Boolean).join(" - ") || "Powered by QuoteVan";
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function clampCount(value: number) {
  return Math.max(0, Math.min(20, value));
}

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(cents / 100);
}
