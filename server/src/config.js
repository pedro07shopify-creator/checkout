import 'dotenv/config'

function required(name, value) {
  if (!value) {
    console.warn(`[config] ${name} is not set — related endpoints will fail until it is configured.`)
  }
  return value
}

export const config = {
  cooud: {
    secretKey: required('COOUD_SECRET_KEY', process.env.COOUD_SECRET_KEY || ''),
    apiUrl: (process.env.COOUD_API_URL || 'https://api.cooud.com/v2').replace(/\/+$/, ''),
    compatDate: process.env.COOUD_COMPAT_DATE || '2026-09-01',
    webhookSecret: required('COOUD_WEBHOOK_SECRET', process.env.COOUD_WEBHOOK_SECRET || ''),
    successUrl: process.env.COOUD_SUCCESS_URL || 'http://localhost:3010/success.html',
    cancelUrl: process.env.COOUD_CANCEL_URL || 'https://meli-respuestas.com/cart',
  },
  shopify: {
    shopDomain: required('SHOPIFY_SHOP_DOMAIN', process.env.SHOPIFY_SHOP_DOMAIN || ''),
    accessToken: required('SHOPIFY_ADMIN_ACCESS_TOKEN', process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || ''),
    apiVersion: process.env.SHOPIFY_API_VERSION || '2025-01',
  },
  server: {
    port: Number(process.env.PORT || 3010),
    allowedOrigins: (process.env.ALLOWED_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean),
  },
}
