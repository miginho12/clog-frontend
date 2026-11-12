"""배포 후 브라우저 스모크 6항목 (감사 M6 에서 시작) — dev·prod 승격 때마다.

첫 로딩은 메인 번들만 · 유휴 시간에 탭 페이지 미리 받기 · 피드 오류 안내 없음 ·
/signup 지연 로드 렌더 · 자산 4xx/5xx 없음 · 페이지 JS 예외 없음.
로그인하지 않은 상태로 보므로 실제 데이터는 건드리지 않는다.

사용: uv run --no-project --with playwright python e2e/smoke.py <base>
  예) http://localhost:30081 (dev) · https://climb-log.com (prod)
"""

import sys

from _common import base_url, check, finish, launch
from playwright.sync_api import sync_playwright

B = base_url(sys.argv, "smoke.py <base>")

with sync_playwright() as p:
    b = launch(p)
    pg = b.new_page()
    js: list[str] = []
    bad: list[str] = []
    errs: list[str] = []
    pg.on("request", lambda r: js.append(r.url.rsplit("/", 1)[-1]) if r.url.endswith(".js") else None)
    pg.on(
        "response",
        lambda r: bad.append(f"{r.status} {r.url.rsplit('/', 1)[-1]}") if "/assets/" in r.url and r.status >= 400 else None,
    )
    pg.on("pageerror", lambda e: errs.append(str(e)[:80]))

    pg.goto(f"{B}/feed", wait_until="load")
    first = list(js)
    check("첫 로딩 메인 번들만", first and all(n.startswith("index-") for n in first), ", ".join(first))
    pg.wait_for_timeout(3500)
    pre = sorted({n.split("-")[0] for n in js if not n.startswith("index-")})
    check("탭 페이지 프리로드", "GradePage" in pre and "SearchPage" in pre, ", ".join(pre))
    check("피드 오류 안내 없음", pg.locator("[role=alert]").count() == 0)

    pg.goto(f"{B}/signup", wait_until="load")
    pg.locator("input").first.wait_for(timeout=10000)
    check("/signup 지연 로드 렌더", pg.locator("input").count() > 0 and pg.locator("[role=alert]").count() == 0)
    check("자산 4xx/5xx 없음", not bad, ", ".join(bad))
    check("페이지 JS 예외 없음", not errs, " | ".join(errs))
    b.close()

finish()
