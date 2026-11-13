"""강제 CSP 점검 (감사 M3 2단계, 2026-11-12) — nginx/security-headers.conf 의 CSP 를 **강제 헤더로** 붙여
로컬 웹 빌드를 띄우고, 화면을 옮겨 다니며 CSP 위반·페이지 오류·화면 전환용 <style> 동작을 본다.

왜: framer-motion AnimatePresence mode="popLayout"(AppLayout 화면 전환)은 빈 <style> 을 넣고 insertRule 로
채운다. CSP 가 막으면 오류 없이 sheet=null → 사라지는 페이지 위치 고정만 조용히 빠진다(눈으로만 보임).
framer-motion·React 를 올리거나 CSP 를 고칠 때 돌린다.

사용: npm run build && uv run --no-project --with playwright python e2e/csp_enforce.py [dist]
  C5: 카카오 프로필 https 는 허용·http 는 차단(DB 는 https 만)
  CSP_OVERRIDE='<정책>' 을 주면 그 정책으로 시험한다(대조 실험 — 예: 빈 해시를 뺀 정책은 실패해야 정상).
API 는 Playwright 가 가로채 가짜로 응답한다(서버 없이, 실제 데이터 무관).
"""

import http.server
import json
import os
import re
import socketserver
import sys
import threading

from _common import check, finish, launch
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(ROOT, "dist")
if not os.path.isfile(os.path.join(DIST, "index.html")):
    sys.exit(f"빌드 없음: {DIST}/index.html — 먼저 npm run build")

conf = open(os.path.join(ROOT, "nginx/security-headers.conf"), encoding="utf-8").read()
m = re.search(r'^add_header Content-Security-Policy "([^"]+)" always;', conf, re.M)
if not m:
    sys.exit("security-headers.conf 에 강제 Content-Security-Policy 가 없음")
CSP = os.environ.get("CSP_OVERRIDE") or m.group(1)
# 보고는 이 서버로 받지 않는다(브라우저 이벤트로 수집) — report-uri 는 빼서 404 소음을 없앤다
CSP = re.sub(r";\s*report-uri [^;]+", "", CSP)


class SPA(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

    def translate_path(self, path):
        rel = path.split("?")[0].lstrip("/")
        full = os.path.join(DIST, rel)
        if not os.path.isfile(full) and not rel.startswith("assets/"):
            full = os.path.join(DIST, "index.html")
        return full

    def end_headers(self):
        self.send_header("Content-Security-Policy", CSP)
        super().end_headers()


socketserver.ThreadingTCPServer.allow_reuse_address = True
srv = socketserver.ThreadingTCPServer(("127.0.0.1", 4393), SPA)
srv.daemon_threads = True
threading.Thread(target=srv.serve_forever, daemon=True).start()
B = "http://127.0.0.1:4393"

# 위반 이벤트 + 빈 <style> 이 붙은 직후 sheet 가 살아 있는지 기록
INIT = """
window.__v = []; window.__styles = {total: 0, nullSheet: 0};
document.addEventListener('securitypolicyviolation', e =>
  window.__v.push(e.violatedDirective + ' ' + e.blockedURI + ' @' + location.pathname));
const orig = Node.prototype.appendChild;
Node.prototype.appendChild = function (c) {
  const r = orig.call(this, c);
  if (c instanceof HTMLStyleElement && c.isConnected && !c.textContent) {
    window.__styles.total++; if (c.sheet === null) window.__styles.nullSheet++;
  }
  return r;
};
"""
USER = {"id": "u1", "email": "e2e@example.com", "nickname": "e2e", "is_public": True,
        "profile_image_url": None, "role": "user", "auth_provider": "local", "email_verified": True}


def api(route):
    path = route.request.url.split("/api/", 1)[1].split("?")[0]
    if path in ("users/me", "auth/me"):
        body = USER
    elif path.endswith("csp-report"):
        body = {}
    else:
        body = {"items": [], "total": 0, "next_cursor": None}
    route.fulfill(status=200, content_type="application/json", body=json.dumps(body))


with sync_playwright() as p:
    b = launch(p)
    ctx = b.new_context(viewport={"width": 390, "height": 844})
    ctx.add_init_script(INIT)
    ctx.route("**/api/**", api)
    pg = ctx.new_page()
    errs: list[str] = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:120]))

    # 비로그인 화면
    for path in ("/login", "/signup", "/feed"):
        pg.goto(B + path, wait_until="networkidle")
    # 로그인 상태(토큰만 — API 는 가짜) → 탭 순회: 탭 전환마다 popLayout 퇴장 애니메이션
    pg.evaluate("localStorage.setItem('clog_access_token','a.b.c'); localStorage.setItem('clog_refresh_token','r.s.t')")
    pg.goto(B + "/feed", wait_until="networkidle")
    visited = []
    for label in ("그레이드", "검색", "프로필", "피드", "프로필", "그레이드"):
        link = pg.get_by_role("link", name=label)
        if link.count() == 0:
            link = pg.get_by_text(label, exact=True)
        link.first.click()
        pg.wait_for_timeout(700)  # 전환 애니메이션이 끝날 때까지
        visited.append(pg.url.replace(B, ""))

    v = pg.evaluate("window.__v")
    st = pg.evaluate("window.__styles")
    print("CSP:", CSP[:110] + "…")
    print("이동:", " → ".join(visited))
    check("C1 CSP 위반 0", not v, "; ".join(v)[:300])
    check("C2 화면 전환이 빈 <style> 을 실제로 사용(popLayout 경로 실행됨)", st["total"] > 0, f"{st['total']}개")
    check("C3 빈 <style> 이 막히지 않음(sheet 살아 있음)", st["total"] > 0 and st["nullSheet"] == 0, f"null {st['nullSheet']}/{st['total']}")
    check("C4 페이지 오류 없음", not errs, "; ".join(errs)[:200])

    # 카카오 프로필: https 는 통과, http 는 막혀야 한다(DB 는 https 만 — backend secure_resource + 마이그레이션
    # 6a4fc0e704e9). 이 서버는 http 페이지라 mixed content 업그레이드가 없어 정책 문자열 그대로를 본다
    # (https 페이지의 Chromium 강제 CSP 는 업그레이드 뒤 통과 — security-headers.conf 주석). 요청은 가짜 응답
    PNG = bytes.fromhex("89504e470d0a1a0a0000000d4948445200000001000000010806000000"
                        "1f15c4890000000d49444154789c6300010000000500010d0a2db40000000049454e44ae426082")
    ctx.route("**/*.kakaocdn.net/**", lambda r: r.fulfill(status=200, content_type="image/png", body=PNG))
    pg.evaluate("window.__v = []")
    res = pg.evaluate("""() => Promise.all(['http://k.kakaocdn.net/dn/e2e/a.png', 'https://k.kakaocdn.net/dn/e2e/b.png'].map(u =>
        new Promise(ok => { const i = new Image(); i.onload = () => ok('load'); i.onerror = () => ok('error'); i.src = u; })))""")
    v = pg.evaluate("window.__v")
    check("C5 카카오 프로필 https 허용·http 차단", res == ["error", "load"] and len(v) == 1 and "img-src http://k.kakaocdn.net" in v[0],
          f"{res} {'; '.join(v)[:120]}")
    b.close()

finish()
