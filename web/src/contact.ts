export const contactEmails = {
  hello: "hello@quotevan.com",
  support: "support@quotevan.com",
  quotes: "quotes@quotevan.com"
} as const;

export function mailtoUrl(
  email: (typeof contactEmails)[keyof typeof contactEmails],
  params: {
    body?: string | undefined;
    subject?: string | undefined;
  } = {}
) {
  const query = new URLSearchParams();

  if (params.subject) {
    query.set("subject", params.subject);
  }

  if (params.body) {
    query.set("body", params.body);
  }

  const suffix = query.toString();
  return `mailto:${email}${suffix.length > 0 ? `?${suffix}` : ""}`;
}
