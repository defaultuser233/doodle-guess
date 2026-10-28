import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

function productionCsp(): Plugin {
  return {
    name: 'production-csp',
    transformIndexHtml: {
      order: 'post',
      handler(html, context) {
        if (context.server) return html
        return html.replace(
          '<head>',
          `<head>
    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
        )
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    productionCsp(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'pwa-192.png',
        'pwa-512.png',
        'maskable-512.png',
        'apple-touch-icon.png',
      ],
      manifest: {
        name: '画个啥 · DoodleGuess',
        short_name: '画个啥',
        description: '水彩手绘风格的 QuickDraw 你画我猜，识别完全在本地完成。',
        lang: 'zh-CN',
        theme_color: '#FBF6EA',
        background_color: '#FBF6EA',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,bin,json,svg,png}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  base: './',
})
