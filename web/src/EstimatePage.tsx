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
  profileBio?: string | null;
  serviceArea?: string | null;
  yearsInBusiness?: number | null;
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

const composerSteps = ["Location", "The job", "Photos", "Timing", "Contact", "Review"] as const;
const finalComposerStep = composerSteps.length - 1;
const composerStepFields: Record<number, FieldKey[]> = {
  0: ["address"],
  1: ["scope"],
  2: [],
  3: [],
  4: ["name", "contact", "email", "phone"],
  5: fieldOrder
};
const fieldComposerStep: Record<FieldKey, number> = {
  address: 0,
  scope: 1,
  name: 4,
  contact: 4,
  email: 4,
  phone: 4
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
  const [activeStep, setActiveStep] = useState(0);
  const [requestOpen, setRequestOpen] = useState(embed);
  const [showErrors, setShowErrors] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<RequestResponse | null>(() => readSubmissionReceipt(orgId));
  const confirmationHeadingRef = useRef<HTMLHeadingElement>(null);
  const composerHeadingRef = useRef<HTMLHeadingElement>(null);
  const requestHeadingRef = useRef<HTMLHeadingElement>(null);
  const requestSectionRef = useRef<HTMLElement>(null);
  const pendingRequestScrollRef = useRef(false);
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
    if (!requestOpen || !pendingRequestScrollRef.current) return;
    pendingRequestScrollRef.current = false;

    window.requestAnimationFrame(() => {
      requestSectionRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start"
      });
      requestHeadingRef.current?.focus({ preventScroll: true });
    });
  }, [requestOpen]);

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
  const errors = validateRequest({ roomCount, doorCount, notes, name: customerName, email, phone, address });
  const visibleErrors: FieldErrors = showErrors ? errors : {};
  const summaryKeys = fieldOrder.filter((key) => visibleErrors[key]);
  const scopeDescribedBy = visibleErrors.scope ? "estimate-scope-error" : undefined;
  const contactDescribedBy = visibleErrors.contact ? "estimate-contact-error" : undefined;

  function openRequestForm() {
    if (requestOpen) {
      requestSectionRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start"
      });
      return;
    }

    pendingRequestScrollRef.current = true;
    setRequestOpen(true);
  }

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
        <ProviderHeader
          org={org}
          onRequestQuote={result ? undefined : openRequestForm}
        />

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
          <>
            <ProviderProof org={org} />
            {requestOpen ? (
              <section className="estimate-request" ref={requestSectionRef} aria-labelledby="estimate-request-title">
                <div className="estimate-request-intro">
                  <p className="section-label">Request your quote</p>
                  <h2 id="estimate-request-title" ref={requestHeadingRef} tabIndex={-1}>Tell {org?.name ?? "the provider"} about the job.</h2>
                  <p>A rough idea is enough. They confirm the work and set the price after reviewing your request.</p>
                </div>
                <ProviderValueBand org={org} />
                <div className="estimate-layout">
              <aside className="estimate-next" aria-labelledby="estimate-next-title">
                <p className="section-label">How it works</p>
                <h2 id="estimate-next-title">A real quote, reviewed first.</h2>
                <p>
                  This request goes directly to {org?.name ?? "the provider"}. Nothing is automatically priced or sent to you.
                </p>
                <ol className="estimate-steps">
                  <li><span className="estimate-step-mark" aria-hidden="true">1</span><span><strong>Send the job</strong><small>Add the scope, photos, and preferred dates.</small></span></li>
                  <li><span className="estimate-step-mark" aria-hidden="true">2</span><span><strong>{org?.name ?? "The provider"} reviews it</strong><small>They confirm the work and set the price.</small></span></li>
                  <li><span className="estimate-step-mark" aria-hidden="true">3</span><span><strong>Receive your quote</strong><small>They contact you using the details you provide.</small></span></li>
                </ol>
                <ProviderContact org={org} />
              </aside>

              <form className="estimate-form estimate-composer" noValidate onSubmit={submitRequest}>
                <label className="estimate-hidden-field" aria-hidden="true">
                  Company
                  <input autoComplete="off" tabIndex={-1} value={company} onChange={(event) => setCompany(event.target.value)} />
                </label>

                <div className="estimate-composer-progress">
                  <div>
                    <span>Step {activeStep + 1} of {composerSteps.length}</span>
                    <strong>{composerSteps[activeStep]}</strong>
                  </div>
                  <div
                    aria-label={`Request progress: step ${activeStep + 1} of ${composerSteps.length}`}
                    aria-valuemax={composerSteps.length}
                    aria-valuemin={1}
                    aria-valuenow={activeStep + 1}
                    className="estimate-composer-track"
                    role="progressbar"
                  >
                    {composerSteps.map((step, index) => (
                      <span className={index <= activeStep ? "is-complete" : ""} key={step} />
                    ))}
                  </div>
                </div>

                <div className="estimate-composer-panel" key={activeStep}>
                  {activeStep === 0 ? (
                    <section aria-labelledby="estimate-location-title">
                      <p className="estimate-section-number">Job location</p>
                      <div className="estimate-section-head">
                        <h2 id="estimate-location-title" ref={composerHeadingRef} tabIndex={-1}>Where is the work?</h2>
                      </div>
                      <p className="estimate-section-hint">This helps {org?.name ?? "the provider"} confirm the service area and prepare the quote.</p>
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
                  ) : null}

                  {activeStep === 1 ? (
                    <section aria-labelledby="estimate-scope-title">
                      <p className="estimate-section-number">The job</p>
                      <div className="estimate-section-head">
                        <h2 id="estimate-scope-title" ref={composerHeadingRef} tabIndex={-1}>What needs doing?</h2>
                      </div>
                      <p className="estimate-section-hint">A rough description is enough. {org?.name ?? "The provider"} confirms the details and the price.</p>

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

                      <VoiceNoteField
                        describedBy={scopeDescribedBy}
                        value={notes}
                        onChange={setNotes}
                      />
                      {visibleErrors.scope ? <FieldError id="estimate-scope-error">{visibleErrors.scope}</FieldError> : null}
                    </section>
                  ) : null}

                  {activeStep === 2 ? (
                    <section aria-labelledby="estimate-photos-title">
                      <p className="estimate-section-number">Photos and video</p>
                      <div className="estimate-section-head">
                        <h2 id="estimate-photos-title" ref={composerHeadingRef} tabIndex={-1}>Show the work area</h2>
                        <span>Optional &middot; {photos.length}/4</span>
                      </div>
                      <p className="estimate-section-hint">Clear, wide photos help the provider understand the condition and prepare a better draft.</p>
                      <PhotoPicker photos={photos} onChange={setPhotos} onError={setMediaError} />
                      <VideoPicker video={video} onChange={setVideo} onError={setMediaError} />
                      {mediaError ? <FieldError id="estimate-media-error">{mediaError}</FieldError> : null}
                    </section>
                  ) : null}

                  {activeStep === 3 ? (
                    <section aria-labelledby="estimate-timeline-title">
                      <p className="estimate-section-number">Preferred timeline</p>
                      <div className="estimate-section-head">
                        <h2 id="estimate-timeline-title" ref={composerHeadingRef} tabIndex={-1}>When would work suit you?</h2>
                        <span>Optional</span>
                      </div>
                      <p className="estimate-section-hint">Choose a preferred date or range. This is not a confirmed appointment.</p>
                      <PreferredTimelinePicker
                        endDate={preferredEndDate}
                        startDate={preferredStartDate}
                        onChange={(startDate, endDate) => {
                          setPreferredStartDate(startDate);
                          setPreferredEndDate(endDate);
                        }}
                      />
                    </section>
                  ) : null}

                  {activeStep === 4 ? (
                    <section aria-labelledby="estimate-contact-title">
                      <p className="estimate-section-number">Your contact</p>
                      <div className="estimate-section-head">
                        <h2 id="estimate-contact-title" ref={composerHeadingRef} tabIndex={-1}>Where should the quote go?</h2>
                      </div>
                      <p className="estimate-section-hint">Add an email or phone number so {org?.name ?? "the provider"} can reach you.</p>

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

                  {activeStep === 5 ? (
                    <section aria-labelledby="estimate-review-title">
                      <p className="estimate-section-number">Review</p>
                      <div className="estimate-section-head">
                        <h2 id="estimate-review-title" ref={composerHeadingRef} tabIndex={-1}>Check before sending</h2>
                      </div>
                      <p className="estimate-section-hint">Nothing is priced automatically. {org?.name ?? "The provider"} reviews this request first.</p>
                      <div className="estimate-review-summary">
                        <RequestReviewRow label="Location" value={[address, city].filter(Boolean).join(", ")} onEdit={() => openComposerStep(0)} />
                        <RequestReviewRow label="Job" value={homeownerJobSummary(roomCount, doorCount, surfaces, paintChoice, notes)} onEdit={() => openComposerStep(1)} />
                        <RequestReviewRow label="Media" value={requestMediaSummary(photos.length, Boolean(video))} onEdit={() => openComposerStep(2)} />
                        <RequestReviewRow label="Timing" value={preferredTimelineText(preferredStartDate, preferredEndDate)} onEdit={() => openComposerStep(3)} />
                        <RequestReviewRow label="Contact" value={[customerName, email || phone].filter(Boolean).join(" · ")} onEdit={() => openComposerStep(4)} />
                      </div>
                      {summaryKeys.length > 0 ? (
                        <div className="estimate-summary" role="alert">
                          <strong>{summaryKeys.length === 1 ? "One thing needs fixing" : `${summaryKeys.length} things need fixing`}</strong>
                          <ul>
                            {summaryKeys.map((key) => (
                              <li key={key}>
                                <button type="button" onClick={() => revealInvalidField(key)}>{visibleErrors[key]}</button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </section>
                  ) : null}

                  <div className="estimate-composer-actions">
                    {activeStep > 0 ? <button className="estimate-composer-back" type="button" onClick={() => openComposerStep(activeStep - 1)}>Back</button> : <span />}
                    {activeStep < finalComposerStep ? (
                      <button className="estimate-composer-next" type="button" onClick={continueComposer}>Continue</button>
                    ) : (
                      <button className="estimate-submit" type="submit" disabled={submitState === "submitting"}>
                        {submitState === "submitting" ? "Sending request..." : "Send quote request"}
                      </button>
                    )}
                  </div>

                  {submitError ? <p className="estimate-error" role="alert">{submitError}</p> : null}
                  {activeStep === finalComposerStep && org?.contactPhone ? (
                    <p className="estimate-submit-contact">
                      Prefer to talk? <a href={phoneHref(org.contactPhone)}>Call {org.name}</a>
                    </p>
                  ) : null}
                </div>
              </form>
                </div>
              </section>
            ) : null}
          </>
        )}

        <ProviderFooter org={org} />
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

function VoiceNoteField(props: {
  value: string;
  onChange: (value: string) => void;
  describedBy?: string | undefined;
}) {
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const heardSpeechRef = useRef(false);
  const valueRef = useRef(props.value);
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState("");
  const SpeechRecognition = typeof window === "undefined"
    ? undefined
    : window.SpeechRecognition ?? window.webkitSpeechRecognition;

  valueRef.current = props.value;

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
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = document.documentElement.lang || navigator.language || "en-CA";
    heardSpeechRef.current = false;
    recognition.onresult = (event) => {
      const transcript = Array.from({ length: event.results.length }, (_, index) => event.results[index]?.[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (!transcript) return;

      heardSpeechRef.current = true;
      const current = valueRef.current.trim();
      props.onChange(`${current ? `${current}\n` : ""}${transcript}`.slice(0, 5000));
      setStatus("Voice description added. Review or edit it below.");
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
      if (!heardSpeechRef.current) {
        setStatus((current) => current || "No speech was captured. Try again or type the description.");
      }
    };

    recognitionRef.current = recognition;
    setStatus("Listening. Describe the rooms, condition, colours, or repairs.");
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
    setStatus("Finishing the voice description...");
  }

  return (
    <div className="estimate-voice-field">
      <div className="estimate-voice-heading">
        <label htmlFor="estimate-notes">Describe the work<small>Optional</small></label>
        {SpeechRecognition ? (
          <button
            aria-pressed={listening}
            className={listening ? "estimate-voice-button is-listening" : "estimate-voice-button"}
            type="button"
            onClick={listening ? stopVoiceInput : startVoiceInput}
          >
            <span aria-hidden="true" />
            {listening ? "Stop listening" : "Describe by voice"}
          </button>
        ) : null}
      </div>
      <textarea
        aria-describedby={[props.describedBy, "estimate-voice-privacy"].filter(Boolean).join(" ")}
        id="estimate-notes"
        maxLength={5000}
        rows={5}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        placeholder="Example: two bedrooms need repainting, with a water stain on the hallway ceiling."
      />
      <div className="estimate-voice-meta">
        <p id="estimate-voice-privacy">
          {SpeechRecognition
            ? "Your browser handles speech recognition. Only the editable text is added to this request."
            : "Voice input is not supported in this browser. Type the description here."}
        </p>
        <span>{props.value.length}/5000</span>
      </div>
      {status ? <p className="estimate-voice-status" aria-live="polite">{status}</p> : null}
    </div>
  );
}

function RequestReviewRow(props: { label: string; value: string; onEdit: () => void }) {
  return (
    <div className="estimate-review-row">
      <div>
        <span>{props.label}</span>
        <strong>{props.value || "Not added"}</strong>
      </div>
      <button type="button" onClick={props.onEdit}>Edit</button>
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

function ProviderHeader(props: { org: EstimateOrg | null; onRequestQuote?: () => void }) {
  const { org } = props;
  const phone = org?.contactPhone?.trim() || null;
  const website = org?.website?.trim() || null;
  const websiteLink = website ? websiteHref(website) : null;
  const coverPhoto = org?.portfolio?.[0] ?? null;
  const reviewCount = org?.reviews?.count ?? 0;
  const portfolioCount = org?.portfolio?.length ?? 0;
  const profileFacts = [
    org?.yearsInBusiness !== null && org?.yearsInBusiness !== undefined
      ? { value: `${org.yearsInBusiness}`, label: org.yearsInBusiness === 1 ? "Year in business" : "Years in business" }
      : null,
    reviewCount > 0
      ? { value: `${reviewCount}`, label: reviewCount === 1 ? "Verified review" : "Verified reviews" }
      : null,
    portfolioCount > 0
      ? { value: `${portfolioCount}`, label: portfolioCount === 1 ? "Work photo" : "Work photos" }
      : null,
    { value: "Direct", label: "Provider review" }
  ].filter((fact): fact is { value: string; label: string } => fact !== null);

  return (
    <header className="estimate-profile">
      <div className={coverPhoto ? "estimate-profile-cover has-image" : "estimate-profile-cover"}>
        {coverPhoto ? <img alt="" src={coverPhoto.imageUrl} /> : null}
      </div>
      <div className="estimate-profile-inner">
        <div className="estimate-profile-top">
          <div className="estimate-profile-brand">
            <BrandMark org={org} />
            <div className="estimate-profile-name">
              <h1>{org?.name ?? "Request a quote"}</h1>
              <p>{org ? sentenceCase(org.trade) : "Loading contractor details..."}</p>
              {org ? (
                <div className="estimate-profile-meta">
                  <span className={(org.reviews?.count ?? 0) > 0 ? "has-rating" : ""}>
                    {(org.reviews?.count ?? 0) > 0 && org.reviews?.averageRating !== null && org.reviews?.averageRating !== undefined
                      ? `${org.reviews.averageRating.toFixed(1)} rating · ${org.reviews.count} ${org.reviews.count === 1 ? "review" : "reviews"}`
                      : "New on QuoteVan"}
                  </span>
                  {org.serviceArea ? <span>Serving {org.serviceArea}</span> : null}
                  {org.yearsInBusiness !== null && org.yearsInBusiness !== undefined ? <span>{yearsInBusinessLabel(org.yearsInBusiness)}</span> : null}
                </div>
              ) : null}
            </div>
          </div>
          <nav className="estimate-profile-actions" aria-label="Provider contact">
            {phone ? <a href={phoneHref(phone)}>Call {phone}</a> : null}
            {website ? websiteLink
              ? <a href={websiteLink} rel="noopener noreferrer" target="_blank">Visit website</a>
              : <span>{website}</span> : null}
          </nav>
        </div>
        <div className="estimate-profile-copy">
          <p className="section-label">Local service provider</p>
          <h2>Work worth seeing. A quote reviewed by the people doing it.</h2>
          <p>{org?.profileBio || "Add the job details and useful photos. The provider reviews the work before preparing your quote."}</p>
        </div>
        {props.onRequestQuote ? (
          <button className="estimate-profile-request" disabled={!org} type="button" onClick={props.onRequestQuote}>
            <span>Request a free quote</span>
            <span aria-hidden="true">&rarr;</span>
          </button>
        ) : null}
        {org ? (
          <dl className="estimate-profile-facts">
            {profileFacts.map((fact) => (
              <div key={fact.label}>
                <dt>{fact.value}</dt>
                <dd>{fact.label}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </header>
  );
}

function ProviderProof(props: { org: EstimateOrg | null }) {
  const portfolio = props.org?.portfolio ?? [];
  const reviews = props.org?.reviews;
  const reviewHighlights = reviews?.highlights.filter((review) => review.body.trim().length > 0) ?? [];

  if (portfolio.length === 0 && reviewHighlights.length === 0) return null;

  return (
    <section className="estimate-proof" aria-label="Provider work and customer reviews">
      {portfolio.length > 0 ? (
        <div className="estimate-portfolio">
          <div className="estimate-proof-heading">
            <p className="section-label">Completed work</p>
            <span>{portfolio.length} {portfolio.length === 1 ? "project photo" : "project photos"}</span>
          </div>
          <div className="estimate-portfolio-track">
            {portfolio.map((item, index) => (
              <figure key={item.id}>
                <img alt={item.caption || `Completed project by ${props.org?.name ?? "the provider"}, photo ${index + 1}`} loading="lazy" src={item.imageUrl} />
                {item.caption ? <figcaption>{item.caption}</figcaption> : null}
              </figure>
            ))}
          </div>
        </div>
      ) : null}

      {reviewHighlights.length > 0 ? (
        <div className="estimate-reviews">
          <div className="estimate-proof-heading">
            <p className="section-label">Verified customer reviews</p>
            {reviews?.averageRating !== null && reviews?.averageRating !== undefined
              ? <strong>{reviews.averageRating.toFixed(1)} / 5</strong>
              : null}
          </div>
          <div className="estimate-review-list">
            {reviewHighlights.map((review) => (
              <blockquote key={review.id}>
                <div aria-label={`${review.rating} out of 5 stars`}>{starRating(review.rating)}</div>
                <p>{review.body}</p>
                <footer>{review.reviewerName} <span>Verified quote</span></footer>
              </blockquote>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ProviderValueBand(props: { org: EstimateOrg | null }) {
  const providerName = props.org?.name ?? "the provider";

  return (
    <section className="estimate-values" aria-label={`Quote request reviewed by ${providerName}`}>
      <div className="estimate-values-inner">
        <span className="estimate-value-mark" aria-hidden="true">&#10003;</span>
        <p><strong>Reviewed by {providerName} before pricing</strong><span>Photos and job details go directly into their quote workflow.</span></p>
      </div>
    </section>
  );
}

function ProviderContact(props: { org: EstimateOrg | null }) {
  const phone = props.org?.contactPhone?.trim() || null;
  const website = props.org?.website?.trim() || null;
  const websiteLink = website ? websiteHref(website) : null;
  if (!phone && !websiteLink) return null;

  return (
    <div className="estimate-direct">
      <strong>Prefer a direct conversation?</strong>
      <div>
        {phone ? <a href={phoneHref(phone)}>Call {phone}</a> : null}
        {websiteLink ? <a href={websiteLink} rel="noopener noreferrer" target="_blank">Visit website</a> : null}
      </div>
    </div>
  );
}

function ProviderFooter(props: { org: EstimateOrg | null }) {
  return (
    <footer className="estimate-footer">
      <div>
        <strong>{props.org?.name ?? "Service provider"}</strong>
        <span>{props.org ? `${sentenceCase(props.org.trade)} quote request` : "Quote request"}</span>
      </div>
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

function homeownerJobSummary(
  roomCount: number,
  doorCount: number,
  surfaces: HomeownerJobInput["surfaces"],
  paintChoice: PaintChoice | null,
  notes: string
) {
  const selectedSurfaces = [
    surfaces.walls ? "walls" : null,
    surfaces.ceilings ? "ceilings" : null,
    surfaces.trim ? "trim" : null
  ].filter(Boolean);
  const parts = [
    roomCount > 0 ? `${roomCount} ${roomCount === 1 ? "room" : "rooms"}` : null,
    doorCount > 0 ? `${doorCount} ${doorCount === 1 ? "door" : "doors"}` : null,
    selectedSurfaces.length > 0 ? selectedSurfaces.join(", ") : null,
    paintChoice === "customer" ? "customer has paint" : null,
    paintChoice === "contractor" ? "provider supplies paint" : null,
    paintChoice === "unsure" ? "paint supply undecided" : null
  ].filter(Boolean);
  const cleanNotes = notes.trim().replace(/\s+/g, " ");
  if (cleanNotes) parts.push(cleanNotes.length > 140 ? `${cleanNotes.slice(0, 137)}...` : cleanNotes);
  return parts.join(" · ");
}

function requestMediaSummary(photoCount: number, hasVideo: boolean) {
  const parts = [
    photoCount > 0 ? `${photoCount} ${photoCount === 1 ? "photo" : "photos"}` : null,
    hasVideo ? "1 video" : null
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "No media added";
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
