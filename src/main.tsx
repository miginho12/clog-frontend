import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { reloadOnceForNewVersion } from './lib/chunkReload'

// 지연 로드 청크가 함께 받는 CSS·의존 청크의 사전 로드 실패(배포 직후 옛 해시 404) — 감사 M6.
// 한 번 새로고침해 새 버전을 받는다. 루프 방지에 걸리면 기본 동작(에러 전파 → ErrorBoundary).
window.addEventListener('vite:preloadError', (event) => {
  if (reloadOnceForNewVersion()) event.preventDefault()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
