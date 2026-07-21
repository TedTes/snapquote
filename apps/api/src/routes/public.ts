import type { FastifyPluginCallback } from "fastify";
import { customerQuoteResponseSchema } from "@snapquote/shared";
import { quoteResponse, type InMemoryStore } from "../store.js";

type PublicRouteOptions = {
  store: InMemoryStore;
};

type PublicQuoteResponse = ReturnType<typeof quoteResponse>;

export const publicRoutes: FastifyPluginCallback<PublicRouteOptions> = (app, options, done) => {
  const store = options.store;

  app.get("/quotes/:token", (request, reply) => {
    try {
      const quote = store.viewPublicQuote((request.params as { token: string }).token);
      return reply.type("text/html").send(renderPublicQuoteHtml(quoteResponse(store.getState(), quote)));
    } catch (error) {
      return reply.status(404).type("text/html").send(renderErrorHtml(error));
    }
  });

  app.post("/quotes/:token/respond", (request, reply) => {
    const parsed = customerQuoteResponseSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: "invalid_request",
        issues: parsed.error.flatten()
      });
    }

    try {
      const quote = store.respondToPublicQuote(
        (request.params as { token: string }).token,
        parsed.data.action
      );

      return quoteResponse(store.getState(), quote);
    } catch (error) {
      return reply.status(409).send({
        error: "request_failed",
        message: error instanceof Error ? error.message : "Request failed"
      });
    }
  });

  done();
};

function renderPublicQuoteHtml(quote: PublicQuoteResponse): string {
  const total = quote.totals?.totalCents ?? 0;
  const customerName = quote.customer?.name ?? "Customer";
  const rows = quote.lineItems
    .map(
      (line) => `
        <tr>
          <td>${escapeHtml(line.description)}</td>
          <td>${line.quantity}</td>
          <td>${escapeHtml(line.unit ?? "")}</td>
          <td>${formatMoney(line.unitPriceCents ?? 0)}</td>
          <td>${formatMoney(Math.round(line.quantity * (line.unitPriceCents ?? 0)))}</td>
        </tr>`
    )
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Quote for ${escapeHtml(customerName)}</title>
    <style>
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f6f7f9; color: #101828; }
      main { max-width: 760px; margin: 0 auto; padding: 24px; }
      header, section { background: #fff; border: 1px solid #d0d5dd; border-radius: 8px; padding: 20px; margin-bottom: 16px; }
      h1 { margin: 0 0 8px; font-size: 28px; }
      h2 { margin: 0 0 12px; font-size: 20px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border-bottom: 1px solid #eaecf0; padding: 10px 6px; text-align: left; vertical-align: top; }
      th { color: #475467; font-size: 13px; }
      .total { font-size: 26px; font-weight: 800; text-align: right; }
      .actions { display: flex; gap: 12px; flex-wrap: wrap; }
      button { border: 0; border-radius: 8px; padding: 14px 18px; font-size: 16px; font-weight: 800; }
      .accept { background: #0f8b62; color: #fff; }
      .decline { background: #fff; color: #b42318; border: 1px solid #fda29b; }
    </style>
  </head>
  <body>
    <main>
      <header>
        <h1>${escapeHtml(quote.scopeSummary)}</h1>
        <p>Valid until ${escapeHtml(quote.validUntil)}</p>
      </header>
      <section>
        <h2>Quote</h2>
        <table>
          <thead><tr><th>Description</th><th>Qty</th><th>Unit</th><th>Unit price</th><th>Line total</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <p class="total">${formatMoney(total)}</p>
      </section>
      <section>
        <h2>Terms</h2>
        <p>${escapeHtml(quote.terms)}</p>
      </section>
      <section>
        <h2>Response</h2>
        <div class="actions">
          <button class="accept" type="button" onclick="respond('accept')">Accept</button>
          <button class="decline" type="button" onclick="respond('decline')">Decline</button>
        </div>
      </section>
    </main>
    <script>
      async function respond(action) {
        const res = await fetch(location.pathname + '/respond', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action })
        });
        if (res.ok) location.reload();
        else alert('Unable to submit response.');
      }
    </script>
  </body>
</html>`;
}

function renderErrorHtml(error: unknown): string {
  const message = error instanceof Error ? error.message : "Quote not found";

  return `<!doctype html><html lang="en"><body><h1>${escapeHtml(message)}</h1></body></html>`;
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(cents / 100);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
