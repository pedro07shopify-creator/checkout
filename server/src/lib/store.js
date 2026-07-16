import fs from 'node:fs'
import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// File-backed store, no native dependencies. Fine for a single-store, single-instance
// deployment; if you need to scale to multiple backend instances, swap this module
// for a real database (Postgres/Redis) — the rest of the app only calls the
// functions exported below, so that's the only file that needs to change.
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_FILE = path.join(__dirname, '..', '..', 'data.json')

function readData() {
  if (!fs.existsSync(DATA_FILE)) {
    return { cartSessions: {}, processedWebhookEvents: {} }
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
}

function writeData(data) {
  // Write to a temp file then rename: avoids a half-written data.json if the
  // process is killed mid-write.
  const tmpFile = `${DATA_FILE}.tmp`
  fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2))
  fs.renameSync(tmpFile, DATA_FILE)
}

export function createCartSession({ cartItems, totalAmountCents, currency, email }) {
  const data = readData()
  const id = crypto.randomBytes(16).toString('hex')
  data.cartSessions[id] = {
    id,
    cartItems,
    totalAmountCents,
    currency,
    email: email || null,
    cooudSessionId: null,
    status: 'pending',
    createdAt: new Date().toISOString(),
  }
  writeData(data)
  return id
}

export function getCartSession(id) {
  const data = readData()
  return data.cartSessions[id] || null
}

export function attachCooudSession(id, cooudSessionId) {
  const data = readData()
  if (!data.cartSessions[id]) return
  data.cartSessions[id].cooudSessionId = cooudSessionId
  writeData(data)
}

export function markCartSessionStatus(id, status) {
  const data = readData()
  if (!data.cartSessions[id]) return
  data.cartSessions[id].status = status
  writeData(data)
}

// Idempotency for webhook processing (Cooud delivers at-least-once).
export function isWebhookEventProcessed(eventId) {
  const data = readData()
  return !!data.processedWebhookEvents[eventId]
}

export function markWebhookEventProcessed(eventId) {
  const data = readData()
  data.processedWebhookEvents[eventId] = new Date().toISOString()
  writeData(data)
}
