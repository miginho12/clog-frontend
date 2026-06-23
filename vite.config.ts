import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,  // 5173이 점유 중이면 다른 포트로 안 넘어가고 에러
    host: true,        // --host 옵션 없이도 네트워크 노출
  },
})
