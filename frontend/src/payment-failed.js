const stripe = Stripe(window.STRIPE_PK || '');

    function fmt(minor, currency='USD', locale=navigator.language){
      return new Intl.NumberFormat(locale,{style:'currency',currency}).format(minor/100);
    }

    const params = new URLSearchParams(location.search);
    const bookingId = params.get('booking_id');
    const amount = params.get('amount');
    const currency = (params.get('currency') || 'USD').toUpperCase();
    const reason = params.get('reason');
    const errorCode = params.get('code');
    const clientSecret = params.get('payment_intent_client_secret');

    if (bookingId) document.getElementById('bookingId').textContent = bookingId;
    if (amount)    document.getElementById('amount').textContent = fmt(parseInt(amount,10), currency);
    document.getElementById('currency').textContent = currency;
    if (reason)    document.getElementById('reason').textContent = reason.replaceAll('_',' ');
    if (errorCode) document.getElementById('errorCode').textContent = errorCode;

    (async () => {
      if (!clientSecret) return;
      const { paymentIntent } = await stripe.retrievePaymentIntent(clientSecret);
      if (paymentIntent) {
        document.getElementById('piStatus').textContent = paymentIntent.status;
        if (!amount) {
          document.getElementById('amount').textContent = fmt(paymentIntent.amount, paymentIntent.currency.toUpperCase());
          document.getElementById('currency').textContent = paymentIntent.currency.toUpperCase();
        }
      }
    })();

    document.getElementById('retryBtn').addEventListener('click', () => {
      location.assign('/#booking');
    });