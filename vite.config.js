import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// 127.0.0.1 (e não localhost): a API escuta só em IPv4 local por padrão.
const apiTarget = process.env.VITE_API_PROXY ?? 'http://127.0.0.1:3333'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Se a 5173 estiver ocupada, o Vite usa a próxima porta livre.
    strictPort: false,
    // Mesma origem no navegador: cookies de sessão funcionam sem CORS.
    proxy: {
      '/api': { target: apiTarget, changeOrigin: false },
      '/uploads': { target: apiTarget, changeOrigin: false },
    },
  },
  preview: {
    proxy: {
      '/api': { target: apiTarget, changeOrigin: false },
      '/uploads': { target: apiTarget, changeOrigin: false },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{js,jsx}'],
    setupFiles: ['./src/test/setup.js'],
  },
})
