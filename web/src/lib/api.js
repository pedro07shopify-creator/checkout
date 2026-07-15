const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3010'

async function request(path, options) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`)
  return data
}

export const api = {
  getCartSession: (id) => request(`/api/cart-sessions/${id}`),
  createCheckoutSession: (cartSessionId, email) =>
    request('/api/checkout-sessions', {
      method: 'POST',
      body: JSON.stringify({ cart_session_id: cartSessionId, email }),
    }),
  getElementConfig: (sessionId, theme = 'auto') =>
    request(`/api/checkout-sessions/${sessionId}/element-config`, {
      method: 'POST',
      body: JSON.stringify({ theme }),
    }),
}
