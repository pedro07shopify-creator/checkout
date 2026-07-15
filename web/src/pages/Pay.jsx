import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../lib/api'

function formatArs(cents) {
  return new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100)
}

function waitForCooudElements() {
  return new Promise((resolve, reject) => {
    let attempts = 0
    const interval = setInterval(() => {
      if (window.__CooudElements__) {
        clearInterval(interval)
        resolve(window.__CooudElements__)
      } else if (++attempts > 80) {
        clearInterval(interval)
        reject(new Error('Cooud Elements no cargó. Verifica el CDN/CSP.'))
      }
    }, 50)
  })
}

export function Pay() {
  const { cartSessionId } = useParams()
  const [cart, setCart] = useState(null)
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | mounted | error
  const [error, setError] = useState('')
  const paymentElementRef = useRef(null)

  useEffect(() => {
    api
      .getCartSession(cartSessionId)
      .then(setCart)
      .catch((err) => setError(err.message))
  }, [cartSessionId])

  async function startPayment(event) {
    event.preventDefault()
    setStatus('loading')
    setError('')
    try {
      const session = await api.createCheckoutSession(cartSessionId, email)
      const elementConfig = await api.getElementConfig(session.session_id)
      const cooud = await waitForCooudElements()

      cooud.mount({
        container: paymentElementRef.current,
        sessionId: session.session_id,
        elementToken: elementConfig.cooud_element_token,
        sessionSecret: elementConfig.cooud_session_secret,
        appearance: elementConfig.element?.appearance,
        apiBaseUrl: 'https://api.cooud.com',
        onSuccess: () => {
          window.location.assign(`/success?cart_session_id=${cartSessionId}`)
        },
        onError: (err) => {
          setError(err?.message || 'Pago rechazado.')
          setStatus('mounted')
        },
      })
      setStatus('mounted')
    } catch (err) {
      setError(err.message)
      setStatus('error')
    }
  }

  if (error && !cart) {
    return <main className="page"><p className="error">{error}</p></main>
  }
  if (!cart) {
    return <main className="page"><p>Cargando...</p></main>
  }

  return (
    <main className="page">
      <section className="summary">
        <h1>Resumen del pedido</h1>
        <ul>
          {cart.items.map((item) => (
            <li key={item.variantId}>
              <span>{item.title} x{item.quantity}</span>
              <span>ARS $ {formatArs(item.unitAmountCents * item.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="total">
          <span>Total</span>
          <span>ARS $ {formatArs(cart.total_amount_cents)}</span>
        </div>
      </section>

      {status !== 'mounted' && (
        <form onSubmit={startPayment} className="pay-form">
          <label>
            Correo electrónico
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <button type="submit" disabled={status === 'loading'}>
            {status === 'loading' ? 'Procesando...' : 'Continuar al pago'}
          </button>
        </form>
      )}

      {error && <p className="error">{error}</p>}
      <div id="payment-element" ref={paymentElementRef} />
    </main>
  )
}
