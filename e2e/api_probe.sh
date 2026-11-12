#!/usr/bin/env bash
# backend 공개 API probe 7항목 (감사 M14 앱 로그인 API) — 기대값과 비교해 PASS/FAIL·종료코드.
# 카카오 로그인 화면으로 가는 302 까지만 보고 실제 로그인은 하지 않는다.
# 출력의 Location 쿼리(state·client_id)는 가린다.
#
# 사용: e2e/api_probe.sh <api base>
#   예) https://climb-log.com/api (prod 공개) · http://localhost:30080 (dev backend 직접)
set -u
B=${1:?사용: api_probe.sh <api base>}
B=${B%/}
V=$(head -c 48 /dev/urandom | base64 | tr '+/' '-_' | tr -d '=\n' | cut -c1-64)
CH=$(printf '%s' "$V" | openssl dgst -sha256 -binary | openssl base64 -A | tr '+/' '-_' | tr -d '=')
pass=0; total=0

check() { # 이름, 실제값, 기대 정규식
  total=$((total + 1))
  if [[ $2 =~ $3 ]]; then pass=$((pass + 1)); echo "PASS $1  ($2)"; else echo "FAIL $1  (실제: $2 / 기대: $3)"; fi
}
loc() { curl -s -o /dev/null -w '%{http_code} %{redirect_url}' "$1" | sed -E 's/(state|client_id)=[^&]*/\1=<masked>/g' | cut -c1-80; }
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

check "웹 로그인 → 카카오 302" "$(loc "$B/auth/kakao/login")" '^302 https://kauth\.kakao\.com/'
check "앱 로그인 challenge 없음 → 422" "$(code "$B/auth/kakao/login?client=app")" '^422$'
check "앱 로그인 challenge 형식 오류 → 422" "$(code "$B/auth/kakao/login?client=app&code_challenge=short")" '^422$'
check "앱 로그인 정상 → 카카오 302" "$(loc "$B/auth/kakao/login?client=app&code_challenge=$CH")" '^302 https://kauth\.kakao\.com/'
check "가짜 코드 교환 → 401 OAUTH_APP_CODE_INVALID" \
  "$(curl -s -w ' %{http_code}' -X POST -H 'Content-Type: application/json' \
      -d "{\"code\":\"bogus\",\"code_verifier\":\"$V\"}" "$B/auth/kakao/app/exchange" | grep -o 'OAUTH_APP_CODE_INVALID\| [0-9]*$' | tr -d '\n')" \
  '^OAUTH_APP_CODE_INVALID 401$'
check "verifier 형식 오류 → 422" \
  "$(code -X POST -H 'Content-Type: application/json' -d '{"code":"x","code_verifier":"short"}' "$B/auth/kakao/app/exchange")" '^422$'
check "앱 출처(https://localhost) CORS preflight 허용" \
  "$(curl -s -o /dev/null -D - -X OPTIONS -H 'Origin: https://localhost' -H 'Access-Control-Request-Method: POST' \
      -H 'Access-Control-Request-Headers: content-type' "$B/auth/kakao/app/exchange" \
      | tr -d '\r' | grep -iE '^HTTP|^access-control-allow-origin' | tr '\n' ' ')" \
  '^HTTP/[0-9.]+ 200 .*[Aa]ccess-[Cc]ontrol-[Aa]llow-[Oo]rigin: https://localhost'

if [ "$pass" -eq "$total" ]; then echo "ALL PASS ($pass/$total)"; else echo "FAILED ($pass/$total)"; exit 1; fi
