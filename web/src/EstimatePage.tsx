import { type ChangeEvent, type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";

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

type RequestResponse = {
  requestId: string;
  org: EstimateOrg;
  status: "received";
  message: string;
};

type Timing = "asap" | "this_month" | "flexible" | "just_pricing";

type RequestPhoto = {
  fileName: string;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  base64: string;
  previewUrl: string;
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
  const [timing, setTiming] = useState<Timing>("flexible");
  const [photos, setPhotos] = useState<RequestPhoto[]>([]);
  const [company, setCompany] = useState("");
  const [checklist, setChecklist] = useState<PainterChecklist>(fallbackChecklist);
  const [submitState, setSubmitState] = useState<"idle" | "submitting">("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RequestResponse | null>(() => readSubmissionReceipt(orgId));
  const confirmationHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    setResult(readSubmissionReceipt(orgId));
  }, [orgId]);

  useEffect(() => {
    if (result) {
      confirmationHeadingRef.current?.focus();
    }
  }, [result]);

  useEffect(() => {
    let canceled = false;

    async function loadOrg() {
      try {
        const response = await api<EstimateOrgResponse>(`/public/request-orgs/${encodeURIComponent(orgId)}`);

        if (!canceled) {
          setOrgState({ kind: "ready", org: response.org, defaults: response.defaults });
          setChecklist(response.defaults.checklist);
        }
      } catch {
        if (!canceled) {
          setOrgState({ kind: "error", message: "This request form is not available. Ask the contractor for a direct link." });
        }
      }
    }

    void loadOrg();
    return () => {
      canceled = true;
    };
  }, [orgId]);

  const org = orgState.kind === "ready" ? orgState.org : null;
  const hasContact = email.trim().length > 0 || phone.trim().length > 0;
  const canSubmit = customerName.trim().length > 0 && address.trim().length > 0 && hasContact && submitState === "idle";

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (result) return;

    if (!canSubmit) {
      setError("Add your name, job address, and either email or phone.");
      return;
    }

    setSubmitState("submitting");
    setError(null);

    try {
      const response = await api<RequestResponse>("/public/requests", {
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
          timing,
          photos: photos.map(({ fileName, contentType, base64 }) => ({ fileName, contentType, base64 })),
          referrer: document.referrer || null,
          company
        })
      });
      writeSubmissionReceipt(orgId, response);
      setResult(response);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "We could not send the request. Try again.");
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
      <section className="estimate-shell" aria-label="Painting quote request">
        <header className="estimate-page-header">
          <BrandMark org={org} />
          <div>
            <p className="eyebrow">Request a quote</p>
            <h1>{org?.name ?? "QuoteVan request"}</h1>
            <p>{org ? estimateContactLine(org) : "Loading contractor details..."}</p>
          </div>
        </header>

        {result ? (
          <section className="estimate-confirmation" aria-live="polite">
            <span className="estimate-confirmation-mark" aria-hidden="true">&#10003;</span>
            <p className="section-label">Request received</p>
            <h2 ref={confirmationHeadingRef} tabIndex={-1}>Thanks. Your request is in.</h2>
            <p className="estimate-confirmation-copy">
              It has been sent to <strong>{org?.name ?? result.org.name}</strong>. They will review your details and contact you before sending the quote.
            </p>
            <div className="estimate-confirmation-reference">
              <span>Reference</span>
              <strong>{result.requestId.slice(0, 8).toUpperCase()}</strong>
            </div>
            <p className="estimate-confirmation-close">You can close this page.</p>
          </section>
        ) : (
          <div className="estimate-layout">
            <form className="estimate-form" onSubmit={submitRequest}>
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
              <div className="estimate-section-head">
                <p className="section-label">Photos and timing</p>
                <span>{photos.length}/4 photos</span>
              </div>
              <PhotoPicker photos={photos} onChange={setPhotos} onError={setError} />
              <SelectField label="When do you need the work?" value={timing} onChange={(value) => setTiming(value as Timing)}>
                <option value="asap">As soon as possible</option>
                <option value="this_month">This month</option>
                <option value="flexible">My timing is flexible</option>
                <option value="just_pricing">I am comparing quotes</option>
              </SelectField>
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
              {submitState === "submitting" ? "Sending request..." : "Send quote request"}
            </button>
            </form>

            <aside className="estimate-result-panel">
              <p className="section-label">What happens next</p>
              <strong className="estimate-range">A real quote, reviewed first.</strong>
              <p className="estimate-result-copy">
                Your request opens as a draft in the contractor's app. They review the work and contact you or email the finished quote.
              </p>
              <div className="estimate-next-steps">
                <span><b>1</b> Send details and photos</span>
                <span><b>2</b> Contractor reviews the draft</span>
                <span><b>3</b> Receive the quote by email</span>
              </div>
            </aside>
          </div>
        )}
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

