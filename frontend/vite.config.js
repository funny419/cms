/* global process */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
// BACKEND_URL: Docker 내부 실행 시 → http://backend:5000, 로컬 직접 실행 시 → http://localhost:5000
// FILES_URL:   Docker 내부 실행 시 → http://nginx-files:80, 로컬 직접 실행 시 → http://localhost:5000
const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000'
const filesUrl = process.env.FILES_URL || 'http://localhost:5000'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    server: {
      deps: {
        inline: ['@testing-library/react'],
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: backendUrl,
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: filesUrl,
        changeOrigin: true,
        secure: false,
      },
      '/blog': {
        target: backendUrl,
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
