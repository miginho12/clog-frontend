#!/usr/bin/env bash
# 롤아웃 중 무중단 측정 (감사 M9 에서 시작) — URL 들을 계속 호출하면서 주어진 명령(ArgoCD sync·
# rollout restart 등)을 실행하고, Deployment 가 새로 바뀌어 롤아웃이 끝날 때까지 기다린 뒤 응답 코드 분포.
# 200 이 아닌 응답이 하나라도 있으면 종료코드 1.
#
# 사용: e2e/rollout_probe.sh <ns> <deploy> <초> [URL...] -- <명령...>
#   URL 을 생략하면 공개 URL 2개: $BASE/ (frontend), $BASE/api/health/ready (backend) — BASE 기본 https://climb-log.com
#   ⚠ 공개 /health/ready 는 frontend SPA 가 200 으로 받는다 → backend 는 반드시 /api/health/ready (2026-11-12 실수)
#   예) backend prod 승격 — 공개 URL + Service 직결(Cloudflare·nginx 를 빼고 backend 만):
#     e2e/rollout_probe.sh prod clog-prod 240 https://climb-log.com/api/health/ready http://localhost:30082/health/ready \
#       -- kubectl -n argocd patch application clog-prod --type merge -p '{"operation":{"sync":{"revision":"<sha>"}}}'
#   예) frontend dev 재시작: e2e/rollout_probe.sh dev clog-frontend-dev 60 http://localhost:30081/ -- kubectl -n dev rollout restart deploy/clog-frontend-dev
set -u
NS=$1; DEP=$2; DUR=$3; shift 3
URLS=()
while [ $# -gt 0 ] && [ "$1" != "--" ]; do URLS+=("$1"); shift; done
[ "${1:-}" = "--" ] || { echo "사용: rollout_probe.sh <ns> <deploy> <초> [URL...] -- <명령...>" >&2; exit 2; }
shift
BASE=${BASE:-https://climb-log.com}
[ ${#URLS[@]} -gt 0 ] || URLS=("$BASE/" "$BASE/api/health/ready")
DIR=$(mktemp -d)
trap 'rm -rf "$DIR"' EXIT

probe() { # URL, 출력 파일 — 0.2초 간격, 타임아웃 3초(000 = 응답 없음)
  local end=$((SECONDS + DUR))
  while [ $SECONDS -lt $end ]; do curl -s -o /dev/null -m 3 -w '%{http_code}\n' "$1" >> "$2"; sleep 0.2; done
}
pids=()
for i in "${!URLS[@]}"; do probe "${URLS[$i]}" "$DIR/$i" & pids+=($!); done

sleep 3
GEN=$(kubectl -n "$NS" get deploy "$DEP" -o jsonpath='{.metadata.generation}')
"$@" > /dev/null || { echo "명령 실패: $*" >&2; }
# 이미지 변경·restart 모두 generation 을 올린다 → 바뀐 뒤 롤아웃 완료 대기(바로 rollout status 를 부르면
# sync 가 반영되기 전 옛 상태로 '완료'가 나온다 — 2026-11-12 실측)
changed=0
for _ in $(seq 1 60); do
  [ "$(kubectl -n "$NS" get deploy "$DEP" -o jsonpath='{.metadata.generation}')" != "$GEN" ] && { changed=1; break; }
  sleep 1
done
if [ $changed -eq 1 ]; then
  kubectl -n "$NS" rollout status deploy/"$DEP" --timeout=300s > /dev/null && echo "롤아웃 완료: $NS/$DEP"
else
  echo "⚠ 60초 안에 $NS/$DEP 가 바뀌지 않음 — 명령이 반영됐는지 확인 (측정은 계속)"
fi
wait "${pids[@]}"

fail=0
for i in "${!URLS[@]}"; do
  dist=$(sort "$DIR/$i" | uniq -c | awk '{printf "%s×%s ", $2, $1}')
  n=$(wc -l < "$DIR/$i"); ok=$(grep -c '^200$' "$DIR/$i")
  echo "${URLS[$i]} — 요청 ${n}회: ${dist}"
  [ "$ok" -eq "$n" ] || fail=1
done
[ $fail -eq 0 ] && echo "ALL PASS (모든 응답 200)" || { echo "FAILED (200 아닌 응답 있음)"; exit 1; }
