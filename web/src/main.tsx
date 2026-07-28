import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LandingPage } from "./marketing/LandingPage";
import { QuotePage } from "./QuotePage";
import "./styles.css";

function Root() {
  const token = quoteTokenFromPath();
  if (token !== null) {
    return <QuotePage token={token} />;
  }

  if (window.location.pathname === "/privacy") {
    return (
      <SimplePage
        title="Privacy"
        body="QuoteVan is being prepared for early access. Customer quote links are private by URL, and quote data is used to deliver, track, and manage the quoting workflow."
      />
    );
  }

  if (window.location.pathname === "/terms") {
    return (
      <SimplePage
        title="Terms"
        body="QuoteVan is currently in early access. Service providers are responsible for reviewing every quote, price, term, and customer-facing message before sending."
      />
    );
  }

  if (window.location.pathname === "/support") {
    return (
      <SimplePage
        title="Support"
        body="Need help with QuoteVan? Email hello@quotevan.com and include the email address used for your account."
      />
    );
  }

  return <LandingPage />;
}

/** Returns the token for a `/q/:token` path, or null if the path isn't a quote link. */
function quoteTokenFromPath(): string | null {
  const parts = window.location.pathname.split("/").filter(Boolean);
  return parts[0] === "q" ? parts[1] ?? "" : null;
}

function SimplePage(props: { title: string; body: string }) {
  return (
    <main className="simple-page">
      <a className="simple-page-brand" href="/">QuoteVan</a>
      <section className="simple-page-card">
        <p className="eyebrow">QuoteVan</p>
        <h1>{props.title}</h1>
        <p>{props.body}</p>
        <a className="simple-page-link" href="/">Back to home</a>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
