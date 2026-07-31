const supportEmail = "tedtfu@gmail.com";
const supportMailto = `mailto:${supportEmail}`;

type LegalPageKind = "privacy" | "terms" | "support" | "account-deletion";

export function LegalPage(props: { kind: LegalPageKind }) {
  const page = legalPages[props.kind];

  return (
    <main className="legal-page">
      <a className="legal-brand" href="/">QuoteVan</a>
      <article className="legal-card">
        <p className="eyebrow">{page.kicker}</p>
        <h1>{page.title}</h1>
        <p className="legal-updated">Effective date: July 31, 2026</p>
        {page.intro ? <p className="legal-intro">{page.intro}</p> : null}
        {page.sections.map((section) => (
          <section className="legal-section" key={section.title}>
            <h2>{section.title}</h2>
            {section.paragraphs?.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            {section.items ? (
              <ul>
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
        <div className="legal-actions">
          <a href="/">Back to home</a>
          <a href={supportMailto}>Contact support</a>
        </div>
      </article>
    </main>
  );
}

type LegalSection = {
  title: string;
  paragraphs?: string[];
  items?: string[];
};

type LegalPageContent = {
  title: string;
  kicker: string;
  intro?: string;
  sections: LegalSection[];
};

const legalPages: Record<LegalPageKind, LegalPageContent> = {
  privacy: {
    title: "Privacy Policy",
    kicker: "QuoteVan privacy",
    intro:
      "This Privacy Policy explains how QuoteVan collects, uses, shares, and protects information when service providers use QuoteVan to create and send quotes, and when customers open public quote links.",
    sections: [
      {
        title: "Who operates QuoteVan",
        paragraphs: [
          `QuoteVan is operated by the QuoteVan developer. For privacy questions, requests, or account deletion, contact ${supportEmail}.`
        ]
      },
      {
        title: "Information we collect",
        items: [
          "Account information, such as your login email, name, business name, trade, default quote settings, and authentication provider details.",
          "Customer and job information that you enter, such as customer names, email addresses, phone numbers, job addresses, cities, quote scope, line items, prices, taxes, deposits, terms, quote status, and quote history.",
          "Price book information, including services, materials, rates, confirmation status, and pricing suggestions.",
          "Public quote activity, including when a private quote link is opened, accepted, declined, or used to start or complete a deposit payment.",
          "Payment metadata, such as deposit amount, currency, Stripe connected account status, Stripe checkout session identifiers, and payment status. QuoteVan does not collect or store full card numbers.",
          "Optional audio, transcript, typed notes, photos, or files you choose to provide for quote drafting or business setup.",
          "Technical information needed to operate the service, such as IP address, request logs, device/app diagnostics, timestamps, and security or fraud-prevention logs."
        ]
      },
      {
        title: "How we use information",
        items: [
          "Create, price, send, display, track, revise, archive, and manage quotes.",
          "Maintain your customer list, price book, business settings, and account session.",
          "Generate private quote links and show customers a browser-based quote page.",
          "Send quote emails and follow-up emails when requested.",
          "Support optional AI-assisted transcription and scope extraction for job notes. You are responsible for reviewing all generated quote content before sending.",
          "Connect service providers to Stripe so customers can pay quote deposits when online deposits are enabled.",
          "Provide support, troubleshoot bugs, secure the service, prevent abuse, and comply with legal or platform requirements."
        ]
      },
      {
        title: "Payments",
        paragraphs: [
          "Online deposits are processed by Stripe. When a customer pays a deposit, Stripe collects payment details directly through Stripe Checkout. QuoteVan receives payment status and related metadata but does not receive or store full payment card numbers.",
          "Service providers who enable deposits may be asked to complete Stripe Connect onboarding. Stripe may collect identity, business, bank, tax, and compliance information directly from the provider under Stripe's own terms and privacy policy."
        ]
      },
      {
        title: "Third-party service providers",
        paragraphs: [
          "We use service providers to operate QuoteVan. These providers may process information on our behalf or directly as independent services."
        ],
        items: [
          "Supabase for authentication, database, storage, and Edge Functions.",
          "Stripe for connected accounts, checkout, deposit payments, payment status, fraud prevention, and compliance.",
          "Resend or another email delivery provider for quote emails and follow-ups.",
          "OpenAI for optional transcription and scope extraction when AI-assisted drafting is enabled.",
          "Apple, Google, Expo, Cloudflare, and app store services for sign-in, hosting, builds, distribution, diagnostics, or platform operations."
        ]
      },
      {
        title: "How information is shared",
        items: [
          "With your customers when you send them a quote link or email that contains quote details.",
          "With payment providers when deposits are enabled or a customer starts payment.",
          "With service providers that help us operate, host, send, secure, and improve QuoteVan.",
          "When required to comply with law, legal process, platform requirements, fraud prevention, security, or to protect rights and safety.",
          "QuoteVan does not sell personal information."
        ]
      },
      {
        title: "Public quote links",
        paragraphs: [
          "Quote links are private by URL. Anyone with the link may be able to view the quote, so only send quote links to intended recipients. We may record view, accept, decline, and payment activity so the service provider can track quote status."
        ]
      },
      {
        title: "Security",
        paragraphs: [
          "We use reasonable technical and organizational measures designed to protect personal information, including encrypted transport, provider-managed authentication, access controls, and hosted infrastructure security. No internet service can be guaranteed to be completely secure."
        ]
      },
      {
        title: "Retention and deletion",
        paragraphs: [
          "We keep account, customer, quote, price book, payment metadata, and operational records for as long as needed to provide QuoteVan, support the account, resolve disputes, comply with legal obligations, and protect against fraud or abuse.",
          `To request account deletion, visit /account-deletion or email ${supportEmail} from the email address used for your QuoteVan account. We may retain limited records where required for legal, tax, payment, dispute, security, backup, or fraud-prevention purposes.`
        ]
      },
      {
        title: "Your choices",
        items: [
          "You can choose what customer and job information to enter.",
          "You can avoid optional microphone, photo, camera, or AI-assisted features.",
          "You can request access, correction, export, or deletion by contacting support.",
          "You can disconnect or manage payment onboarding through Stripe where available."
        ]
      },
      {
        title: "Children",
        paragraphs: [
          "QuoteVan is intended for service providers and is not directed to children under 13. Do not use QuoteVan to knowingly collect information from children."
        ]
      },
      {
        title: "Changes",
        paragraphs: [
          "We may update this Privacy Policy as QuoteVan changes. The effective date above shows when this page was last updated."
        ]
      }
    ]
  },
  terms: {
    title: "Terms of Service",
    kicker: "QuoteVan terms",
    intro:
      "These Terms govern your use of QuoteVan. By using QuoteVan, you agree to these Terms and to any customer-facing quote terms you choose to send through the service.",
    sections: [
      {
        title: "Early access service",
        paragraphs: [
          "QuoteVan is currently an early access quoting tool for home and field-service providers. Features may change, be unavailable, or require additional setup."
        ]
      },
      {
        title: "Your responsibility for quotes",
        items: [
          "You are responsible for reviewing every customer, scope, price, tax, deposit, term, message, and quote before sending.",
          "QuoteVan may help draft or calculate quote content, but it does not replace your professional judgment.",
          "You are responsible for complying with laws, licensing, permits, consumer protection rules, tax rules, and industry obligations that apply to your business.",
          "You are responsible for obtaining permission to enter and use customer information in QuoteVan."
        ]
      },
      {
        title: "Customer relationships",
        paragraphs: [
          "QuoteVan is not a party to the service contract between you and your customer. You control the services you offer, the prices you charge, and the work you perform. QuoteVan does not guarantee that a customer will accept, pay, or honor a quote."
        ]
      },
      {
        title: "Payments and deposits",
        paragraphs: [
          "If you enable online deposits, payments are processed by Stripe. Customers pay through Stripe Checkout, and providers may need a Stripe connected account. Stripe may require identity, business, tax, banking, and compliance information.",
          "You are responsible for your refund, cancellation, chargeback, tax, and customer service obligations. QuoteVan may show payment status and deposit metadata, but it does not hold customer funds or act as a bank, escrow agent, insurer, or payment card processor."
        ]
      },
      {
        title: "Acceptable use",
        items: [
          "Do not use QuoteVan for unlawful, deceptive, abusive, fraudulent, or harmful activity.",
          "Do not send spam, misleading quotes, or messages to people who did not authorize contact.",
          "Do not upload malware, attempt to bypass security, reverse engineer the service, or interfere with other users.",
          "Do not enter highly sensitive information unless it is necessary for the quote and you have authority to do so."
        ]
      },
      {
        title: "Account security",
        paragraphs: [
          "You are responsible for your account, devices, sign-in methods, and activity under your account. Tell us promptly if you believe your account has been compromised."
        ]
      },
      {
        title: "AI-assisted features",
        paragraphs: [
          "QuoteVan may use AI-assisted transcription or extraction to help turn notes into quote drafts. AI output can be incomplete or incorrect. You must review and approve all generated content before sending it to a customer."
        ]
      },
      {
        title: "Availability and changes",
        paragraphs: [
          "We may change, suspend, or discontinue any part of QuoteVan. We may also limit or terminate access if we believe use violates these Terms, creates risk, or harms the service."
        ]
      },
      {
        title: "Disclaimers",
        paragraphs: [
          "QuoteVan is provided as is and as available. To the fullest extent allowed by law, we disclaim warranties of merchantability, fitness for a particular purpose, non-infringement, uninterrupted operation, and error-free results."
        ]
      },
      {
        title: "Limitation of liability",
        paragraphs: [
          "To the fullest extent allowed by law, QuoteVan will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for lost profits, lost revenue, lost data, lost business, pricing mistakes, customer disputes, or payment disputes."
        ]
      },
      {
        title: "Support and contact",
        paragraphs: [
          `For support or legal questions, contact ${supportEmail}.`
        ]
      },
      {
        title: "Changes to these Terms",
        paragraphs: [
          "We may update these Terms as QuoteVan changes. Continued use after an update means you accept the updated Terms."
        ]
      }
    ]
  },
  support: {
    title: "Support",
    kicker: "QuoteVan help",
    intro: "For QuoteVan support, account questions, privacy requests, or app store review questions, contact support by email.",
    sections: [
      {
        title: "Contact",
        paragraphs: [
          `Email ${supportEmail}. Include the email address used for your QuoteVan account, the platform you are using, and a short description of the issue.`
        ]
      },
      {
        title: "Payment issues",
        paragraphs: [
          "If your question is about a customer deposit, include the quote/customer name, approximate payment time, and the Stripe account used by the provider. Do not email full card numbers or bank account numbers."
        ]
      },
      {
        title: "Privacy or deletion requests",
        paragraphs: [
          "Use the account deletion page or email support from the email address used for your account."
        ]
      }
    ]
  },
  "account-deletion": {
    title: "Account Deletion",
    kicker: "QuoteVan data request",
    intro:
      "You can request deletion of your QuoteVan account and associated app data even if you no longer have the app installed.",
    sections: [
      {
        title: "How to request deletion",
        paragraphs: [
          `Email ${supportEmail} with the subject "Delete my QuoteVan account" from the email address used for your QuoteVan account. If you cannot access that email address, include enough information for us to verify account ownership.`
        ]
      },
      {
        title: "Data we delete",
        items: [
          "Your QuoteVan user account and organization profile where feasible.",
          "Customers, quote records, quote links, price book records, saved settings, uploaded files, and app data associated with your account.",
          "Public quote links associated with deleted quote records."
        ]
      },
      {
        title: "Data we may retain",
        items: [
          "Limited records required for legal, tax, accounting, payment, dispute, fraud-prevention, security, backup, or compliance purposes.",
          "Payment records and connected account information held by Stripe under Stripe's own policies.",
          "Aggregated or de-identified information that no longer identifies you or your customers."
        ]
      },
      {
        title: "Timing",
        paragraphs: [
          "We aim to process verified deletion requests within 30 days unless we need more time for legal, security, payment, or verification reasons."
        ]
      }
    ]
  }
};
