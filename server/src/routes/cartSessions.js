import { Router } from 'express'
import crypto from 'node:crypto'
import { buildLineItemsFromCart } from '../lib/cartMap.js'
import { createCheckoutSession } from '../lib/cooud.js'
import { createCartSession, getCartSession, attachCooudSession, attachShippingDetails } from '../lib/store.js'
import { config } from '../config.js'

export const cartSessionsRouter = Router()

const REQUIRED_ADDRESS_FIELDS = ['firstName', 'lastName', 'address1', 'city', 'province', 'zip', 'phone']

// Called by the Shopify theme snippet when the buyer clicks "Comprar agora" / "Finalizar compra".
// Body: { items: [{ variantId, quantity }], email? }
// Response: { checkout_url } — our own short address-collection page. Cooud's v2 hosted
// checkout does not yet collect shipping_address (see docs.cooud.com/.../use-cases/ecommerce),
// so we collect it here first and pass it along as metadata when we create the Cooud session.
cartSessionsRouter.post('/api/cart-sessions', async (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : []
    const { cartItems, totalAmountCents, currency } = await buildLineItemsFromCart(items)

    const id = createCartSession({
      cartItems,
      totalAmountCents,
      currency,
      email: req.body?.email,
    })

    res.json({ checkout_url: `${config.checkoutPublicUrl}/checkout.html?id=${id}` })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// Read-only summary for the address-collection page to render the order.
cartSessionsRouter.get('/api/cart-sessions/:id', (req, res) => {
  const session = getCartSession(req.params.id)
  if (!session) {
    res.status(404).json({ error: 'Session not found or expired' })
    return
  }
  res.json({
    cart_session_id: session.id,
    items: session.cartItems,
    total_amount_cents: session.totalAmountCents,
    currency: session.currency,
    status: session.status,
  })
})

// Submits the shipping address, then creates the Cooud Checkout Session and returns
// the Cooud-hosted payment URL to redirect the buyer to.
cartSessionsRouter.post('/api/cart-sessions/:id/address', async (req, res) => {
  try {
    const cartSessionId = req.params.id
    const session = getCartSession(cartSessionId)
    if (!session) {
      res.status(404).json({ error: 'Session not found or expired' })
      return
    }
    if (session.status === 'paid') {
      res.status(409).json({ error: 'This order was already paid' })
      return
    }

    const address = req.body?.address || {}
    for (const field of REQUIRED_ADDRESS_FIELDS) {
      if (!String(address[field] || '').trim()) {
        res.status(400).json({ error: `Missing address field: ${field}` })
        return
      }
    }
    const email = String(req.body?.email || '').trim()
    if (!email) {
      res.status(400).json({ error: 'Missing email' })
      return
    }

    const shippingAddress = {
      firstName: String(address.firstName).trim(),
      lastName: String(address.lastName).trim(),
      address1: String(address.address1).trim(),
      address2: String(address.address2 || '').trim(),
      city: String(address.city).trim(),
      province: String(address.province).trim(),
      zip: String(address.zip).trim(),
      phone: String(address.phone).trim(),
    }
    attachShippingDetails(cartSessionId, { email, shippingAddress })

    const lineItems = session.cartItems.map((item) => ({
      name: item.title,
      amount: item.unitAmountCents,
      currency: session.currency,
      quantity: item.quantity,
    }))

    const cooudSession = await createCheckoutSession({
      lineItems,
      customerEmail: email,
      metadata: {
        internal_cart_session_id: cartSessionId,
        // Compact JSON keeps this well under the 500-char metadata value limit.
        shipping_address_json: JSON.stringify(shippingAddress),
      },
      idempotencyKey: req.get('Idempotency-Key') || crypto.randomUUID(),
    })

    attachCooudSession(cartSessionId, cooudSession.id)
    res.json({ checkout_url: cooudSession.url })
  } catch (error) {
    res.status(error.status || 502).json({ error: error.message || 'Checkout error' })
  }
})
