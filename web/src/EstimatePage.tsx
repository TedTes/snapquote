import { DayPicker, type DateRange } from "@daypicker/react";
import "@daypicker/react/style.css";
import { type ChangeEvent, type CSSProperties, type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";

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
  publicSlug?: string | null;
  logoUrl: string | null;
  contactPhone: string | null;
  website: string | null;
  currency: string;
  profileBio?: string | null;
  serviceArea?: string | null;
  yearsInBusiness?: number | null;
  profileServices?: string[];
  portfolio?: Array<{
    id: string;
    imageUrl: string;
    caption: string;
    position: number;
    published: boolean;
    createdAt: string;
  }>;
  reviews?: {
    averageRating: number | null;
    count: number;
    highlights: Array<{
      id: string;
      reviewerName: string;
      rating: number;
      body: string;
      submittedAt: string;
    }>;
  };
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

type SpeechRecognitionResultEventLike = Event & {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

type SpeechRecognitionErrorEventLike = Event & {
  error: string;
};

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  }
}

/** Element that receives focus when a field is invalid. Order matches the page. */
const fieldOrder: FieldKey[] = ["address", "scope", "name", "contact", "email", "phone"];
const fieldIds: Record<FieldKey, string> = {
  scope: "estimate-rooms",
  name: "estimate-name",
  contact: "estimate-email",
  email: "estimate-email",
  phone: "estimate-phone",
  address: "estimate-address"
};

