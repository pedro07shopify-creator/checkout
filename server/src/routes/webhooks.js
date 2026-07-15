import { Router } from 'express'
import express from 'express'
import { verifyCooudWebhook } from '../lib/verifyCooudSignature.js'
import { config } from '../config.js'
import { createPaidShopifyOrder } from '../lib/shopifyAdmin.js'
import {
  getCartSession,
  markCartSessionStatus,
  isWebhookEventProcessed,
  markWebhookEventProcessed,
} from '../lib/store.js'

export const webhooksRouter = Router()

// express.raw is required here: HMAC must be computed over the exact bytes received,
// not a re-serialized JSON object (key order/whitespace would break the signature).
webhooksRouter.post('/api/webhooks/cooud', express.raw({ type: 'application/json' }), async (req, res) => {
  const rawBody = req.body.toString('utf8')
  const signatureHeader = req.get('x-cooud-signature')

  const valid = verifyCooudWebhook(rawBody, signatureHeader, config.cooud.webhookSecret)
  if (!valid) {
    res.status(401).send('invalid signature')
    return
  }

  const event = JSON.parse(rawBody)

  // Cooud delivers at-least-once. Dedupe by event.id before doing anything with side effects.
  if (isWebhookEventProcessed(event.id)) {
    res.sendStatus(204)
    return
  }

  try {
    if (event.type === 'order.paid') {
      await handleOrderPaid(event)
    }
    // order.refunded, order.updated, etc. can be handled here as needed.
  } catch (error) {
    console.error(`[webhook] failed to process ${event.type} (${event.id}):`, error)
    // Return 200 anyway once we've validated the signature so Cooud doesn't hammer retries
    // for a bug on our side; the failure is logged for manual reconciliation.
  }

  markWebhookEventProcessed(event.id)
  res.sendStatus(204)
})

async function handleOrderPaid(event) {
  // The Order carries forward the metadata we set on the Checkout Session at creation
  // time (see routes/checkoutSessions.js), which is how we map back to our own cart.
  const cartSessionId = event.data?.metadata?.internal_cart_session_id
  const cartSession = cartSessionId ? getCartSession(cartSessionId) : null

  if (!cartSession) {
    console.warn(`[webhook] order.paid ${event.data?.id} has no matching cart session (metadata=${cartSessionId})`)
    return
  }
  if (cartSession.status === 'paid') return // already reconciled from an earlier delivery

  await createPaidShopifyOrder({
    lineItems: cartSession.cartItems.map((item) => ({ variantId: item.variantId, quantity: item.quantity })),
    email: event.data?.email || cartSession.email,
    cooudOrderId: event.data?.id,
    currency: cartSession.currency,
    totalAmount: (cartSession.totalAmountCents / 100).toFixed(2),
  })

  markCartSessionStatus(cartSession.id, 'paid')
}
