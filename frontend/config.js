  window.APP_CONFIG = {
      STRIPE_PK: import.meta.env.VITE_STRIPE_PK ?? (window.APP_CONFIG?.STRIPE_PK ?? 'pk_test_REEMPLAZA'),
      API_BASE:  import.meta.env.VITE_API_BASE  ?? (window.APP_CONFIG?.API_BASE  ?? 'http://localhost:4000')
    };