import { Router } from 'express'
import crypto from 'node:crypto'
import { createCheckoutSession, getElementConfig } from '../lib/cooud.js'
import { attachCooudSession, getCartSession } from '../lib/store.js'
import { config } from '../config.js'

export const checkoutSessionsRouter = Router()

// Step 1 of the Cooud custom checkout contract: create the Checkout Session from
// the amounts we already verified server-side in /api/cart-sessions.
checkoutSessionsRouter.post('/api/checkout-sessions', async (req, res) => {
  try {
    const cartSessionId = String(req.body?.cart_session_id || '')
    const session = getCartSession(cartSessionId)
    if (!session) {
      res.status(404).json({ error: 'Cart session not found or expired' })
      return
    }
    if (session.status === 'paid') {
      res.status(409).json({ error: 'This order was already paid' })
      return
    }

    const lineItems = session.cartItems.map((item) => ({
      name: item.title,
      amount: item.unitAmountCents,
      currency: session.currency,
      quantity: item.quantity,
    }))

    const cooudSession = await createCheckoutSession({
      lineItems,
      customerEmail: req.body?.email || session.email,
      successUrl: `${config.checkoutPublicUrl}/success?cart_session_id=${cartSessionId}`,
      metadata: { internal_cart_session_id: cartSessionId },
      idempotencyKey: req.get('Idempotency-Key') || crypto.randomUUID(),
    })

    attachCooudSession(cartSessionId, cooudSession.id)
    res.json({ session_id: cooudSession.id })
  } catch (error) {
    res.status(error.status || 502).json({ error: error.message || 'Checkout error' })
  }
})

// Step 2: fetch the opaque tokens the browser needs to mount Cooud Elements.
// cooud_element_token / cooud_session_secret only — never a Cooud secret key.
checkoutSessionsRouter.post('/api/checkout-sessions/:id/element-config', async (req, res) => {
  try {
    const elementConfig = await getElementConfig(req.params.id, req.body?.theme)
    res.json(elementConfig)
  } catch (error) {
    res.status(error.status || 502).json({ error: error.message || 'Element config error' })
  }
})
