import { config } from '../config.js'

export function corsMiddleware(req, res, next) {
  const origin = req.get('origin')
  if (origin && config.server.allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Idempotency-Key')

  if (req.method === 'OPTIONS') {
    res.sendStatus(204)
    return
  }
  next()
}
