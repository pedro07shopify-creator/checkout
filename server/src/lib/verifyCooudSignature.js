import { createHmac, timingSafeEqual } from 'node:crypto'

// Mirrors the official Cooud verification snippet: docs.cooud.com/public-doc/dev/webhooks/signatures
export function verifyCooudWebhook(payload, header, secret, toleranceSec = 300) {
  if (!header || !secret) return false
  const parts = Object.fromEntries(
    header.split(',').map((p) => {
      const i = p.indexOf('=')
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()]
    }),
  )
  const t = Number(parts.t)
  const provided = parts.v1
  if (!Number.isFinite(t) || t <= 0 || !provided) return false
  if (Math.abs(Math.floor(Date.now() / 1000) - t) > toleranceSec) return false
  if (!/^[0-9a-f]{64}$/i.test(provided)) return false

  const expected = createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex')
  const a = Buffer.from(expected, 'hex')
  const b = Buffer.from(provided, 'hex')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
