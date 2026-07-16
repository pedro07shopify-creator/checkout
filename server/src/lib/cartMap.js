import { getAuthoritativeVariants } from './shopifyAdmin.js'

/**
 * Builds Cooud `line_items` (integer cents) from a Shopify cart, re-pricing every
 * variant against the Shopify Admin API so the browser can never dictate what the
 * customer is charged.
 *
 * requestedItems: [{ variantId: string, quantity: number }]
 */
export async function buildLineItemsFromCart(requestedItems, { currency = 'ars' } = {}) {
  if (!Array.isArray(requestedItems) || requestedItems.length === 0) {
    throw new Error('Cart is empty')
  }

  const quantityByVariant = new Map()
  for (const item of requestedItems) {
    const variantId = String(item.variantId || '').trim()
    const quantity = Math.trunc(Number(item.quantity))
    if (!variantId || !Number.isFinite(quantity) || quantity < 1 || quantity > 50) {
      throw new Error(`Invalid cart item: ${JSON.stringify(item)}`)
    }
    quantityByVariant.set(variantId, (quantityByVariant.get(variantId) || 0) + quantity)
  }

  const variants = await getAuthoritativeVariants([...quantityByVariant.keys()])
  const foundIds = new Set(variants.map((v) => v.variantId))
  const missing = [...quantityByVariant.keys()].filter((id) => !foundIds.has(id))
  if (missing.length) {
    throw new Error(`Variant(s) not found in Shopify: ${missing.join(', ')}`)
  }

  const cartItems = []
  const lineItems = []

  for (const variant of variants) {
    if (!variant.availableForSale) {
      throw new Error(`"${variant.title}" is no longer available for sale`)
    }
    const quantity = quantityByVariant.get(variant.variantId)
    const unitAmountCents = toMinorUnits(variant.price)

    cartItems.push({
      variantId: variant.variantId,
      title: variant.title,
      image: variant.image,
      quantity,
      unitAmountCents,
    })

    lineItems.push({
      // Cooud rejects line_items[].name over 120 chars (confirmed empirically —
      // undocumented limit). Shopify product titles routinely exceed that.
      name: truncateName(variant.title, 120),
      amount: unitAmountCents,
      currency,
      quantity,
    })
  }

  const totalAmountCents = cartItems.reduce((sum, item) => sum + item.unitAmountCents * item.quantity, 0)

  return { cartItems, lineItems, totalAmountCents, currency }
}

// Shopify GraphQL returns price as a decimal string ("1999.00"); Cooud wants integer minor units.
function toMinorUnits(decimalPriceString) {
  const [whole, fraction = ''] = String(decimalPriceString).split('.')
  const cents = (fraction + '00').slice(0, 2)
  return Number(whole) * 100 + Number(cents)
}

function truncateName(name, maxLength) {
  if (name.length <= maxLength) return name
  return `${name.slice(0, maxLength - 1)}…`
}
