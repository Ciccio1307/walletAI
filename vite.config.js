import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'walletAI_logo.png',
        'logo-light.png',
        'logo-dark.png',
        'icon-192.png',
        'icon-512.png',
        'icon-maskable-512.png',
        'apple-touch-icon.png',
      ],
      manifest: {
        name: 'WalletAI',
        short_name: 'WalletAI',
        description: 'Gestisci le tue finanze con l\'AI',
        lang: 'it',
        theme_color: '#F5F2EE',
        background_color: '#F5F2EE',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Offline reads for the transaction list. The cache is cleared on
            // login/logout so it cannot leak data between accounts.
            urlPattern: ({ url }) => url.pathname.startsWith('/api/transactions'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-transactions',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Cached profile for offline reads; cleared on login/logout.
            urlPattern: ({ url }) => url.pathname === '/api/auth/me',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-user',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        // Overridable so e2e tests can run against an isolated backend.
        target: process.env.API_PROXY_TARGET || 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
