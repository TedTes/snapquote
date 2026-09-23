import { DayPicker, type DateRange } from "@daypicker/react";
import "@daypicker/react/style.css";
import { type ChangeEvent, type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";

const apiBaseUrl = (import.meta.env.VITE_SNAPQUOTE_API_URL ?? "https://dctmpfrbkgntiuhjbblu.functions.supabase.co/snapquote").replace(/\/$/, "");

type PaintSupply = "customer" | "contractor";
type PaintChoice = PaintSupply | "unsure";

/** What a homeowner can reliably say about the job. Room size, prep, coats, and price are the contractor's call. */
type HomeownerJobInput = {
  roomCount: number;
  surfaces: { walls: boolean; ceilings: boolean; trim: boolean };
  doorCount: number;
  paintSupply: PaintSupply | null;
};

type EstimateOrg = {
  id: string;
  name: string;
  trade: string;
  logoUrl: string | null;
  contactPhone: string | null;
  website: string | null;
  currency: string;
  /** Optional profile details. They render only when the API provides them. */
  serviceArea?: string | null;
  about?: string | null;
};

type EstimateOrgResponse = {
  org: EstimateOrg;
};

type RequestResponse = {
  requestId: string;
  org: EstimateOrg;
  status: "received";
  message: string;
};

type RequestPhoto = {
  fileName: string;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  base64: string;
  previewUrl: string;
};

type RequestVideo = {
  file: File;
  fileName: string;
  contentType: "video/mp4" | "video/quicktime" | "video/webm";
  durationSeconds: number;
  previewUrl: string;
};

type RequestUploadResponse = {
  uploadId: string;
  bucket: string;
  storagePath: string;
  signedUrl: string;
  expiresInSeconds: number;
};

type OrgState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; org: EstimateOrg };

type FieldKey = "scope" | "name" | "contact" | "email" | "phone" | "address";
type FieldErrors = Partial<Record<FieldKey, string>>;
type StepState = "done" | "current" | "upcoming";

/** Element that receives focus when a field is invalid. Order matches the page. */
const fieldOrder: FieldKey[] = ["scope", "name", "contact", "email", "phone", "address"];
const fieldIds: Record<FieldKey, string> = {
  scope: "estimate-rooms",
  name: "estimate-name",
  contact: "estimate-email",
  email: "estimate-email",
  phone: "estimate-phone",
  address: "estimate-address"
};

