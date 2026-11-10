import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// 새 버전 감지 (2026-11-10, 감사 M7) — 빌드 ID 를 코드(__APP_BUILD_ID__)와 dist/version.json 에
// 같이 넣는다. 열린 탭은 서버의 version.json 과 자기 ID 를 비교한다.
// 빌드 ID = 커밋 SHA 7자리(CI 가 GIT_SHA build-arg 로 전달) → 이미지 태그 sha-xxxxxxx 와 같은 값이라
// 화면·서버·gitops 배포 기록을 한 ID 로 추적. Docker 빌드엔 .git 이 없어 env 로 받는다.
// 로컬·모바일 빌드처럼 GIT_SHA 가 없으면 local-<빌드 시각>.
const GIT_SHA = (process.env.GIT_SHA ?? '').trim()
const BUILT_AT = new Date().toISOString()
const BUILD_ID = GIT_SHA ? GIT_SHA.slice(0, 7) : `local-${Date.now().toString(36)}`

function versionJson(): Plugin {
  return {
    name: 'clog-version-json',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ buildId: BUILD_ID, commit: GIT_SHA || null, builtAt: BUILT_AT }),
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