const composerSteps = ["Describe", "Details", "Contact"] as const;
const finalComposerStep = composerSteps.length - 1;
const composerStepFields: Record<number, FieldKey[]> = {
  0: [],
  1: ["address", "scope"],
  2: ["name", "contact", "email", "phone"]
};
const fieldComposerStep: Record<FieldKey, number> = {
  address: 1,
  scope: 1,
  name: 2,
  contact: 2,
  email: 2,
  phone: 2
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
  const city = "";
  const [company, setCompany] = useState("");
  const [submitState, setSubmitState] = useState<"idle" | "submitting">("idle");
  const [activeStep, setActiveStep] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<RequestResponse | null>(() => readSubmissionReceipt(orgId));
  const confirmationHeadingRef = useRef<HTMLHeadingElement>(null);
  const composerHeadingRef = useRef<HTMLHeadingElement>(null);
  const focusComposerHeadingRef = useRef(false);
  const pendingFieldFocusRef = useRef<FieldKey | null>(null);

  useEffect(() => {
    setResult(readSubmissionReceipt(orgId));
  }, [orgId]);

  useEffect(() => {
    if (result) {
      confirmationHeadingRef.current?.focus();
    }
  }, [result]);

  useEffect(() => {
    const pendingField = pendingFieldFocusRef.current;
    if (pendingField && fieldComposerStep[pendingField] === activeStep && showErrors) {
      window.requestAnimationFrame(() => {
        focusField(pendingField);
        pendingFieldFocusRef.current = null;
      });
      return;
    }

    if (!focusComposerHeadingRef.current) return;
    focusComposerHeadingRef.current = false;
    window.requestAnimationFrame(() => composerHeadingRef.current?.focus({ preventScroll: true }));
  }, [activeStep, showErrors]);

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
  const resolvedOrgId = org?.id ?? orgId;
  const errors = validateRequest({ roomCount, doorCount, notes, name: customerName, email, phone, address });
  const visibleErrors: FieldErrors = showErrors ? errors : {};
  const scopeDescribedBy = visibleErrors.scope ? "estimate-scope-error" : undefined;
  const contactDescribedBy = visibleErrors.contact ? "estimate-contact-error" : undefined;

  function openComposerStep(step: number) {
    focusComposerHeadingRef.current = true;
    setShowErrors(false);
    setSubmitError(null);
    setActiveStep(Math.max(0, Math.min(finalComposerStep, step)));
  }

  function revealInvalidField(field: FieldKey) {
    pendingFieldFocusRef.current = field;
    setShowErrors(true);
    setActiveStep(fieldComposerStep[field]);
  }

  function continueComposer() {
    const firstInvalid = composerStepFields[activeStep]?.find((key) => errors[key]);
    if (firstInvalid) {
      setSubmitError(null);
      revealInvalidField(firstInvalid);
      return;
    }

    openComposerStep(activeStep + 1);
  }

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (result || submitState === "submitting") return;

    if (activeStep < finalComposerStep) {
      continueComposer();
      return;
    }

    const firstInvalid = fieldOrder.find((key) => errors[key]);

    if (firstInvalid) {
      setSubmitError(null);
      revealInvalidField(firstInvalid);
      return;
    }

    setSubmitState("submitting");
    setSubmitError(null);

    try {
      const uploadedVideo = video ? await uploadRequestVideo(resolvedOrgId, video, company) : null;
      const response = await api<RequestResponse>("/public/requests", {
        method: "POST",
        body: JSON.stringify({
          orgId: resolvedOrgId,
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

  const coverImage = org?.portfolio?.[0]?.imageUrl ?? null;
  const pageStyle = coverImage ? { "--cover-image": `url(${JSON.stringify(coverImage)})` } as CSSProperties : undefined;
  const pageClass = ["estimate-page", embed ? "is-embed" : "", coverImage ? "has-cover-image" : ""].filter(Boolean).join(" ");
  const hasProof = (org?.portfolio?.length ?? 0) > 0 || reviewHighlightsFor(org).length > 0;

  return (
    <main className={pageClass} style={pageStyle}>
      <div className="estimate-cover" aria-hidden="true" />
      <div className="estimate-frame">
        <div className={result ? "estimate-public-layout is-received" : "estimate-public-layout"}>
          <ProviderHeader org={org} showRequestLink={!result && hasProof} />

          <div className="estimate-provider-proof">
            <ProviderAbout org={org} />
            <ProviderServices org={org} />
            <ProviderPortfolio org={org} />
            <ProviderReviews org={org} />
          </div>

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
            <aside className="estimate-request" id="request-quote" aria-labelledby="estimate-request-title">
              <header className="estimate-request-head">
                <h2 id="estimate-request-title">Request quote</h2>
                <ol className="estimate-request-steps" aria-label="Request steps">
                  {composerSteps.map((step, index) => (
                    <li
                      aria-current={index === activeStep ? "step" : undefined}
                      className={index < activeStep ? "is-done" : index === activeStep ? "is-current" : undefined}
                      key={step}
                    >
                      <span className="estimate-request-step-mark" aria-hidden="true">
                        {index < activeStep ? "\u2713" : index + 1}
                      </span>
                      <span>{step}</span>
                      {index < activeStep ? <span className="estimate-sr-only"> (completed)</span> : null}
                    </li>
                  ))}
                </ol>
              </header>

              <form className="estimate-form estimate-composer" noValidate onSubmit={submitRequest}>
                <label className="estimate-hidden-field" aria-hidden="true">
                  Company
                  <input autoComplete="off" tabIndex={-1} value={company} onChange={(event) => setCompany(event.target.value)} />
                </label>

                <div className="estimate-composer-body" key={activeStep}>
                  {activeStep === 0 ? (
                    <section aria-labelledby="estimate-description-title">
                      <h3 className="estimate-sr-only" id="estimate-description-title" ref={composerHeadingRef} tabIndex={-1}>Describe the job</h3>
                      <VoiceNoteField value={notes} onChange={setNotes} />
                      <section className="estimate-composer-subsection" aria-labelledby="estimate-photos-title">
                        <div className="estimate-section-head">
                          <h3 id="estimate-photos-title">Photos and video</h3>
                          <span>Optional &middot; {photos.length}/4</span>
                        </div>
                        <PhotoPicker photos={photos} onChange={setPhotos} onError={setMediaError} />
                        <VideoPicker video={video} onChange={setVideo} onError={setMediaError} />
                        {mediaError ? <FieldError id="estimate-media-error">{mediaError}</FieldError> : null}
                      </section>
                    </section>
                  ) : null}

                  {activeStep === 1 ? (
                    <section aria-labelledby="estimate-scope-title">
                      <h3 className="estimate-sr-only" id="estimate-scope-title" ref={composerHeadingRef} tabIndex={-1}>Job details</h3>

                      <TextField
                        autoComplete="street-address"
                        error={visibleErrors.address}
                        id={fieldIds.address}
                        label="Job address"
                        labelHidden
                        placeholder="Job address"
                        required
                        value={address}
                        onChange={setAddress}
                      />

                      <fieldset className="estimate-fieldset">
                        <legend>What needs painting?<small>Pick any</small></legend>
                        <div className="estimate-choice-grid surfaces">
                          <Choice type="checkbox" label="Walls" checked={surfaces.walls} onChange={(checked) => setSurfaces((current) => ({ ...current, walls: checked }))} />
                          <Choice type="checkbox" label="Ceilings" checked={surfaces.ceilings} onChange={(checked) => setSurfaces((current) => ({ ...current, ceilings: checked }))} />
                          <Choice type="checkbox" label="Trim" checked={surfaces.trim} onChange={(checked) => setSurfaces((current) => ({ ...current, trim: checked }))} />
                        </div>
                      </fieldset>

                      <div className="estimate-field-grid two counts">
                        <CountField
                          describedBy={scopeDescribedBy}
                          id={fieldIds.scope}
                          invalid={Boolean(visibleErrors.scope)}
                          label="Rooms or areas"
                          max={maxRooms}
                          value={roomCount}
                          onChange={setRoomCount}
                        />
                        <CountField
                          describedBy={scopeDescribedBy}
                          id="estimate-doors"
                          invalid={Boolean(visibleErrors.scope)}
                          label="Doors"
                          max={maxDoors}
                          value={doorCount}
                          onChange={setDoorCount}
                        />
                      </div>

                      <fieldset className="estimate-fieldset">
                        <legend>Who is providing the paint?<small>Optional</small></legend>
                        <div className="estimate-choice-grid paint">
                          <Choice type="radio" name="estimate-paint" label="I have the paint" checked={paintChoice === "customer"} onChange={() => setPaintChoice("customer")} />
                          <Choice type="radio" name="estimate-paint" label="Contractor supplies" checked={paintChoice === "contractor"} onChange={() => setPaintChoice("contractor")} />
                          <Choice type="radio" name="estimate-paint" label="Not sure yet" checked={paintChoice === "unsure"} onChange={() => setPaintChoice("unsure")} />
                        </div>
                      </fieldset>
                      {visibleErrors.scope ? <FieldError id="estimate-scope-error">{visibleErrors.scope}</FieldError> : null}

                      <section className="estimate-composer-subsection" aria-labelledby="estimate-timeline-title">
                        <div className="estimate-section-head">
                          <h3 id="estimate-timeline-title">Preferred dates</h3>
                          <span>Optional</span>
                        </div>
                        <PreferredTimelinePicker
                          endDate={preferredEndDate}
                          startDate={preferredStartDate}
                          onChange={(startDate, endDate) => {
                            setPreferredStartDate(startDate);
                            setPreferredEndDate(endDate);
                          }}
                        />
                      </section>
                    </section>
                  ) : null}

                  {activeStep === 2 ? (
                    <section aria-labelledby="estimate-contact-title">
                      <h3 className="estimate-sr-only" id="estimate-contact-title" ref={composerHeadingRef} tabIndex={-1}>Contact</h3>

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
                    </section>
                  ) : null}
                </div>

                <div className="estimate-composer-footer">
                  {submitError ? <p className="estimate-error" role="alert">{submitError}</p> : null}
                  <div className="estimate-composer-actions">
                    {/* Distinct keys: reusing one DOM button would flip it to type="submit" mid-click and submit on arrival at the last step. */}
                    {activeStep > 0 ? <button className="estimate-composer-back" type="button" onClick={() => openComposerStep(activeStep - 1)}>Back</button> : null}
                    {activeStep < finalComposerStep ? (
                      <button className="estimate-composer-next" key="continue" type="button" onClick={continueComposer}>Continue</button>
                    ) : (
                      <button className="estimate-submit" key="submit" type="submit" disabled={submitState === "submitting"}>
                        {submitState === "submitting" ? "Sending..." : "Send request"}
                      </button>
                    )}
                  </div>
                  {activeStep === finalComposerStep && org?.contactPhone ? (
                    <p className="estimate-submit-contact">
                      Prefer to talk? <a href={phoneHref(org.contactPhone)}>Call {org.name}</a>
                    </p>
                  ) : null}
                </div>
              </form>
            </aside>
          )}
        </div>

        <ProviderFooter />
      </div>
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
  placeholder?: string;
  labelHidden?: boolean;
  error?: string | undefined;
  /** Marks the input invalid when the message is shown elsewhere, such as under a pair of fields. */
  invalid?: boolean;
  describedBy?: string | undefined;
}) {
  const errorId = `${props.id}-error`;
  const invalid = Boolean(props.error) || props.invalid === true;
  const describedBy = [props.error ? errorId : null, props.describedBy].filter(Boolean).join(" ") || undefined;

  return (
    <div className={`${invalid ? "estimate-field has-error" : "estimate-field"}${props.labelHidden ? " has-hidden-label" : ""}`}>
      <label className={props.labelHidden ? "estimate-sr-only" : undefined} htmlFor={props.id}>
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
        placeholder={props.placeholder}
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

function VoiceNoteField(props: {
  value: string;
  onChange: (value: string) => void;
}) {
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const heardSpeechRef = useRef(false);
  const sessionBaseRef = useRef("");
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState("");
  const SpeechRecognition = typeof window === "undefined"
    ? undefined
    : window.SpeechRecognition ?? window.webkitSpeechRecognition;

  useEffect(() => () => {
    const recognition = recognitionRef.current;
    if (recognition) {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.abort();
    }
    recognitionRef.current = null;
  }, []);

  function startVoiceInput() {
    if (!SpeechRecognition || listening) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = document.documentElement.lang || navigator.language || "en-CA";
    heardSpeechRef.current = false;
    sessionBaseRef.current = props.value.trim();
    recognition.onresult = (event) => {
      const transcript = Array.from({ length: event.results.length }, (_, index) => event.results[index]?.[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (!transcript) return;

      heardSpeechRef.current = true;
      const existing = sessionBaseRef.current;
      props.onChange(`${existing}${existing ? "\n" : ""}${transcript}`.slice(0, 5000));
    };
    recognition.onerror = (event) => {
      const message = event.error === "not-allowed" || event.error === "service-not-allowed"
        ? "Microphone access was not allowed. You can type the description instead."
        : event.error === "no-speech"
          ? "No speech was detected. Try again or type the description."
          : "Voice input stopped. Try again or type the description.";
      setStatus(message);
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
      if (heardSpeechRef.current) {
        setStatus("");
      } else {
        setStatus((current) => current || "No speech was captured. Try again or type the description.");
      }
    };

    recognitionRef.current = recognition;
    setStatus("Listening. Only the text is sent.");
    setListening(true);
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setListening(false);
      setStatus("Voice input could not start. You can type the description instead.");
    }
  }

  function stopVoiceInput() {
    recognitionRef.current?.stop();
  }

  return (
    <div className={SpeechRecognition ? "estimate-voice-field has-mic" : "estimate-voice-field"}>
      <label className="estimate-sr-only" htmlFor="estimate-notes">Job description</label>
      <div className={listening ? "estimate-description-box is-listening" : "estimate-description-box"}>
        <textarea
          aria-describedby={status ? "estimate-voice-status" : undefined}
          id="estimate-notes"
          maxLength={5000}
          // Locked while dictating so a typed edit cannot be overwritten by the next transcribed chunk.
          readOnly={listening}
          rows={6}
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          placeholder="Example: two bedrooms need repainting, with a water stain on the hallway ceiling."
        />
        {SpeechRecognition ? (
          <button
            aria-label={listening ? "Stop dictation" : "Dictate the description"}
            aria-pressed={listening}
            className={listening ? "estimate-mic is-listening" : "estimate-mic"}
            title={listening ? "Stop dictation" : "Dictate the description"}
            type="button"
            onClick={listening ? stopVoiceInput : startVoiceInput}
          >
            <svg aria-hidden="true" focusable="false" height="20" viewBox="0 0 24 24" width="20">
              {listening
                ? <rect fill="currentColor" height="12" rx="2" width="12" x="6" y="6" />
                : (
                  <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
                    <rect height="11" rx="3" width="6" x="9" y="3" />
                    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
                  </g>
                )}
            </svg>
          </button>
        ) : null}
      </div>

      <div className="estimate-voice-meta">
        <div aria-live="polite">{status ? <p className="estimate-voice-status" id="estimate-voice-status">{status}</p> : null}</div>
        <span>{props.value.length}/5000</span>
      </div>
    </div>
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
    <div className={open ? "estimate-timeline is-open" : "estimate-timeline"}>
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
        {props.startDate ? <button type="button" onClick={() => props.onChange("", "")}>Clear dates</button> : null}
      </p>
    </div>
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

function reviewHighlightsFor(org: EstimateOrg | null) {
  return org?.reviews?.highlights.filter((review) => review.body.trim().length > 0) ?? [];
}

function ProviderHeader(props: { org: EstimateOrg | null; showRequestLink: boolean }) {
  const { org } = props;
  const phone = org?.contactPhone?.trim() || null;
  const website = org?.website?.trim() || null;
  const websiteLink = website ? websiteHref(website) : null;
  const reviewCount = org?.reviews?.count ?? 0;
  const averageRating = org?.reviews?.averageRating ?? null;
  const facts = org
    ? [
      sentenceCase(org.trade),
      reviewCount > 0 && averageRating !== null
        ? `${averageRating.toFixed(1)} rating (${reviewCount} ${reviewCount === 1 ? "review" : "reviews"})`
        : "New on QuoteVan",
      org.serviceArea?.trim() || null,
      org.yearsInBusiness !== null && org.yearsInBusiness !== undefined ? yearsInBusinessLabel(org.yearsInBusiness) : null
    ].filter((fact): fact is string => Boolean(fact))
    : [];
  const hasActions = Boolean(phone || website || props.showRequestLink);

  return (
    <header className="estimate-profile">
      <div className="estimate-profile-inner">
        <BrandMark org={org} />
        <div className="estimate-profile-body">
          <h1>{org?.name ?? "Request a quote"}</h1>
          {org ? (
            <ul className="estimate-profile-facts">
              {facts.map((fact) => <li key={fact}>{fact}</li>)}
            </ul>
          ) : <p className="estimate-profile-loading">Loading contractor details...</p>}
          {org ? (
            <ul className="estimate-profile-chips" aria-label="Provider details">
              <li>Provider-reviewed quotes</li>
              {reviewCount > 0 ? <li>Verified reviews</li> : null}
            </ul>
          ) : null}
          {hasActions ? (
            <nav className="estimate-profile-actions" aria-label="Provider contact">
              {phone ? <a aria-label={`Call ${phone}`} href={phoneHref(phone)}>Call<span className="estimate-action-detail"> {phone}</span></a> : null}
              {website ? websiteLink
                ? <a href={websiteLink} rel="noopener noreferrer" target="_blank">Visit website</a>
                : <span>{website}</span> : null}
              {props.showRequestLink ? <a className="estimate-profile-jump" href="#request-quote">Request quote</a> : null}
            </nav>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function ProviderAbout(props: { org: EstimateOrg | null }) {
  const bio = props.org?.profileBio?.trim();
  if (!props.org || !bio) return null;

  return (
    <section className="estimate-proof estimate-about" aria-labelledby="estimate-about-title">
      <div className="estimate-proof-heading">
        <h2 id="estimate-about-title">About {props.org.name}</h2>
      </div>
      <p>{bio}</p>
    </section>
  );
}

function ProviderServices(props: { org: EstimateOrg | null }) {
  const services = props.org?.profileServices?.filter(Boolean) ?? [];
  const hasPublishedProof = (props.org?.portfolio?.length ?? 0) > 0 || (props.org?.reviews?.count ?? 0) > 0;
  if (!props.org || services.length === 0 || !hasPublishedProof) return null;

  return (
    <section className="estimate-proof estimate-services" aria-labelledby="estimate-services-title">
      <div className="estimate-proof-heading">
        <h2 id="estimate-services-title">Services</h2>
      </div>
      <ul className="estimate-service-list">
        {services.map((service) => <li key={service}>{service}</li>)}
      </ul>
    </section>
  );
}

function ProviderPortfolio(props: { org: EstimateOrg | null }) {
  const { org } = props;
  if (!org) return null;

  const portfolio = org.portfolio ?? [];
  // One card covers the fully empty profile, so work and reviews never repeat the same "coming soon" note.
  const nothingYet = portfolio.length === 0 && (org.reviews?.count ?? 0) === 0 && reviewHighlightsFor(org).length === 0;

  if (nothingYet) {
    const providerDetails = [
      org.serviceArea?.trim() || null,
      org.yearsInBusiness !== null && org.yearsInBusiness !== undefined
        ? yearsInBusinessLabel(org.yearsInBusiness)
        : null
    ].filter((detail): detail is string => Boolean(detail));

    return (
      <section className="estimate-proof estimate-profile-preview" aria-labelledby="estimate-profile-preview-title">
        <div className="estimate-proof-heading">
          <h2 id="estimate-profile-preview-title">Provider profile</h2>
          <span>New on QuoteVan</span>
        </div>
        <div className="estimate-profile-preview-grid">
          <article className="estimate-preview-work">
            <div className="estimate-preview-heading">
              <h3>Recent work</h3>
              <span>Coming soon</span>
            </div>
            <div className="estimate-preview-frames" aria-hidden="true"><span /><span /><span /></div>
            <p>Finished project photos will appear here.</p>
          </article>

          <article>
            <div className="estimate-preview-heading">
              <h3>Services</h3>
            </div>
            <ul className="estimate-preview-tags">
              {(org.profileServices?.length ? org.profileServices : [sentenceCase(org.trade)])
                .map((service) => <li key={service}>{service}</li>)}
            </ul>
          </article>

          <article>
            <div className="estimate-preview-heading">
              <h3>Customer reviews</h3>
            </div>
            <strong>No reviews yet</strong>
            <p>Verified reviews will appear after completed quotes.</p>
          </article>

          <article className="estimate-preview-details">
            <div className="estimate-preview-heading">
              <h3>Provider details</h3>
            </div>
            {providerDetails.length > 0 ? (
              <ul>
                {providerDetails.map((detail) => <li key={detail}>{detail}</li>)}
              </ul>
            ) : (
              <p>Service area and experience details are coming soon.</p>
            )}
          </article>
        </div>
      </section>
    );
  }

  return (
    <section className="estimate-proof estimate-portfolio" aria-labelledby="estimate-portfolio-title">
      <div className="estimate-proof-heading">
        <h2 id="estimate-portfolio-title">Recent work</h2>
        <span>{portfolio.length > 0 ? `${portfolio.length} ${portfolio.length === 1 ? "photo" : "photos"}` : "Coming soon"}</span>
      </div>
      {portfolio.length > 0 ? (
        <ul className="estimate-portfolio-grid">
          {portfolio.map((item, index) => (
            <li key={item.id}>
              <figure>
                <img alt={item.caption ? "" : `Completed project by ${org.name}, photo ${index + 1}`} loading="lazy" src={item.imageUrl} />
                {item.caption ? <figcaption>{item.caption}</figcaption> : null}
              </figure>
            </li>
          ))}
        </ul>
      ) : (
        <div className="estimate-proof-empty-state">
          <span className="estimate-proof-empty-mark" aria-hidden="true">+</span>
          <div>
            <strong>Project photos are coming.</strong>
            <p>
              {`Finished projects from ${org.name} will appear here as they are added.`}
            </p>
          </div>
          <dl className="estimate-proof-status">
            <div>
              <dt>Project gallery</dt>
              <dd>Coming soon</dd>
            </div>
          </dl>
        </div>
      )}
    </section>
  );
}

function ProviderReviews(props: { org: EstimateOrg | null }) {
  const { org } = props;
  if (!org) return null;

  const reviews = org.reviews;
  const highlights = reviewHighlightsFor(org);

  // Ratings without written reviews are summarized in the profile header, and a fully empty
  // profile is covered by the combined empty state in ProviderPortfolio.
  if (highlights.length === 0) return null;

  return (
    <section className="estimate-proof estimate-reviews" aria-labelledby="estimate-reviews-title">
      <div className="estimate-proof-heading">
        <h2 id="estimate-reviews-title">Verified customer reviews</h2>
        {reviews?.averageRating !== null && reviews?.averageRating !== undefined
          ? <strong>{reviews.averageRating.toFixed(1)} / 5</strong>
          : null}
      </div>
      <div className="estimate-review-list">
        {highlights.map((review) => (
          <blockquote key={review.id}>
            <div aria-label={`${review.rating} out of 5 stars`}>{starRating(review.rating)}</div>
            <p>{review.body}</p>
            <footer>{review.reviewerName} <span>Verified quote</span></footer>
          </blockquote>
        ))}
      </div>
    </section>
  );
}

function ProviderFooter() {
  return (
    <footer className="estimate-footer">
      <p>Powered by <a href="/">QuoteVan</a></p>
    </footer>
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

function phoneHref(value: string) {
  return `tel:${value.replace(/[^\d+]/g, "")}`;
}

function sentenceCase(value: string) {
  const trimmed = value.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function yearsInBusinessLabel(years: number) {
  if (years === 0) return "Established this year";
  return `${years} ${years === 1 ? "year" : "years"} in business`;
}

function starRating(rating: number) {
  const rounded = Math.max(1, Math.min(5, Math.round(rating)));
  return `${"★".repeat(rounded)}${"☆".repeat(5 - rounded)}`;
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
