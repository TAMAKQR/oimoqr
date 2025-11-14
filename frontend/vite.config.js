import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'OimoQR - QR Меню для Ресторанов',
        short_name: 'OimoQR',
        description: 'Современное и удобное QR-меню для вашего ресторана, кафе или бара.',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      // Все запросы, начинающиеся с /uploads, будут перенаправлены на бэкенд
      '/uploads': {
        target: 'http://localhost:5001', // Адрес твоего бэкенда
        changeOrigin: true,
      },
    }
  }
});