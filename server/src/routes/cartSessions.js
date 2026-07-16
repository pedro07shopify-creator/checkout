import { Router } from 'express'
import crypto from 'node:crypto'
import { buildLineItemsFromCart } from '../lib/cartMap.js'
import { createCheckoutSession } from '../lib/cooud.js'
import { createCartSession, attachCooudSession } from '../lib/store.js'

export const cartSessionsRouter = Router()

// Called by the Shopify theme snippet when the buyer clicks "Comprar agora" / "Finalizar compra".
// Body: { items: [{ variantId, quantity }], email? }
// Response: { checkout_url } — redirects straight to the Cooud-hosted payment page.
cartSessionsRouter.post('/api/cart-sessions', async (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : []
    const { cartItems, lineItems, totalAmountCents, currency } = await buildLineItemsFromCart(items)

    const cartSessionId = createCartSession({
      cartItems,
      totalAmountCents,
      currency,
      email: req.body?.email,
    })

    const cooudSession = await createCheckoutSession({
      lineItems,
      customerEmail: req.body?.email,
      metadata: { internal_cart_session_id: cartSessionId },
      idempotencyKey: req.get('Idempotency-Key') || crypto.randomUUID(),
    })

    attachCooudSession(cartSessionId, cooudSession.id)
    res.json({ checkout_url: cooudSession.url })
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message })
  }
})
