# e2e — 실제 환경·빌드에 붙여 돌리는 점검

단위 테스트(`npm test`, Vitest)는 CI 에서 돌고, 여기 있는 것은 **dev·prod 실환경 또는 로컬 빌드**가 필요해 CI 에서 돌리지 않는다.
배포(특히 prod 승격) 때 손으로 돌린다. 모두 항목별 `PASS`/`FAIL` 을 출력하고 마지막 줄이 `ALL PASS (n/n)`, 실패하면 종료코드 1.
로그인하지 않거나 가짜 API 를 써서 **실제 데이터를 바꾸지 않는다** (카카오는 로그인 화면으로 가는 302 까지만).

감사(2026-11) 작업 중 임시로 쓰던 스크립트를 L2(2026-11-12)에 옮기면서 정리했다.

## 준비

```bash
# Python 은 uv 로 일회성 실행 — 저장소에 Python 의존성을 두지 않는다
uv run --no-project --with playwright python -m playwright install chromium-headless-shell
# 이미 받은 브라우저를 쓰려면(예: Pi arm64) 실행 파일 경로를 준다
export CLOG_CHROMIUM=~/.cache/ms-playwright/chromium_headless_shell-1228/chrome-linux/headless_shell
alias e2epy='uv run -q --no-project --with playwright python'
```

## 스크립트

| 파일 | 항목 | 대상 | 사용 |
|---|---|---|---|
| `smoke.py` | 6 — 첫 로딩 메인 번들만·탭 페이지 프리로드·피드 오류 없음·`/signup` 지연 로드·자산 4xx/5xx 없음·JS 예외 없음 | 배포된 frontend | `e2epy e2e/smoke.py https://climb-log.com` |
| `kakao_web.py` | 4 — 웹 카카오 링크 그대로·앱 전용 버튼 없음·링크 → 카카오 302·페이지 오류 없음 | 배포된 frontend | `e2epy e2e/kakao_web.py https://climb-log.com` |
| `api_probe.sh` | 7 — 카카오 로그인 302(웹·앱)·PKCE challenge/verifier 검증 422·가짜 코드 401·앱 출처 CORS | 배포된 backend API | `e2e/api_probe.sh https://climb-log.com/api` |
| `app_login.py` | 17 — 앱 카카오 로그인(실제 Capacitor native-bridge + 가짜 Android 브리지·가짜 API): 시스템 브라우저 열기·PKCE·복귀 교환·중복/만료/실패·콜드 스타트 + 웹 회귀 2 | 로컬 웹 빌드 | `npm run build && e2epy e2e/app_login.py` |
| `csp_enforce.py` | 5 — nginx `security-headers.conf` 의 CSP 를 **강제**로 붙여 탭 순회: 위반 0·화면 전환용 빈 `<style>` 실행·막히지 않음·페이지 오류 없음·카카오 프로필 https 허용·http 차단 | 로컬 웹 빌드 | `npm run build && e2epy e2e/csp_enforce.py` |
| `rollout_probe.sh` | 롤아웃 중 응답 코드 분포, 200 아닌 응답이 있으면 실패 | 실행 중 환경 + kubectl | 아래 |

- dev 주소: frontend `http://localhost:30081`, backend `http://localhost:30080` (prod Service 직결은 `http://localhost:30082`)
- `api_probe.sh` 를 dev backend 에 돌리면 7번(CORS)만 실패한다 — dev 의 `CORS_ORIGINS`(gitops `values-dev.yaml`)에 앱 출처
  `https://localhost` 가 없다. 앱은 prod API 만 부르므로 현재는 정상(prod 는 기본값에 포함).
- `csp_enforce.py` 는 framer-motion·React 를 올리거나 CSP 를 고칠 때 돌린다. `CSP_OVERRIDE='<정책>'` 로 대조 실험
  (빈 해시를 뺀 정책은 C1·C3 이 실패해야 정상 — 2026-11-12 확인).
- `app_login.py` 는 **웹 빌드**로 돌린다. `build:mobile` 은 API 주소가 절대 경로라 W1(웹 링크 상대 경로)만 실패한다.

### rollout_probe.sh — 무중단 확인

```bash
# 사용: e2e/rollout_probe.sh <ns> <deploy> <초> [URL...] -- <명령...>
# URL 생략 시 공개 URL 2개($BASE/, $BASE/api/health/ready, BASE 기본 https://climb-log.com)

# backend prod 승격: 공개 URL + Service 직결(Cloudflare·nginx 를 뺀 backend 자체)
e2e/rollout_probe.sh prod clog-prod 240 https://climb-log.com/api/health/ready http://localhost:30082/health/ready \
  -- kubectl -n argocd patch application clog-prod --type merge -p '{"operation":{"sync":{"revision":"<gitops sha>"}}}'
```

- ⚠ 공개 `https://climb-log.com/health/ready` 는 **frontend SPA 가 200 으로 받는다** — backend 는 반드시 `/api/health/ready`.
- 명령 뒤 Deployment `generation` 이 바뀔 때까지 기다린 다음 `rollout status` 를 본다
  (ArgoCD sync 직후 바로 `rollout status` 를 부르면 반영 전 옛 상태로 "완료"가 나온다).

## prod 승격 체크리스트

1. dev: `smoke.py http://localhost:30081` · (backend 변경 시) `api_probe.sh http://localhost:30080` — 7번 CORS 제외
2. gitops `values-prod.yaml` 태그 변경·push
3. `rollout_probe.sh` 로 sync 하며 측정 → `ALL PASS`
4. prod: `smoke.py https://climb-log.com` · `kakao_web.py https://climb-log.com` · `api_probe.sh https://climb-log.com/api`
5. 로그 ERROR 0 (backend: `kubectl -n prod logs deploy/clog-prod --since=5m | grep -c ERROR`)

## 옮기지 않은 것 (2026-11-12)

| 예전 스크립트 | 이유 · 대체 |
|---|---|
| M6 코드 분할·ErrorBoundary 로컬 검사 | 손으로 고친 빌드(옛 청크 삭제·렌더 오류 주입)가 필요했고 남아 있지 않음 → 로직은 `src/lib/chunkReload.test.ts`, 배포 확인은 `smoke.py` |
| M7 새 버전 배너 로컬 검사 | 빌드 3개(버전 a/b/c)와 번들 해시가 하드코딩돼 재현 불가 → 로직은 `src/lib/versionCheck.test.ts` |
| M1·M2 dev Pod 안 JWT·refresh 회전 probe | backend 코드를 import 하는 Pod 내부 스크립트 → backend `scripts/verify_jwt_security.py`·`verify_refresh_rotation.py` 가 CI 에서 확인 |
