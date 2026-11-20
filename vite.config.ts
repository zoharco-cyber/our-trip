import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// BASE_PATH מוגדר אוטומטית בפרסום ל-GitHub Pages (למשל /our-trip/)
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'הטיול שלנו',
        short_name: 'הטיול',
        description: 'כסף, רשימות, מסמכים, מפה וזיכרונות מהטיול',
        lang: 'he',
        dir: 'rtl',
        display: 'standalone',
        start_url: '.',
        background_color: '#fbf0f4',
        theme_color: '#c2185b',
        icons: [
          // הלוגו שמור באחסון של Supabase (תיקיית brand), לא בקוד
          { src: 'https://mwcbuicwdksyhjjyscil.supabase.co/storage/v1/object/public/brand/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'https://mwcbuicwdksyhjjyscil.supabase.co/storage/v1/object/public/brand/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'https://mwcbuicwdksyhjjyscil.supabase.co/storage/v1/object/public/brand/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        importScripts: ['push-sw.js'],
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
            handler: 'CacheFirst',
            options: { cacheName: 'fonts', expiration: { maxEntries: 30 } },
          },
          {
            urlPattern: /\/storage\/v1\/object\/public\/brand\//,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'brand' },
          },
          {
            urlPattern: /^https:\/\/[abc]?\.?tile\.openstreetmap\.org\//,
            handler: 'CacheFirst',
            options: { cacheName: 'map-tiles', expiration: { maxEntries: 800, maxAgeSeconds: 60 * 60 * 24 * 60 } },
          },
        ],
      },
    }),
  ],
});