const maxRooms = 20;
const maxDoors = 50;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EstimatePage(props: { orgId: string; embed?: boolean }) {
  const { orgId, embed = false } = props;
  const [orgState, setOrgState] = useState<OrgState>({ kind: "loading" });
  const [roomCount, setRoomCount] = useState(0);
  const [surfaces, setSurfaces] = useState<HomeownerJobInput["surfaces"]>({ walls: false, ceilings: false, trim: false });
  const [doorCount, setDoorCount] = useState(0);
  const [paintChoice, setPaintChoice] = useState<PaintChoice | null>(null);
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<RequestPhoto[]>([]);
  const [video, setVideo] = useState<RequestVideo | null>(null);
  const [preferredStartDate, setPreferredStartDate] = useState("");
  const [preferredEndDate, setPreferredEndDate] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [company, setCompany] = useState("");
  const [submitState, setSubmitState] = useState<"idle" | "submitting">("idle");
  const [showErrors, setShowErrors] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
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
          setOrgState({ kind: "ready", org: response.org });
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
  const errors = validateRequest({ roomCount, doorCount, notes, name: customerName, email, phone, address });
  const visibleErrors: FieldErrors = showErrors ? errors : {};
  const summaryKeys = fieldOrder.filter((key) => visibleErrors[key]);
  const jobReady = !errors.scope;
  const contactReady = !errors.name && !errors.contact && !errors.email && !errors.phone && !errors.address;
  const steps: Array<{ label: string; state: StepState }> = [
    { label: "Describe the job", state: jobReady ? "done" : "current" },
    { label: "Add contact details", state: contactReady ? "done" : jobReady ? "current" : "upcoming" },
    { label: "Request received", state: jobReady && contactReady ? "current" : "upcoming" }
  ];
  const scopeDescribedBy = visibleErrors.scope ? "estimate-scope-error" : undefined;
  const contactDescribedBy = visibleErrors.contact ? "estimate-contact-error" : undefined;

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (result || submitState === "submitting") return;

    const firstInvalid = fieldOrder.find((key) => errors[key]);

    if (firstInvalid) {
      setSubmitError(null);
      setShowErrors(true);
      // Wait for the inline errors to render so the scroll position accounts for them.
      window.requestAnimationFrame(() => focusField(firstInvalid));
      return;
    }

    setSubmitState("submitting");
    setSubmitError(null);

    try {
      const uploadedVideo = video ? await uploadRequestVideo(orgId, video, company) : null;
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
          job: {
            roomCount,
            surfaces,
            doorCount,
            paintSupply: paintChoice === "customer" || paintChoice === "contractor" ? paintChoice : null
          } satisfies HomeownerJobInput,
          notes,
          preferredStartDate: preferredStartDate || null,
          preferredEndDate: preferredEndDate || null,
          photos: photos.map(({ fileName, contentType, base64 }) => ({ fileName, contentType, base64 })),
          videos: uploadedVideo ? [{
            fileName: video!.fileName,
            contentType: video!.contentType,
            byteSize: video!.file.size,
            durationSeconds: video!.durationSeconds,
            storagePath: uploadedVideo.storagePath
          }] : [],
          referrer: document.referrer || null,
          company
        })
      });
      writeSubmissionReceipt(orgId, response);
      setResult(response);
    } catch (requestError) {
      setSubmitError(requestError instanceof Error ? requestError.message : "We could not send the request. Try again.");
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
      <section className="estimate-shell" aria-label="Quote request">
        <ProviderHeader org={org} />

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
            <form className="estimate-form" noValidate onSubmit={submitRequest}>
              <label className="estimate-hidden-field" aria-hidden="true">
                Company
                <input autoComplete="off" tabIndex={-1} value={company} onChange={(event) => setCompany(event.target.value)} />
              </label>

              <section className="estimate-form-section" aria-labelledby="estimate-scope-title">
                <div className="estimate-section-head">
                  <h2 id="estimate-scope-title">Tell us about the job</h2>
                </div>
                <p className="estimate-section-hint">A rough idea is enough. The contractor confirms the details and the price.</p>

                <div className="estimate-field-grid two counts">
                  <CountField
                    describedBy={scopeDescribedBy}
                    id={fieldIds.scope}
                    invalid={Boolean(visibleErrors.scope)}
                    label="Rooms to paint"
                    max={maxRooms}
                    value={roomCount}
                    onChange={setRoomCount}
                  />
                  <CountField
                    describedBy={scopeDescribedBy}
                    id="estimate-doors"
                    invalid={Boolean(visibleErrors.scope)}
                    label="Doors to paint"
                    max={maxDoors}
                    value={doorCount}
                    onChange={setDoorCount}
                  />
                </div>

                <fieldset className="estimate-fieldset">
                  <legend>What needs painting?<small>Optional</small></legend>
                  <div className="estimate-choice-grid surfaces">
                    <Choice type="checkbox" label="Walls" checked={surfaces.walls} onChange={(checked) => setSurfaces((current) => ({ ...current, walls: checked }))} />
                    <Choice type="checkbox" label="Ceilings" checked={surfaces.ceilings} onChange={(checked) => setSurfaces((current) => ({ ...current, ceilings: checked }))} />
                    <Choice type="checkbox" label="Trim" checked={surfaces.trim} onChange={(checked) => setSurfaces((current) => ({ ...current, trim: checked }))} />
                  </div>
                </fieldset>

                <fieldset className="estimate-fieldset">
                  <legend>Who is providing the paint?<small>Optional</small></legend>
                  <div className="estimate-choice-grid paint">
                    <Choice type="radio" name="estimate-paint" label="I have the paint" checked={paintChoice === "customer"} onChange={() => setPaintChoice("customer")} />
                    <Choice type="radio" name="estimate-paint" label="Contractor supplies" checked={paintChoice === "contractor"} onChange={() => setPaintChoice("contractor")} />
                    <Choice type="radio" name="estimate-paint" label="Not sure yet" checked={paintChoice === "unsure"} onChange={() => setPaintChoice("unsure")} />
                  </div>
                </fieldset>

                <div className={visibleErrors.scope ? "estimate-field has-error" : "estimate-field"}>
                  <label htmlFor="estimate-notes">Describe the job or areas<small>Optional</small></label>
                  <textarea
                    aria-describedby={scopeDescribedBy}
                    aria-invalid={visibleErrors.scope ? true : undefined}
                    id="estimate-notes"
                    rows={4}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Which rooms or areas, colours, repairs, or anything the painter should know."
                  />
                  {visibleErrors.scope ? <FieldError id="estimate-scope-error">{visibleErrors.scope}</FieldError> : null}
                </div>
              </section>

              <section className="estimate-form-section" aria-labelledby="estimate-photos-title">
                <div className="estimate-section-head">
                  <h2 id="estimate-photos-title">Add photos</h2>
                  <span>Optional &middot; {photos.length}/4</span>
                </div>
                <PhotoPicker photos={photos} onChange={setPhotos} onError={setMediaError} />
                <VideoPicker video={video} onChange={setVideo} onError={setMediaError} />
                {mediaError ? <FieldError id="estimate-media-error">{mediaError}</FieldError> : null}
              </section>

              <PreferredTimelinePicker
                endDate={preferredEndDate}
                startDate={preferredStartDate}
                onChange={(startDate, endDate) => {
                  setPreferredStartDate(startDate);
                  setPreferredEndDate(endDate);
                }}
              />

              <section className="estimate-form-section" aria-labelledby="estimate-contact-title">
                <div className="estimate-section-head">
                  <h2 id="estimate-contact-title">Contact and job address</h2>
                </div>
                <p className="estimate-section-hint">Add an email or phone number so the contractor can reach you.</p>

                <TextField
                  autoComplete="name"
                  error={visibleErrors.name}
                  id={fieldIds.name}
                  label="Name"
                  required
                  value={customerName}
                  onChange={setCustomerName}
                />
                <div className="estimate-field-grid two">
                  <TextField
                    autoComplete="email"
                    describedBy={contactDescribedBy}
                    error={visibleErrors.email}
                    id={fieldIds.email}
                    invalid={Boolean(visibleErrors.contact)}
                    inputMode="email"
                    label="Email"
                    type="email"
                    value={email}
                    onChange={setEmail}
                  />
                  <TextField
                    autoComplete="tel"
                    describedBy={contactDescribedBy}
                    error={visibleErrors.phone}
                    id={fieldIds.phone}
                    invalid={Boolean(visibleErrors.contact)}
                    inputMode="tel"
                    label="Phone"
                    type="tel"
                    value={phone}
                    onChange={setPhone}
                  />
                </div>
                {visibleErrors.contact ? <FieldError id="estimate-contact-error">{visibleErrors.contact}</FieldError> : null}
                <div className="estimate-field-grid address">
                  <TextField
                    autoComplete="street-address"
                    error={visibleErrors.address}
                    id={fieldIds.address}
                    label="Job address"
                    required
                    value={address}
                    onChange={setAddress}
                  />
                  <TextField autoComplete="address-level2" id="estimate-city" label="City" optional value={city} onChange={setCity} />
                </div>
              </section>

              <div className="estimate-submit-area">
                {summaryKeys.length > 0 ? (
                  <div className="estimate-summary" role="alert">
                    <strong>{summaryKeys.length === 1 ? "One thing needs fixing" : `${summaryKeys.length} things need fixing`}</strong>
                    <ul>
                      {summaryKeys.map((key) => (
                        <li key={key}>
                          <button type="button" onClick={() => focusField(key)}>{visibleErrors[key]}</button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {submitError ? <p className="estimate-error" role="alert">{submitError}</p> : null}
                <button className="estimate-submit" type="submit" disabled={submitState === "submitting"}>
                  {submitState === "submitting" ? "Sending request..." : "Send quote request"}
                </button>
              </div>
            </form>

            <aside className="estimate-next" aria-labelledby="estimate-next-title">
              <h2 id="estimate-next-title">What happens next</h2>
              <p>
                No price is shown here. {org?.name ?? "The contractor"} reviews your request first, then sends you a quote.
              </p>
              <ol className="estimate-steps">
                {steps.map((step, index) => (
                  <li className={`is-${step.state}`} key={step.label} aria-current={step.state === "current" ? "step" : undefined}>
                    <span className="estimate-step-mark" aria-hidden="true">{step.state === "done" ? "✓" : index + 1}</span>
                    <span>
                      {step.label}
                      {step.state === "done" ? <span className="estimate-sr-only"> (done)</span> : null}
                    </span>
                  </li>
                ))}
              </ol>
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}

function validateRequest(values: {
  roomCount: number;
  doorCount: number;
  notes: string;
  name: string;
  email: string;
  phone: string;
  address: string;
}): FieldErrors {
  const errors: FieldErrors = {};
  const email = values.email.trim();
  const phone = values.phone.trim();

  if (values.roomCount === 0 && values.doorCount === 0 && values.notes.trim().length === 0) {
    errors.scope = "Add the number of rooms or doors, or describe the job.";
  }

  if (values.name.trim().length === 0) {
    errors.name = "Enter your name.";
  }

  if (!email && !phone) {
    errors.contact = "Add an email address or phone number.";
  }

  if (email && !emailPattern.test(email)) {
    errors.email = "Enter a valid email address, like name@example.com.";
  }

  if (phone && phone.replace(/\D/g, "").length < 7) {
    errors.phone = "Enter a phone number with at least 7 digits.";
  }

  if (values.address.trim().length === 0) {
    errors.address = "Enter the job address.";
  }

  return errors;
}

function focusField(key: FieldKey) {
  const element = document.getElementById(fieldIds[key]);
  if (!element) return;

  element.focus({ preventScroll: true });
  element.scrollIntoView({
    block: "center",
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
  });
}

function FieldError(props: { id: string; children: ReactNode }) {
  return <p className="estimate-field-error" id={props.id}>{props.children}</p>;
}

function TextField(props: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  inputMode?: "email" | "tel";
  required?: boolean;
  optional?: boolean;
  error?: string | undefined;
  /** Marks the input invalid when the message is shown elsewhere, such as under a pair of fields. */
  invalid?: boolean;
  describedBy?: string | undefined;
}) {
  const errorId = `${props.id}-error`;
  const invalid = Boolean(props.error) || props.invalid === true;
  const describedBy = [props.error ? errorId : null, props.describedBy].filter(Boolean).join(" ") || undefined;

  return (
    <div className={invalid ? "estimate-field has-error" : "estimate-field"}>
      <label htmlFor={props.id}>
        {props.label}
        {props.optional ? <small>Optional</small> : null}
      </label>
      <input
        aria-describedby={describedBy}
        aria-invalid={invalid ? true : undefined}
        aria-required={props.required ? true : undefined}
        autoComplete={props.autoComplete}
        id={props.id}
        inputMode={props.inputMode}
        type={props.type ?? "text"}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      />
      {props.error ? <FieldError id={errorId}>{props.error}</FieldError> : null}
    </div>
  );
}

function CountField(props: {
  id: string;
  label: string;
  value: number;
  max: number;
  onChange: (value: number) => void;
  invalid?: boolean;
  describedBy?: string | undefined;
}) {
  const noun = props.label.toLowerCase();

  return (
    <div className={props.invalid ? "estimate-field has-error" : "estimate-field"}>
      <label htmlFor={props.id}>{props.label}</label>
      <div className="estimate-count-control">
        <button type="button" aria-label={`Fewer ${noun}`} disabled={props.value <= 0} onClick={() => props.onChange(clampCount(props.value - 1, props.max))}>&minus;</button>
        <input
          aria-describedby={props.describedBy}
          aria-invalid={props.invalid ? true : undefined}
          autoComplete="off"
          id={props.id}
          inputMode="numeric"
          value={String(props.value)}
          onChange={(event) => props.onChange(clampCount(Number(event.target.value.replace(/\D/g, "").slice(0, 3)), props.max))}
          onFocus={(event) => event.target.select()}
        />
        <button type="button" aria-label={`More ${noun}`} disabled={props.value >= props.max} onClick={() => props.onChange(clampCount(props.value + 1, props.max))}>+</button>
      </div>
    </div>
  );
}

function Choice(props: {
  type: "checkbox" | "radio";
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  name?: string;
}) {
  return (
    <label className={`estimate-choice is-${props.type}${props.checked ? " is-checked" : ""}`}>
      <input checked={props.checked} name={props.name} type={props.type} onChange={(event) => props.onChange(event.target.checked)} />
      <span className="estimate-choice-mark" aria-hidden="true" />
      <strong>{props.label}</strong>
    </label>
  );
}

function PreferredTimelinePicker(props: {
  startDate: string;
  endDate: string;
  onChange: (startDate: string, endDate: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = props.startDate
    ? { from: dateFromInputValue(props.startDate), to: props.endDate ? dateFromInputValue(props.endDate) : undefined }
    : undefined;
  const today = dateFromInputValue(todayDateInputValue());

  function selectRange(range: DateRange | undefined) {
    props.onChange(
      range?.from ? dateToInputValue(range.from) : "",
      range?.to ? dateToInputValue(range.to) : ""
    );
  }

  return (
    <section className={open ? "estimate-form-section estimate-timeline is-open" : "estimate-form-section estimate-timeline"} aria-labelledby="estimate-timeline-title">
      <div className="estimate-section-head">
        <h2 id="estimate-timeline-title">Preferred timeline</h2>
        <span>
          Optional
          {props.startDate ? <button type="button" onClick={() => props.onChange("", "")}>Clear dates</button> : null}
        </span>
      </div>

      <button
        aria-controls="preferred-timeline-calendar"
        aria-expanded={open}
        className="estimate-date-trigger"
        type="button"
        onClick={() => setOpen((current) => !current)}
      >
        <span>
          <small>Preferred dates</small>
          <strong>{preferredTimelineText(props.startDate, props.endDate)}</strong>
        </span>
        <b>{open ? "Close" : props.startDate ? "Change" : "Choose"}</b>
      </button>

      {open ? (
        <div className="estimate-calendar-panel" id="preferred-timeline-calendar">
          <p>{selected?.from && !selected.to ? "Now choose an end date, or select Done for one day." : "Select a start date, then an optional end date."}</p>
          <DayPicker
            defaultMonth={selected?.from ?? today}
            disabled={{ before: today }}
            fixedWeeks
            mode="range"
            onSelect={selectRange}
            resetOnSelect
            selected={selected}
            showOutsideDays
          />
          <div className="estimate-calendar-actions">
            <button disabled={!props.startDate} type="button" onClick={() => props.onChange("", "")}>Clear</button>
            <button type="button" onClick={() => setOpen(false)}>Done</button>
          </div>
        </div>
      ) : null}

      <p className="estimate-timeline-note">
        These are preferred dates, not a confirmed appointment.
      </p>
    </section>
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
      <div className={props.photos.length === 0 ? "estimate-photo-grid is-empty" : "estimate-photo-grid"}>
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
            <strong aria-hidden="true">+</strong>
            <span>Add photos</span>
            {props.photos.length === 0 ? <small>Up to 4 &middot; JPG, PNG, or WebP</small> : null}
          </label>
        ) : null}
      </div>
      <p>Clear, well-lit photos of each room or surface work best, plus close-ups of any damage. Avoid selfies or unrelated images.</p>
    </div>
  );
}

function VideoPicker(props: {
  video: RequestVideo | null;
  onChange: (video: RequestVideo | null) => void;
  onError: (message: string | null) => void;
}) {
  async function addVideo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const next = await videoFromFile(file);
      if (props.video) URL.revokeObjectURL(props.video.previewUrl);
      props.onError(null);
      props.onChange(next);
    } catch (videoError) {
      props.onError(videoError instanceof Error ? videoError.message : "The video could not be added.");
    }
  }

  function removeVideo() {
    if (props.video) URL.revokeObjectURL(props.video.previewUrl);
    props.onChange(null);
  }

  return (
    <div className="estimate-video-picker">
      {props.video ? (
        <figure className="estimate-video-preview">
          <video controls preload="metadata" src={props.video.previewUrl} />
          <div>
            <strong>{props.video.fileName}</strong>
            <span>{Math.round(props.video.durationSeconds)} sec · {formatFileSize(props.video.file.size)}</span>
          </div>
          <button type="button" aria-label={`Remove ${props.video.fileName}`} onClick={removeVideo}>&times;</button>
        </figure>
      ) : (
        <label className="estimate-video-add">
          <input accept="video/mp4,video/quicktime,video/webm" onChange={addVideo} type="file" />
          <span aria-hidden="true">+</span>
          <div><strong>Or add a short video</strong><small>Walk through the rooms. Up to 90 seconds and 60 MB.</small></div>
        </label>
      )}
    </div>
  );
}

function ProviderHeader(props: { org: EstimateOrg | null }) {
  const { org } = props;
  const phone = org?.contactPhone?.trim() || null;
  const website = org?.website?.trim() || null;
  const websiteLink = website ? websiteHref(website) : null;
  const facts = [
    phone ? <a key="phone" href={`tel:${phone.replace(/[^\d+]/g, "")}`}>{phone}</a> : null,
    website
      ? websiteLink
        ? <a key="website" href={websiteLink} rel="noopener noreferrer" target="_blank">{websiteLabel(website)}</a>
        : <span key="website">{website}</span>
      : null,
    org?.serviceArea ? <span key="area">Serves {org.serviceArea}</span> : null
  ].filter(Boolean);

  return (
    <header className="estimate-profile">
      <div className="estimate-profile-top">
        <BrandMark org={org} />
        <div className="estimate-profile-name">
          <h1>{org?.name ?? "Request a quote"}</h1>
          <p>{org ? `${sentenceCase(org.trade)} quote request` : "Loading contractor details..."}</p>
        </div>
      </div>
      {org?.about ? <p className="estimate-profile-about">{org.about}</p> : null}
      <div className="estimate-profile-meta">
        {facts.length > 0 ? <ul className="estimate-profile-facts">{facts.map((fact, index) => <li key={index}>{fact}</li>)}</ul> : null}
        <span className="estimate-powered">Powered by QuoteVan</span>
      </div>
    </header>
  );
}

function BrandMark(props: { org: EstimateOrg | null }) {
  if (props.org?.logoUrl) {
    return <img alt="" className="estimate-brand-mark image" src={props.org.logoUrl} />;
  }

  const initial = props.org?.name?.trim().charAt(0).toUpperCase() || "Q";
  return <span aria-hidden="true" className="estimate-brand-mark">{initial}</span>;
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

async function uploadRequestVideo(orgId: string, video: RequestVideo, company: string) {
  const upload = await api<RequestUploadResponse>("/public/request-uploads", {
    method: "POST",
    body: JSON.stringify({
      orgId,
      fileName: video.fileName,
      contentType: video.contentType,
      byteSize: video.file.size,
      durationSeconds: video.durationSeconds,
      company
    })
  });
  const form = new FormData();
  form.append("cacheControl", "3600");
  form.append("", video.file);
  const response = await fetch(upload.signedUrl, {
    method: "PUT",
    headers: { "x-upsert": "false" },
    body: form
  });

  if (!response.ok) {
    throw new Error("The video upload did not finish. Check your connection and try again.");
  }

  return upload;
}

function websiteHref(value: string) {
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;

  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function websiteLabel(value: string) {
  return value.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

function sentenceCase(value: string) {
  const trimmed = value.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function todayDateInputValue() {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

function dateFromInputValue(value: string) {
  return new Date(`${value}T12:00:00`);
}

function dateToInputValue(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function preferredTimelineText(startDate: string, endDate: string) {
  if (!startDate) return "Choose preferred dates";

  const formatter = new Intl.DateTimeFormat("en-CA", { day: "numeric", month: "short", year: "numeric" });
  const start = formatter.format(dateFromInputValue(startDate));
  return endDate ? `${start} to ${formatter.format(dateFromInputValue(endDate))}` : start;
}

function clampCount(value: number, max: number) {
  return Math.max(0, Math.min(max, value));
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

async function videoFromFile(file: File): Promise<RequestVideo> {
  const allowedTypes = ["video/mp4", "video/quicktime", "video/webm"] as const;
  if (!allowedTypes.some((type) => type === file.type)) {
    throw new Error("Use an MP4, MOV, or WebM video.");
  }
  if (file.size > 60_000_000) {
    throw new Error("Video must be smaller than 60 MB.");
  }

  const previewUrl = URL.createObjectURL(file);
  try {
    const durationSeconds = await readVideoDuration(previewUrl);
    if (durationSeconds <= 0 || durationSeconds > 90) {
      throw new Error("Video must be 90 seconds or shorter.");
    }
    return {
      file,
      fileName: file.name,
      contentType: file.type as RequestVideo["contentType"],
      durationSeconds,
      previewUrl
    };
  } catch (error) {
    URL.revokeObjectURL(previewUrl);
    throw error;
  }
}

function readVideoDuration(previewUrl: string) {
  return new Promise<number>((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => resolve(video.duration);
    video.onerror = () => reject(new Error("The video could not be opened."));
    video.src = previewUrl;
  });
}

function formatFileSize(bytes: number) {
  return `${Math.max(0.1, bytes / 1_000_000).toFixed(1)} MB`;
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
