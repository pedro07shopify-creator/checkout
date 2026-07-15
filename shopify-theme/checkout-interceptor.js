/**
 * Cooud checkout interceptor for Shopify themes.
 *
 * What it does: intercepts clicks on "Comprar agora" (product page buy-now) and
 * "Finalizar compra" (cart) buttons, reads the current cart from Shopify's own
 * /cart.js endpoint (public, read-only), sends variant IDs + quantities to our
 * backend to get a checkout link, and redirects the buyer there instead of to
 * Shopify's native checkout.
 *
 * Only variant IDs and quantities leave the browser here — no prices are trusted
 * from the client; the backend re-fetches authoritative prices from the Shopify
 * Admin API before creating the Cooud Checkout Session.
 *
 * Install: Shopify Admin -> Online Store -> Themes -> Edit code -> layout/theme.liquid,
 * add before </body>:
 *   <script src="{{ 'checkout-interceptor.js' | asset_url }}" defer
 *           data-checkout-api="https://YOUR-BACKEND-DOMAIN"></script>
 * (upload this file under Assets first)
 */
;(function () {
  const scriptTag = document.currentScript
  const API_BASE = scriptTag?.dataset?.checkoutApi
  if (!API_BASE) {
    console.error('[cooud-checkout] Missing data-checkout-api on the script tag.')
    return
  }

  const BUY_BUTTON_SELECTORS = [
    'form[action^="/cart/add"] [type="submit"]',
    '[data-shopify="payment-button"]',
    'button[name="checkout"]',
    'a[href^="/checkout"]',
  ]

  async function getCart() {
    const response = await fetch('/cart.js', { headers: { Accept: 'application/json' } })
    if (!response.ok) throw new Error('Could not read Shopify cart')
    return response.json()
  }

  async function addCurrentFormToCart(form) {
    const formData = new FormData(form)
    const response = await fetch('/cart/add.js', {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: formData,
    })
    if (!response.ok) throw new Error('Could not add product to cart')
    return response.json()
  }

  async function redirectToCooudCheckout(items) {
    const response = await fetch(`${API_BASE}/api/cart-sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Checkout error')
    window.location.assign(data.checkout_url)
  }

  function cartItemsFromShopifyCart(cart) {
    return cart.items.map((item) => ({ variantId: String(item.variant_id), quantity: item.quantity }))
  }

  async function handleCartCheckoutClick(event) {
    event.preventDefault()
    try {
      const cart = await getCart()
      if (cart.items.length === 0) return
      await redirectToCooudCheckout(cartItemsFromShopifyCart(cart))
    } catch (error) {
      console.error('[cooud-checkout] cart checkout failed:', error)
    }
  }

  async function handleBuyNowClick(event, form) {
    event.preventDefault()
    try {
      await addCurrentFormToCart(form)
      const cart = await getCart()
      await redirectToCooudCheckout(cartItemsFromShopifyCart(cart))
    } catch (error) {
      console.error('[cooud-checkout] buy-now checkout failed:', error)
    }
  }

  function attachListeners() {
    document.querySelectorAll(BUY_BUTTON_SELECTORS.join(',')).forEach((element) => {
      if (element.dataset.cooudBound) return
      element.dataset.cooudBound = 'true'

      const form = element.closest('form[action^="/cart/add"]')
      element.addEventListener('click', (event) => {
        if (form) {
          handleBuyNowClick(event, form)
        } else {
          handleCartCheckoutClick(event)
        }
      })
    })
  }

  attachListeners()
  // Themes render buttons dynamically (AJAX cart drawers, etc.) — re-scan on DOM changes.
  new MutationObserver(attachListeners).observe(document.body, { childList: true, subtree: true })
})()
