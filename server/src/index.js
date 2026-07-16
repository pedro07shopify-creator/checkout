import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from './config.js'
import { corsMiddleware } from './middleware/cors.js'
import { webhooksRouter } from './routes/webhooks.js'
import { cartSessionsRouter } from './routes/cartSessions.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
app.use(corsMiddleware)

// Mounted before express.json(): the webhook signature must be verified against the
// raw request bytes, so this route parses its own body with express.raw().
app.use(webhooksRouter)

app.use(express.json())
app.use(cartSessionsRouter)
// The address-collection page (checkout.html/.js) — plain HTML, no build step.
app.use(express.static(path.join(__dirname, '..', 'public')))

app.get('/health', (_req, res) => res.json({ ok: true }))

app.listen(config.server.port, () => {
  console.log(`Cooud checkout backend running on http://localhost:${config.server.port}`)
})