function PhotoPicker(props: {
  photos: RequestPhoto[];
  onChange: (photos: RequestPhoto[]) => void;
  onError: (message: string | null) => void;
}) {
  async function addPhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (files.length === 0) return;

    if (props.photos.length + files.length > 4) {
      props.onError("Add up to 4 photos.");
      return;
    }

    try {
      const next = await Promise.all(files.map(photoFromFile));
      props.onError(null);
      props.onChange([...props.photos, ...next]);
    } catch (photoError) {
      props.onError(photoError instanceof Error ? photoError.message : "One of the photos could not be added.");
    }
  }

  return (
    <div className="estimate-photo-picker">
      <div className="estimate-photo-grid">
        {props.photos.map((photo, index) => (
          <figure className="estimate-photo-preview" key={`${photo.fileName}-${index}`}>
            <img alt={`Job photo ${index + 1}`} src={photo.previewUrl} />
            <button type="button" aria-label={`Remove ${photo.fileName}`} onClick={() => props.onChange(props.photos.filter((_, photoIndex) => photoIndex !== index))}>
              &times;
            </button>
          </figure>
        ))}
        {props.photos.length < 4 ? (
          <label className="estimate-photo-add">
            <input accept="image/jpeg,image/png,image/webp" multiple onChange={addPhotos} type="file" />
            <strong>+</strong>
            <span>Add photos</span>
          </label>
        ) : null}
      </div>
      <p>Wide room photos help the contractor prepare a more accurate quote.</p>
    </div>
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

function submissionStorageKey(orgId: string) {
  return `quotevan-request-received:${orgId}`;
}

function readSubmissionReceipt(orgId: string): RequestResponse | null {
  try {
    const stored = window.sessionStorage.getItem(submissionStorageKey(orgId));
    if (!stored) return null;

    const receipt = JSON.parse(stored) as Partial<RequestResponse>;
    return typeof receipt.requestId === "string" && receipt.status === "received" && receipt.org?.name
      ? receipt as RequestResponse
      : null;
  } catch {
    return null;
  }
}

function writeSubmissionReceipt(orgId: string, response: RequestResponse) {
  try {
    window.sessionStorage.setItem(submissionStorageKey(orgId), JSON.stringify(response));
  } catch {
    // The in-memory result still prevents another submission in this page view.
  }
}

async function photoFromFile(file: File): Promise<RequestPhoto> {
  if (!(["image/jpeg", "image/png", "image/webp"] as string[]).includes(file.type)) {
    throw new Error("Use JPG, PNG, or WebP photos.");
  }

  if (file.size > 16_000_000) {
    throw new Error("Each original photo must be smaller than 16 MB.");
  }

  const compressed = await compressPhoto(file);
  const previewUrl = await readFile(compressed);
  const base64 = previewUrl.split(",", 2)[1];

  if (!base64) {
    throw new Error("One of the photos could not be read.");
  }

  return {
    fileName: `${file.name.replace(/\.[^.]+$/, "") || "job-photo"}.jpg`,
    contentType: "image/jpeg",
    base64,
    previewUrl
  };
}

async function compressPhoto(file: File) {
  const image = await loadImage(file);
  const maxEdge = 1600;
  const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  if (!context) throw new Error("This browser could not prepare the photo.");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Photo could not be compressed.")), "image/jpeg", 0.82);
  });
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("One of the photos could not be opened."));
    };
    image.src = objectUrl;
  });
}

function readFile(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Photo could not be read."));
    reader.onerror = () => reject(new Error("Photo could not be read."));
    reader.readAsDataURL(file);
  });
}
