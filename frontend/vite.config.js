// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: 'index.html',
        success: 'success.html',
        paymentFailed: 'payment-failed.html'
      }
    }
  },
  server: {
    port: 5173,
    open: true,
    // Configuración del proxy
    proxy: {
      '/api': {
        target: 'http://localhost:4000', // La URL de tu servidor backend
        changeOrigin: true,
        secure: false,
        ws: true,
      },
      // Si tienes un endpoint para Stripe, también necesitas un proxy
      '/stripe': {
        target: 'http://localhost:4000', // La URL de tu servidor backend
        changeOrigin: true,
        secure: false,
        ws: true,
      }
    }
  },
});
