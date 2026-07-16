import { config } from '../config.js'

// Server-to-server calls to the Cooud v2 API. cooud_sk_* never leaves this file.
async function cooudRequest(pathname, body, idempotencyKey) {
  const response = await fetch(`${config.cooud.apiUrl}${pathname}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.cooud.secretKey}`,
      'Content-Type': 'application/json',
      'Cooud-Compat-Date': config.cooud.compatDate,
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || 'Cooud API error'
    const error = new Error(message)
    error.status = response.status
    error.code = payload?.error?.code
    error.recoveryAction = payload?.error?.recovery_action
    throw error
  }
  return payload
}

/**
 * lineItems: [{ name, amount (integer, smallest currency unit), currency, quantity }]
 * All prices are re-derived server-side from Shopify (see lib/shopifyAdmin.js) — never trust
 * amounts coming from the browser.
 *
 * ui_mode "hosted": the buyer pays on a Cooud-hosted page (response.url). No card data or
 * payment UI ever touches this project, so there is no Elements/CSP surface to maintain.
 */
export async function createCheckoutSession({ lineItems, customerEmail, successUrl, metadata, idempotencyKey }) {
  const session = await cooudRequest(
    '/checkout-sessions',
    {
      ui_mode: 'hosted',
      line_items: lineItems,
      customer_email: customerEmail || undefined,
      success_url: successUrl || config.cooud.successUrl,
      cancel_url: config.cooud.cancelUrl,
      metadata,
    },
    idempotencyKey,
  )

  // Temporary workaround (confirmed by Cooud's own dev team, 2026-07-16): live-mode
  // sessions can come back with the wrong checkout host (cooud.com, which 404s) instead
  // of checkout.cooud.com. Remove once they fix it on their end.
  if (session.url?.startsWith('https://cooud.com/checkout/')) {
    session.url = session.url.replace('https://cooud.com/checkout/', 'https://checkout.cooud.com/checkout/')
  }

  return session
}
