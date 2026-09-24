import { type FormEvent, type ReactNode, useEffect, useState } from "react";

const apiBaseUrl = (import.meta.env.VITE_SNAPQUOTE_API_URL ?? "https://dctmpfrbkgntiuhjbblu.functions.supabase.co/snapquote").replace(/\/$/, "");

type PublicReview = {
  token: string;
  submitted: boolean;
  reviewerName: string;
  rating: number | null;
  org: {
    id: string;
    name: string;
    logoUrl: string | null;
  };
};

type ReviewState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; review: PublicReview };

export function ReviewPage(props: { token: string }) {
  const [state, setState] = useState<ReviewState>({ kind: "loading" });
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    let active = true;

    api<PublicReview>(`/public/reviews/${encodeURIComponent(props.token)}`)
      .then((review) => {
        if (active) setState({ kind: "ready", review });
      })
      .catch(() => {
        if (active) setState({ kind: "error", message: "This review link is not available. Ask the provider for a new link." });
      });

    return () => {
      active = false;
    };
  }, [props.token]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.kind !== "ready" || rating === 0 || submitting) return;
    setSubmitting(true);

    try {
      await api<{ submitted: true }>(`/public/reviews/${encodeURIComponent(props.token)}`, {
        method: "POST",
        body: JSON.stringify({ rating, body })
      });
      setComplete(true);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "The review could not be submitted. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (state.kind === "loading") {
    return <ReviewShell><ReviewMessage title="Opening review" body="Loading the provider details..." /></ReviewShell>;
  }

  if (state.kind === "error") {
    return <ReviewShell><ReviewMessage title="Review unavailable" body={state.message} /></ReviewShell>;
  }

  const { review } = state;
  if (review.submitted || complete) {
    return (
      <ReviewShell>
        <ReviewBrand review={review} />
        <section className="review-complete" aria-live="polite">
          <span aria-hidden="true">&#10003;</span>
          <p className="section-label">Review received</p>
          <h1>Thank you.</h1>
          <p>Your feedback has been shared with {review.org.name}.</p>
        </section>
      </ReviewShell>
    );
  }

  return (
    <ReviewShell>
      <ReviewBrand review={review} />
      <form className="review-form" onSubmit={submit}>
        <p className="section-label">Verified quote review</p>
        <h1>How was your experience with {review.org.name}?</h1>
        <p className="review-intro">Your review will appear on their public QuoteVan request page.</p>

        <fieldset className="review-rating">
          <legend>Your rating</legend>
          <div>
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                aria-label={`${value} ${value === 1 ? "star" : "stars"}`}
                aria-pressed={rating === value}
                className={value <= rating ? "is-active" : ""}
                key={value}
                type="button"
                onClick={() => setRating(value)}
              >
                &#9733;
              </button>
            ))}
          </div>
        </fieldset>

        <label className="review-comment" htmlFor="review-comment">
          <span>Share a few details <small>Optional</small></span>
          <textarea
            id="review-comment"
            maxLength={1200}
            placeholder="What stood out about the communication, quote, or completed work?"
            rows={5}
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
        </label>

        <button className="review-submit" disabled={rating === 0 || submitting} type="submit">
          {submitting ? "Submitting..." : "Submit review"}
        </button>
        <p className="review-verified-note">Verified because this review is connected to an accepted QuoteVan quote.</p>
      </form>
      <footer className="review-footer">Powered by <a href="/">QuoteVan</a></footer>
    </ReviewShell>
  );
}

function ReviewShell(props: { children: ReactNode }) {
  return <main className="review-page"><div className="review-shell">{props.children}</div></main>;
}

function ReviewBrand(props: { review: PublicReview }) {
  return (
    <header className="review-brand">
      {props.review.org.logoUrl
        ? <img alt="" src={props.review.org.logoUrl} />
        : <span aria-hidden="true">{props.review.org.name.trim().charAt(0).toUpperCase() || "Q"}</span>}
      <div>
        <strong>{props.review.org.name}</strong>
        <small>Customer review</small>
      </div>
    </header>
  );
}

function ReviewMessage(props: { title: string; body: string }) {
  return (
    <section className="review-message">
      <p className="section-label">QuoteVan review</p>
      <h1>{props.title}</h1>
      <p>{props.body}</p>
    </section>
  );
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init.headers }
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(body?.message ?? "Request failed. Try again.");
  }

  return await response.json() as T;
}
