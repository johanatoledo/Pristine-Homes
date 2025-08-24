// success.js
// 1. Importa la clave pública desde el archivo de configuración.
import { STRIPE_PK } from './config.js';

// 2. Espera a que el DOM esté completamente cargado para evitar errores.
document.addEventListener('DOMContentLoaded', () => {
  // La librería de Stripe (Stripe(v3)) se carga como un objeto global
  // en el HTML, por lo que podemos acceder a ella aquí.
  const stripe = Stripe(STRIPE_PK || ''); 

  function fmt(minor, currency='USD', locale=navigator.language){
    return new Intl.NumberFormat(locale,{style:'currency',currency}).format(minor/100);
  }

  const params = new URLSearchParams(location.search);
  const bookingId = params.get('booking_id');
  const amount = params.get('amount');
  const currency = (params.get('currency') || 'USD').toUpperCase();
  const clientSecret = params.get('payment_intent_client_secret');

  if (bookingId) document.getElementById('bookingId').textContent = bookingId;
  if (amount)    document.getElementById('amount').textContent = fmt(parseInt(amount,10), currency);
  document.getElementById('currency').textContent = currency;

  (async () => {
    if (!clientSecret) return;
    const { paymentIntent } = await stripe.retrievePaymentIntent(clientSecret);
    if (paymentIntent) {
      document.getElementById('piStatus').textContent = paymentIntent.status;
      document.getElementById('piId').textContent = paymentIntent.id;
      if (!amount) {
        document.getElementById('amount').textContent = fmt(paymentIntent.amount, paymentIntent.currency.toUpperCase());
        document.getElementById('currency').textContent = paymentIntent.currency.toUpperCase();
      }
    }
  })();
});
