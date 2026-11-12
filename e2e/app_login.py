"""앱 카카오 로그인 17항목 (감사 M14) — 실제 Android native-bridge.js + 가짜 androidBridge 로 앱을 흉내낸다.

시스템 브라우저 열기(Browser.open) → 커스텀 스킴 복귀(appUrlOpen) → 일회용 코드+PKCE verifier 교환 흐름,
교환 실패·만료·중복 코드·콜드 스타트(getLaunchUrl)와 웹 회귀(W1·W2)를 확인한다.
API 는 Playwright 가 가로채 가짜로 응답한다 → 서버·카카오 없이 로컬 빌드만으로 돈다.

사용: npm run build && uv run --no-project --with playwright python e2e/app_login.py [dist] [native-bridge.js]
  기본값: dist, node_modules/@capacitor/android/capacitor/src/main/assets/native-bridge.js
  ⚠ 웹 빌드(npm run build)로 돌린다 — build:mobile 은 API 주소가 https://climb-log.com/api(절대)라
    W1(웹 링크는 상대 경로 /api/...)만 실패한다(가짜 API 가로채기 **/api/** 는 호스트 무관이라 실서버 호출은 없음).
"""

import base64
import hashlib
import http.server
import json
import os
import socketserver
import sys
import threading
from urllib.parse import parse_qs, urlparse

from _common import check, finish, launch
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(ROOT, "dist")
BRIDGE_PATH = sys.argv[2] if len(sys.argv) > 2 else os.path.join(
    ROOT, "node_modules/@capacitor/android/capacitor/src/main/assets/native-bridge.js"
)
if not os.path.isfile(os.path.join(DIST, "index.html")):
    sys.exit(f"빌드 없음: {DIST}/index.html — 먼저 npm run build:mobile")
BRIDGE = open(BRIDGE_PATH).read()


