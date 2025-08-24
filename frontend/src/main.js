// main.js
import { STRIPE_PK } from './config.js';

let csrfToken = '';
let currentStep = 1;

/* Utilidad: ejecutar cuando el DOM está listo, sin perder el evento
   aunque lo llames después de que haya cargado. */
function onReady(cb) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', cb, { once: true });
  } else {
    cb();
  }
}

// ======== App bootstrap ========
async function fetchCsrfToken() {
  try {
    const res = await fetch('/api/csrf-token');
    if (!res.ok) throw new Error('No se pudo obtener el token CSRF.');
    const data = await res.json();
    csrfToken = data.csrfToken;
    console.log('CSRF Token obtenido:', csrfToken);

    // Inicializa la UI de forma segura respecto al estado del DOM
    setupPageLogic();
  } catch (error) {
    console.error('Error al obtener el token CSRF:', error);
    document.body.classList.add('loading');
    alert('No se pudo cargar la aplicación. Intenta de nuevo más tarde.');
  }
}

// ======== Lógica de la página ========
function setupPageLogic() {
  onReady(() => {
    // === Variables y elementos comunes: se mueven al inicio ===
    const bookingForm = document.getElementById('bookingForm');
    const bookingSteps = document.querySelectorAll('.booking-step');
    const progressSteps = document.querySelectorAll('[data-step]');
    const wizardNav = document.getElementById('wizard-nav-buttons');
    const paySelect = document.querySelector('select[name="cPay"]');
    const paymentWrap = document.getElementById('stripe-payment-form');
    const submitBtn = document.getElementById('submit-payment');
    const termsCheck = document.getElementById('termsCheck');
    const msg = document.getElementById('payment-message');
    const bDate = document.querySelector('input[name="bDate"]');
    const quickQuoteForm = document.getElementById('quickQuoteForm');
    const estPriceEl = document.getElementById('estPrice');

    // Evita submits accidentales en cualquier botón sin type
  document.querySelectorAll('form button[data-prev], form button[data-next]').forEach(btn => {
    if (!btn.hasAttribute('type')) btn.setAttribute('type', 'button');
  });


    // --- Navegación por vistas (SPA hash + data-link) ---
    // (Esta sección no se modifica)
    const views = document.querySelectorAll('[data-view]');
    const navLinks = document.querySelectorAll('[data-link]');

    const showView = (id) => {
      if (!id) return;
      views.forEach(view => {
        view.classList.toggle('active', view.id === id);
      });
      navLinks.forEach(link => {
        const href = link.getAttribute('href') || '';
        const isActive = href.replace(/^#/, '') === id;
        link.classList.toggle('active', isActive);
      });
      if (location.hash !== `#${id}`) {
        history.pushState({ view: id }, '', `#${id}`);
      }
    };

    const initialView =
      (location.hash || '').replace(/^#/, '') ||
      (views[0] && views[0].id) || null;
    if (initialView) showView(initialView);

    window.addEventListener('popstate', () => {
      const id = (location.hash || '').replace(/^#/, '');
      if (id) showView(id);
    });

    document.body.addEventListener('click', (e) => {
      const link = e.target.closest('[data-link]');
      if (!link) return;
      const href = link.getAttribute('href') || '';
      if (!href.startsWith('#')) return;
      e.preventDefault();
      const targetId = href.substring(1);
      showView(targetId);
    });

    // === Lógica del Asistente de Reserva ===
    function updateProgress() {
      progressSteps.forEach(step => {
        const stepNum = Number(step.getAttribute('data-booking-step') || '0');
        step.classList.toggle('active', stepNum === currentStep);
        step.classList.toggle('completed', stepNum < currentStep);
      });
    }

    function showStep(step) {
      if (step < 1 || step > bookingSteps.length) return false;
      bookingSteps.forEach((s, i) => {
        s.classList.toggle('d-none', (i + 1) !== step);
      });
      currentStep = step;
      updateProgress();

      // Controla la visibilidad de los botones de navegación generales
      if (wizardNav) {
          wizardNav.classList.toggle('d-none', step === bookingSteps.length);
      }
      return true;
    }

    // ====== Navegación: enlazar TODOS los botones ======
  // Next
  document.querySelectorAll('[data-next]').forEach(btn => {
    btn.addEventListener('click', (ev) => {
      ev.preventDefault(); // por si acaso dentro de <form>
      if (validateStep(currentStep)) {
        if (currentStep < bookingSteps.length) showStep(currentStep + 1);
      }
    });
  });

  // Prev
  document.querySelectorAll('[data-prev]').forEach(btn => {
    btn.addEventListener('click', (ev) => {
      ev.preventDefault();
      if (currentStep > 1) showStep(currentStep - 1);
    });
  });

  // ====== Validación (tu misma función) ======
  function validateStep(step) {
    const stepForm = document.querySelector(`[data-booking-step="${step}"]`);
    if (!stepForm) return true;

    const inputs = stepForm.querySelectorAll('input, select, textarea');
    for (const input of inputs) {
      if (!input.checkValidity()) {
        input.reportValidity();
        return false;
      }
    }
    return true;
  }
  // ====== Selección de servicio (PASO 1): click en tarjetas ======
  const serviceCards = document.querySelectorAll('[data-service]');
  if (serviceCards.length) {
    serviceCards.forEach(card => {
      card.addEventListener('click', () => {
        // Quitar selección previa
        serviceCards.forEach(c => c.classList.remove('selected'));

        // Marcar la seleccionada
        card.classList.add('selected');

        // Guardar el servicio elegido si existe un input hidden
        const serviceValue = card.getAttribute('data-service');
        const serviceInput = document.querySelector('input[name="bService"]');
        if (serviceInput) serviceInput.value = serviceValue;

        
        // Avanzar al paso 2
        showStep(2);
        // 🔹 Dispara cotización inmediatamente
        fetchQuote();
      });
    });
  }

  // ====== Init ======
  showStep(currentStep);
  fetchQuote(); // Cotización inicial
    // ... (El resto del código de Stripe y cotización no se modifica)
    // ======== Lógica de Cotización y Pago con Stripe ========
    const stripe = Stripe(STRIPE_PK);
    let elements = null;
    let paymentElement = null;
    let currentQuote = null;
    let priceAbortCtrl = null;
    let bookingId = null;

    const SERVICE_MAP = {
      regular: 'Regular',
      deep: 'Deep',
      preparation: 'Preparation',
      movingOut: 'MovingOut',
      apartment: 'Apartment',
      office: 'Office',
    };

    const uiError = (t) => { if (msg) msg.textContent = t || ''; };
    const clearUiError = () => uiError('');

    function formatCurrency(minor, currency = 'USD', locale = navigator.language) {
      if (minor == null || isNaN(minor)) return '—';
      const value = minor / 100;
      try { return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value); }
      catch { return `${value} ${currency}`; }
    }

    function getQuotePayload() {
        let serviceCode, beds, baths, freq, zip;

        if (quickQuoteForm && !quickQuoteForm.classList.contains('hidden')) {
            serviceCode = document.querySelector('#quickQuoteForm select[name="service"]')?.value || null;
            beds  = Number(document.querySelector('#quickQuoteForm input[name="bBeds"]')?.value || '0');
            baths = Number(document.querySelector('#quickQuoteForm input[name="bBaths"]')?.value || '1');
            freq  = document.querySelector('#quickQuoteForm select[name="bFreq"]')?.value || 'Once';
            zip   = document.querySelector('#quickQuoteForm input[name="zip"]')?.value || '';
        } else {
            const activeServiceCard = document.querySelector('[data-service].selected');
            serviceCode = activeServiceCard ? activeServiceCard.getAttribute('data-service') : null;
            beds  = Number(document.querySelector('[data-booking-step="2"] input[name="bBeds"]')?.value || '0');
            baths = Number(document.querySelector('[data-booking-step="2"] input[name="bBaths"]')?.value || '1');
            freq  = document.querySelector('[data-booking-step="2"] select[name="bFreq"]')?.value || 'Once';
            zip   = document.querySelector('[data-booking-step="3"] input[name="bZip"]')?.value || '0000';
        }

        const extras = Array.from(document.querySelectorAll('[data-booking-step="2"] input[type="checkbox"]:checked')).map(i => i.value);

        if (!serviceCode ) {
            console.log('Datos de cotización incompletos: falta serviceCode.');
            return null;
        }

        return { serviceCode, beds, baths, freq, extras, zip };
    }


    function getSelectedServiceCode() {
      const active = document.querySelector('[data-service].selected');
      if (!active) return null;
      return active.getAttribute('data-service') || null;
    }

    function getExtrasUI() {
      return Array.from(document.querySelectorAll('[data-booking-step="2"] input[type="checkbox"]:checked'))
        .map(i => i.value);
    }

    function normalizeToMinor(amount) {
  if (amount == null) return null;
  let n = typeof amount === 'string' ? Number(amount) : amount;
  if (!Number.isFinite(n)) return null;

  // Heurística:
  // - Si tiene decimales → asumimos mayores (49.99) y pasamos a menores.
  // - Si es entero:
  //    * si es < 1000 y zona habitual de precios → podría ser mayores -> convierte
  //    * si es grande (>= 1000) -> ya son menores (centavos)
  if (!Number.isInteger(n)) return Math.round(n * 100);
  if (n < 1000) return n * 100;   // 49 -> $49.00
  return n;                       // 4999 -> $49.99
}

function formatCurrencyUniversal(amount, currency = 'USD', locale = navigator.language) {
  const minor = normalizeToMinor(amount);
  if (minor == null) return '—';
  const value = minor / 100;
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

function setEstimateInUI(amount, currency) {
  if (estPriceEl) estPriceEl.textContent = formatCurrencyUniversal(amount, currency || 'USD');
}


    function getBookingPayload() {
      const serviceCode = getSelectedServiceCode();
      const beds  = Number(document.querySelector('input[name="bBeds"]')?.value || '');
      const baths = Number(document.querySelector('input[name="bBaths"]')?.value || '1');
      const freq  = (document.querySelector('select[name="bFreq"]')?.value || 'Once').trim();

      const extras = getExtrasUI();

      const date    = (document.querySelector('input[name="bDate"]')?.value || '').trim();
      const time    = (document.querySelector('input[name="bTime"]')?.value || '').trim();
      const address = (document.querySelector('input[name="bAddress"]')?.value || '').trim();
      const zip     = (document.querySelector('input[name="bZip"]')?.value || '').trim();

      const name  = (document.querySelector('input[name="cName"]')?.value || '').trim();
      const email = (document.querySelector('input[name="cEmail"]')?.value || '').trim();
      const phone = (document.querySelector('input[name="cPhone"]')?.value || '').trim();


      return {
        serviceCode, beds, baths, freq, extras,
        date, time, address, zip,
        customer: { name, email, phone },
      };
    }

    let priceDebounce;
    async function fetchQuote() {
      clearTimeout(priceDebounce);
      priceDebounce = setTimeout(async () => {
        const payload = getQuotePayload();

        if (!payload) {
          console.log('Datos de cotización incompletos, no se hará la llamada a la API.');
          return;
        }

        if (priceAbortCtrl) priceAbortCtrl.abort();
        priceAbortCtrl = new AbortController();

        try {
          clearUiError();
          const res = await fetch('/api/pricing/quote', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': csrfToken,
            },
            body: JSON.stringify(payload),
            signal: priceAbortCtrl.signal,
          });
          if (!res.ok) throw new Error(await res.text() || 'Pricing service not available.');
          const data = await res.json();
          currentQuote = data;

          setEstimateInUI(data.amount, data.currency);

          const box = document.getElementById('quickQuoteResult');
          if (box) {
            box.classList.remove('d-none', 'alert');
            box.classList.add('alert-info');
             if(payload.serviceCode==='Regular'){
              payload.serviceCode='House Cleaning';
            }else{
              payload.serviceCode=`${payload.serviceCode} Cleaning`;
            }
            box.innerHTML = `
              <div><strong>Estimated price::</strong> ${formatCurrency(data.amount, data.currency)}</div>
              <div class="small text-muted">
                Service: ${payload.serviceCode} · Rooms: ${payload.beds} · Bathrooms: ${payload.baths} · Frequency: ${payload.freq}
                ${payload.extras?.length ? ' · Extras: ' + payload.extras.join(', ') : ''}
                ${payload.zip ? ' · Zip code: ' + payload.zip : ''}
              </div>
            `;
          }
        } catch (err) {
          console.error(err);
          currentQuote = null;
          const box = document.getElementById('quickQuoteResult');
          if (box) {
            box.classList.remove('d-none', 'alert-info');
            box.classList.add('alert');
            box.textContent = 'No se pudo calcular la cotización. Por favor, revisa tus datos de entrada.';
          }
          uiError('No se pudo refrescar la cotización. Intenta de nuevo.');
        }
      }, 250);
    }

    const selectorsToWatch = [
        '[data-booking-step="2"] input',
        '[data-booking-step="2"] select',
        '[data-booking-step="2"] input[type="checkbox"]',
        '[data-service]'
    ];
    selectorsToWatch.forEach(sel => {
      document.querySelectorAll(sel).forEach(node => {
        node.addEventListener('input', fetchQuote);
        node.addEventListener('change', fetchQuote);
      });
    });

    if (quickQuoteForm) {
      quickQuoteForm.addEventListener('submit', (e) => {
        e.preventDefault();
        fetchQuote();
      });
    }

    async function setupStripe() {
      if (elements && paymentElement) return;
      try {
        if (submitBtn) submitBtn.disabled = true;
        clearUiError();

        await fetchQuote();

        const booking = getBookingPayload();

        const resBooking = await fetch('/api/bookings', {
          method: 'POST',
          headers: {
            'Content-Type':'application/json',
            'X-CSRF-Token': csrfToken
          },
          body: JSON.stringify({ ...booking, quoteId: currentQuote?.quoteId || null })
        });
        if (!resBooking.ok) throw new Error(await resBooking.text() || 'No se pudo crear la reserva.');
        const created = await resBooking.json();
        bookingId = created?.id;
        if (!bookingId) throw new Error('Falta el ID de la reserva.');

        const resPI = await fetch('/stripe/create-payment-intent', {
          method: 'POST',
          headers: {
            'Content-Type':'application/json',
            'X-CSRF-Token': csrfToken
          },
          body: JSON.stringify({ bookingId })
        });
        if (!resPI.ok) throw new Error(await resPI.text() || 'No se pudo crear el PaymentIntent.');
        const { clientSecret } = await resPI.json();
        if (!clientSecret) throw new Error('Falta el clientSecret.');

        elements = stripe.elements({ clientSecret });
        paymentElement = elements.create('payment', { fields: { billingDetails: { address: 'never' } } });
        paymentElement.mount('#payment-element');

        if (submitBtn) submitBtn.disabled = !(termsCheck?.checked && !paymentWrap?.classList.contains('hidden'));
      } catch (err) {
        console.error(err);
        uiError(err.message || 'Error inicializando el pago.');
        if (submitBtn) submitBtn.disabled = true;
      }
    }

    if (paySelect) {
      paySelect.addEventListener('change', async (e) => {
        if (e.target.value === 'card') {
          const ok2 = validateStep(2);
          const ok3 = validateStep(3);
          if (!ok2 || !ok3) {
            uiError('Completa los pasos previos antes de proceder al pago.');
            if (!ok2) showStep(2); else showStep(3);
            paymentWrap?.classList.add('hidden');
            if (submitBtn) submitBtn.disabled = true;
            return;
          }
          paymentWrap?.classList.remove('hidden');
          await setupStripe();
          if (submitBtn) submitBtn.disabled = !termsCheck?.checked;
        } else {
          paymentWrap?.classList.add('hidden');
          clearUiError();
          if (submitBtn) submitBtn.disabled = true;
        }
      });
    }

    if (termsCheck && submitBtn) {
      termsCheck.addEventListener('change', () => {
        if (!paymentWrap?.classList.contains('hidden')) {
          submitBtn.disabled = !termsCheck.checked;
        }
      });
    }

    if (submitBtn) {
      submitBtn.addEventListener('click', async () => {
        if (!elements || !termsCheck?.checked) return;
        submitBtn.disabled = true;
        clearUiError();

        const { error } = await stripe.confirmPayment({
          elements,
          confirmParams: {
            return_url: `${window.location.origin}/stripe/return?booking_id=${encodeURIComponent(bookingId)}`
          }
        });

        if (error) {
          uiError(error.message || 'Error en el pago');
          submitBtn.disabled = false;
        }
      });
    }

    if (bDate) {
      const today = new Date().toISOString().split('T')[0];
      bDate.setAttribute('min', today);
    }
  });
}

// Arranque de la aplicación
fetchCsrfToken();