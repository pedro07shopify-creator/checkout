import express from 'express'
import { config } from './config.js'
import { corsMiddleware } from './middleware/cors.js'
import { webhooksRouter } from './routes/webhooks.js'
import { cartSessionsRouter } from './routes/cartSessions.js'
import { checkoutSessionsRouter } from './routes/checkoutSessions.js'

const app = express()
app.use(corsMiddleware)

// Mounted before express.json(): the webhook signature must be verified against the
// raw request bytes, so this route parses its own body with express.raw().
app.use(webhooksRouter)

app.use(express.json())
app.use(cartSessionsRouter)
app.use(checkoutSessionsRouter)

app.get('/health', (_req, res) => res.json({ ok: true }))

app.listen(config.server.port, () => {
  console.log(`Cooud checkout backend running on http://localhost:${config.server.port}`)
})
