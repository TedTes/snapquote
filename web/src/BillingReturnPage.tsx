import { contactEmails, mailtoUrl } from "./contact";

type BillingReturnKind = "success" | "cancelled" | "manage";

const content: Record<BillingReturnKind, {
  eyebrow: string;
  title: string;
  body: string;
  action: string;
}> = {
  success: {
    eyebrow: "Billing",
    title: "Payment complete",
    body: "Return to QuoteVan. Your plan will update after Stripe confirms the subscription.",
    action: "Open QuoteVan"
  },
  cancelled: {
    eyebrow: "Billing",
    title: "Checkout cancelled",
    body: "No subscription was started. You can return to QuoteVan and upgrade when you are ready.",
    action: "Open QuoteVan"
  },
  manage: {
    eyebrow: "Billing",
    title: "Subscription updated",
    body: "Return to QuoteVan to continue quoting.",
    action: "Open QuoteVan"
  }
};

export function BillingReturnPage(props: { kind: BillingReturnKind }) {
  const copy = content[props.kind];

  return (
    <main className="billing-return-page">
      <section className="billing-return-card">
        <div className="brand-mark large">QV</div>
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p>{copy.body}</p>
        <button type="button" onClick={() => window.location.assign("snapquote://settings/billing")}>
          {copy.action}
        </button>
        <a href={mailtoUrl(contactEmails.support, { subject: "QuoteVan billing support" })}>Contact support</a>
      </section>
    </main>
  );
}
