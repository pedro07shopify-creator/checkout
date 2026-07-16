import { config } from '../config.js'

const graphqlUrl = () =>
  `https://${config.shopify.shopDomain}/admin/api/${config.shopify.apiVersion}/graphql.json`

async function shopifyGraphql(query, variables) {
  const response = await fetch(graphqlUrl(), {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': config.shopify.accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  })
  const payload = await response.json()
  if (!response.ok || payload.errors) {
    const message = payload.errors?.[0]?.message || `Shopify API error (${response.status})`
    throw new Error(message)
  }
  return payload.data
}

/**
 * Re-fetches authoritative price/title/currency for each variant directly from
 * Shopify. The browser only ever sends variant IDs + quantities — never a price —
 * so a tampered client request cannot change what gets charged.
 */
export async function getAuthoritativeVariants(variantIds) {
  const gids = variantIds.map((id) => `gid://shopify/ProductVariant/${id}`)
  const data = await shopifyGraphql(
    `query VariantPrices($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on ProductVariant {
          id
          title
          availableForSale
          price
          image { url }
          product { title featuredImage { url } }
        }
      }
    }`,
    { ids: gids },
  )

  return data.nodes
    .filter(Boolean)
    .map((node) => ({
      variantId: node.id.split('/').pop(),
      title: node.product?.title ? `${node.product.title} - ${node.title}` : node.title,
      price: node.price, // decimal string, e.g. "1999.00" — store currency (ARS)
      image: node.image?.url || node.product?.featuredImage?.url || null,
      availableForSale: node.availableForSale,
    }))
}

/**
 * Called from the Cooud order.paid webhook. Creates the real Shopify order so
 * inventory, reporting and fulfillment behave exactly like a native checkout order.
 */
export async function createPaidShopifyOrder({ lineItems, email, cooudOrderId, currency, totalAmount, shippingAddress }) {
  const data = await shopifyGraphql(
    `mutation OrderCreate($order: OrderCreateOrderInput!) {
      orderCreate(order: $order) {
        order { id name }
        userErrors { field message }
      }
    }`,
    {
      order: {
        currency,
        email: email || undefined,
        lineItems: lineItems.map((item) => ({
          variantId: `gid://shopify/ProductVariant/${item.variantId}`,
          quantity: item.quantity,
        })),
        financialStatus: 'PAID',
        transactions: [
          {
            kind: 'SALE',
            status: 'SUCCESS',
            amountSet: { shopMoney: { amount: totalAmount, currencyCode: currency.toUpperCase() } },
          },
        ],
        shippingAddress: shippingAddress
          ? {
              firstName: shippingAddress.firstName,
              lastName: shippingAddress.lastName,
              address1: shippingAddress.address1,
              address2: shippingAddress.address2 || undefined,
              city: shippingAddress.city,
              provinceCode: shippingAddress.province,
              zip: shippingAddress.zip,
              phone: shippingAddress.phone,
              countryCode: 'AR',
            }
          : undefined,
        note: `Pago via Cooud — cooud_order_id: ${cooudOrderId}`,
        tags: ['cooud-checkout'],
      },
    },
  )

  const result = data.orderCreate
  if (result.userErrors?.length) {
    throw new Error(result.userErrors.map((e) => e.message).join('; '))
  }
  return result.order
}
