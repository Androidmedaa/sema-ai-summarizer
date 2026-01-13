import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    strictPort: false, // Port 3000 meşgulse otomatik başka port seç
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
        ws: true,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.error('❌ Proxy error:', err)
          })
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('📤 Sending Request to the Target:', req.method, req.url)
          })
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('📥 Received Response from the Target:', proxyRes.statusCode, req.url)
          })
        }
      }
    }
  }
})