class SPA(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def translate_path(self, path):
        rel = path.split("?")[0].lstrip("/")
        full = os.path.join(DIST, rel)
        if not os.path.isfile(full) and not rel.startswith("assets/"):
            full = os.path.join(DIST, "index.html")
        return full

socketserver.ThreadingTCPServer.allow_reuse_address = True
srv = socketserver.ThreadingTCPServer(("127.0.0.1", 4391), SPA); srv.daemon_threads = True
threading.Thread(target=srv.serve_forever, daemon=True).start()
B = "http://127.0.0.1:4391"

FAKE = """
window.__calls = []; window.__listeners = []; window.__launchUrl = null;
window.Capacitor = { PluginHeaders: [
  { name: 'App', methods: [{name:'getLaunchUrl', rtype:'promise'}, {name:'addListener', rtype:'callback'}, {name:'removeListener', rtype:'promise'}, {name:'removeAllListeners', rtype:'promise'}] },
  { name: 'Browser', methods: [{name:'open', rtype:'promise'}, {name:'close', rtype:'promise'}, {name:'addListener', rtype:'callback'}, {name:'removeListener', rtype:'promise'}, {name:'removeAllListeners', rtype:'promise'}] },
]};
window.androidBridge = { postMessage(s) {
  const d = JSON.parse(s); window.__calls.push(d);
  if (d.methodName === 'addListener') { window.__listeners.push({p: d.pluginId, e: d.options.eventName, id: d.callbackId}); return; }
  if (d.callbackId === '-1') return;
  const data = (d.pluginId === 'App' && d.methodName === 'getLaunchUrl') ? (window.__launchUrl ? {url: window.__launchUrl} : {}) : {};
  setTimeout(() => window.Capacitor.fromNative({callbackId: d.callbackId, pluginId: d.pluginId, methodName: d.methodName, success: true, data}), 0);
}};
window.__emit = (p, e, data) => { for (const l of window.__listeners) if (l.p === p && l.e === e)
  window.Capacitor.fromNative({callbackId: l.id, pluginId: p, methodName: 'addListener', success: true, data, save: true}); };
"""

def s256(v): return base64.urlsafe_b64encode(hashlib.sha256(v.encode()).digest()).rstrip(b"=").decode()

with sync_playwright() as p:
    b = launch(p)

    # ── 웹 회귀 ──
    pg = b.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(f"{B}/login", wait_until="networkidle")
    a = pg.locator("a", has_text="카카오로 시작하기")
    check("W1 웹: 카카오는 기존 링크 그대로", a.count() == 1 and a.get_attribute("href") == "/api/auth/kakao/login", a.get_attribute("href") if a.count() else "없음")
    check("W2 웹: 페이지 오류 없음", not errs, "; ".join(errs)[:120])
    pg.close()

    # ── 앱(가짜 Android 브리지) ──
    ctx = b.new_context(); ctx.add_init_script(FAKE + "\n" + BRIDGE)
    exchanges = []
    def api(route):
        req = route.request
        if req.url.endswith("/api/auth/kakao/app/exchange"):
            body = json.loads(req.post_data); exchanges.append(body)
            if body["code"].startswith("BAD"):
                return route.fulfill(status=401, content_type="application/json", body=json.dumps({"error": {"code": "OAUTH_APP_CODE_INVALID", "message": "로그인 정보가 만료되었거나 잘못되었습니다. 다시 로그인해주세요."}}))
            return route.fulfill(status=200, content_type="application/json", body=json.dumps({"access_token": "a.b.c", "refresh_token": "r.s.t", "token_type": "Bearer", "expires_in": 900, "is_new_user": False, "user": {"id": "u", "email": "e@x.com", "nickname": "n"}}))
        return route.fulfill(status=404, content_type="application/json", body="{}")
    ctx.route("**/api/**", api)
    pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    calls = lambda plugin, m: pg.evaluate(f"window.__calls.filter(c => c.pluginId === '{plugin}' && c.methodName === '{m}')")
    pg.goto(f"{B}/login", wait_until="networkidle")
    btn = pg.get_by_role("button", name="카카오로 시작하기")
    check("A1 앱: 카카오가 버튼(링크 아님)", btn.count() == 1 and pg.locator("a", has_text="카카오로 시작하기").count() == 0)
    check("A1b 앱: appUrlOpen·getLaunchUrl·browserFinished 구독", pg.evaluate("window.__listeners.map(l => l.p + ':' + l.e).sort().join(',')").count("App:appUrlOpen") >= 1 and len(calls("App", "getLaunchUrl")) >= 1 and "Browser:browserFinished" in pg.evaluate("window.__listeners.map(l => l.p + ':' + l.e).join(',')"))

    btn.click(); pg.wait_for_timeout(500)
    opens = calls("Browser", "open")
    url = opens[-1]["options"]["url"] if opens else ""
    q = parse_qs(urlparse(url).query)
    pk = json.loads(pg.evaluate("localStorage.getItem('clog_app_login_pkce')") or "{}")
    check("A2 Browser.open → /api/auth/kakao/login?client=app&S256", urlparse(url).path == "/api/auth/kakao/login" and q.get("client") == ["app"] and q.get("code_challenge_method") == ["S256"] and len(q.get("code_challenge", [""])[0]) == 43, url[:80])
    check("A3 저장된 verifier 의 SHA256 = 보낸 challenge", pk.get("v") and s256(pk["v"]) == q["code_challenge"][0])
    check("A4 진행 중 버튼 비활성", pg.get_by_role("button", name="카카오 로그인 진행 중...").is_disabled())
    pg.evaluate("window.__emit('Browser', 'browserFinished', {})"); pg.wait_for_timeout(300)
    check("A5 브라우저 닫힘 → 버튼 다시 활성", pg.get_by_role("button", name="카카오로 시작하기").is_enabled())

    btn.click(); pg.wait_for_timeout(500)
    pk = json.loads(pg.evaluate("localStorage.getItem('clog_app_login_pkce')"))
    pg.evaluate("window.__emit('App', 'appUrlOpen', {url: 'com.climblog.app://auth/callback?code=GOOD1'})"); pg.wait_for_timeout(1000)
    check("A6 복귀 → 코드+verifier 로 교환 1회", len(exchanges) == 1 and exchanges[0] == {"code": "GOOD1", "code_verifier": pk["v"]}, str(len(exchanges)))
    check("A7 토큰 저장 + /feed 이동", pg.evaluate("localStorage.getItem('clog_access_token')") == "a.b.c" and pg.evaluate("localStorage.getItem('clog_refresh_token')") == "r.s.t" and urlparse(pg.url).path == "/feed", pg.url)
    check("A8 verifier 삭제 + Browser.close 호출", pg.evaluate("localStorage.getItem('clog_app_login_pkce')") is None and len(calls("Browser", "close")) >= 1)
    pg.evaluate("window.__emit('App', 'appUrlOpen', {url: 'com.climblog.app://auth/callback?code=GOOD1'})"); pg.wait_for_timeout(500)
    check("A9 같은 코드 다시 와도 교환 안 함", len(exchanges) == 1)
    pg.evaluate("window.__emit('App', 'appUrlOpen', {url: 'https://climb-log.com/feed'})"); pg.wait_for_timeout(300)
    check("A10 다른 URL 은 무시", len(exchanges) == 1)

    pg.evaluate("localStorage.clear()"); pg.goto(f"{B}/login", wait_until="networkidle")
    pg.get_by_role("button", name="카카오로 시작하기").click(); pg.wait_for_timeout(500)
    pg.evaluate("window.__emit('App', 'appUrlOpen', {url: 'com.climblog.app://auth/callback?code=BAD1'})"); pg.wait_for_timeout(1000)
    check("A11 교환 실패(401) → /login + 서버 메시지", urlparse(pg.url).path == "/login" and pg.get_by_text("로그인 정보가 만료되었거나 잘못되었습니다").count() == 1 and pg.evaluate("localStorage.getItem('clog_access_token')") is None, pg.url)

    pg.evaluate("window.__emit('App', 'appUrlOpen', {url: 'com.climblog.app://auth/callback?code=NOVER'})"); pg.wait_for_timeout(800)
    check("A12 verifier 없음(시작 안 함·만료) → 교환 안 하고 안내", not any(e["code"] == "NOVER" for e in exchanges) and pg.get_by_text("로그인 시간이 지났어요").count() == 1)
    check("A13 페이지 오류 없음", not errs, "; ".join(errs)[:160])
    pg.close()

    # ── 콜드 스타트: 앱이 정리된 뒤 복귀 URL 로 새로 시작 ──
    pg = ctx.new_page()
    pg.goto(f"{B}/login", wait_until="networkidle")
    v = "x" * 10 + base64.urlsafe_b64encode(os.urandom(40)).decode().rstrip("=")
    pg.evaluate(f"localStorage.clear(); localStorage.setItem('clog_app_login_pkce', JSON.stringify({{v: '{v}', at: Date.now()}}))")
    pg.add_init_script("window.__launchUrl = 'com.climblog.app://auth/callback?code=COLD1'")
    n = len(exchanges)
    pg.goto(f"{B}/", wait_until="networkidle"); pg.wait_for_timeout(1000)
    check("A14 콜드 스타트 getLaunchUrl → 교환 + /feed", len(exchanges) == n + 1 and exchanges[-1] == {"code": "COLD1", "code_verifier": v} and urlparse(pg.url).path == "/feed", pg.url)
    b.close()

finish()
