import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// 새 버전 감지 (2026-11-10, 감사 M7) — 빌드마다 고유 ID 를 코드(__APP_BUILD_ID__)와
// dist/version.json 에 같이 넣는다. 열린 탭은 서버의 version.json 과 자기 ID 를 비교한다.
// Docker 빌드엔 .git 이 없어 커밋 해시 대신 빌드 시각 + 난수.
const BUILD_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

function versionJson(): Plugin {
  return {
    name: 'clog-version-json',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ buildId: BUILD_ID }),
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), versionJson()],
  define: {
    __APP_BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  server: {
    port: 5173,
    strictPort: true,  // 5173이 점유 중이면 다른 포트로 안 넘어가고 에러
    host: true,        // --host 옵션 없이도 네트워크 노출
  },
})
