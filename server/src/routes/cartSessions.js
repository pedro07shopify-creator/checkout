import { Router } from 'express'
import { buildLineItemsFromCart } from '../lib/cartMap.js'
import { createCartSession, getCartSession } from '../lib/store.js'
import { config } from '../config.js'

export const cartSessionsRouter = Router()

// Called by the Shopify theme snippet when the buyer clicks "Comprar agora" / "Finalizar compra".
// Body: { items: [{ variantId, quantity }], email? }
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

    res.json({
      cart_session_id: id,
      checkout_url: `${config.checkoutPublicUrl}/pay/${id}`,
    })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// Read-only summary for the checkout page to render the order (items, total, currency).
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
