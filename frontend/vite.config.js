import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
// BACKEND_URL 환경변수:
//   Docker 내부 실행 시 → http://backend:5000 (docker-compose에서 주입)
//   로컬 직접 실행 시   → http://localhost:5000 (기본값)
const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: backendUrl,
        changeOrigin: true,
        secure: false,
      },
    },
  },
})