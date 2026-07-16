;(function () {
  const params = new URLSearchParams(window.location.search)
  const cartSessionId = params.get('id')
  const summaryEl = document.getElementById('summary')
  const formEl = document.getElementById('address-form')
  const errorEl = document.getElementById('error')
  const submitButton = document.getElementById('submit-button')

  function formatMoney(cents, currency) {
    return new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100) +
      ' ' + currency.toUpperCase()
  }

  function showError(message) {
    errorEl.textContent = message
    errorEl.hidden = !message
  }

  if (!cartSessionId) {
    summaryEl.textContent = 'Falta el identificador del pedido.'
    return
  }

  fetch(`/api/cart-sessions/${cartSessionId}`)
    .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
    .then(({ ok, data }) => {
      if (!ok) throw new Error(data.error || 'Pedido no encontrado')

      const itemsHtml = data.items
        .map((item) => `<li><span>${item.title} x${item.quantity}</span><span>${formatMoney(item.unitAmountCents * item.quantity, data.currency)}</span></li>`)
        .join('')
      summaryEl.innerHTML = `
        <ul>${itemsHtml}</ul>
        <div class="total"><span>Total</span><span>${formatMoney(data.total_amount_cents, data.currency)}</span></div>
      `
      formEl.hidden = false
    })
    .catch((error) => {
      summaryEl.textContent = ''
      showError(error.message)
    })

  formEl.addEventListener('submit', async (event) => {
    event.preventDefault()
    showError('')
    submitButton.disabled = true
    submitButton.textContent = 'Procesando...'

    const formData = new FormData(formEl)
    const email = formData.get('email')
    const address = {
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      address1: formData.get('address1'),
      address2: formData.get('address2'),
      city: formData.get('city'),
      province: formData.get('province'),
      zip: formData.get('zip'),
      phone: formData.get('phone'),
    }

    try {
      const response = await fetch(`/api/cart-sessions/${cartSessionId}/address`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, address }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Error al procesar el pedido')
      window.location.assign(data.checkout_url)
    } catch (error) {
      showError(error.message)
      submitButton.disabled = false
      submitButton.textContent = 'Continuar al pago'
    }
  })
})()
