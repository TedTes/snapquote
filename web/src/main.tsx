import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BillingReturnPage } from "./BillingReturnPage";
import { LegalPage } from "./LegalPage";
import { LandingPage } from "./marketing/LandingPage";
import { QuotePage } from "./QuotePage";
import "./styles.css";

function Root() {
  const token = quoteTokenFromPath();
  if (token !== null) {
    return <QuotePage token={token} />;
  }

  if (window.location.pathname === "/privacy") {
    return <LegalPage kind="privacy" />;
  }

  if (window.location.pathname === "/terms") {
    return <LegalPage kind="terms" />;
  }

  if (window.location.pathname === "/support") {
    return <LegalPage kind="support" />;
  }

  if (window.location.pathname === "/account-deletion" || window.location.pathname === "/delete-account" || window.location.pathname === "/data-deletion") {
    return <LegalPage kind="account-deletion" />;
  }

  if (window.location.pathname === "/billing/success") {
    return <BillingReturnPage kind="success" />;
  }

  if (window.location.pathname === "/billing/cancelled" || window.location.pathname === "/billing/canceled") {
    return <BillingReturnPage kind="cancelled" />;
  }

  if (window.location.pathname === "/billing") {
    return <BillingReturnPage kind="manage" />;
  }

  return <LandingPage />;
}

/** Returns the token for a `/q/:token` path, or null if the path isn't a quote link. */
function quoteTokenFromPath(): string | null {
  const parts = window.location.pathname.split("/").filter(Boolean);
  return parts[0] === "q" ? parts[1] ?? "" : null;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
