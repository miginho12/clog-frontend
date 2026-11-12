"""웹 카카오 로그인 회귀 4항목 (감사 M14) — 앱 전용 로그인을 넣으면서 웹이 바뀌지 않았는지.

웹은 기존 링크(/api/auth/kakao/login) 그대로 · 앱 전용 버튼 없음 · 링크가 카카오로 302 · 페이지 오류 없음.
카카오 로그인 화면까지만 가고 실제 로그인은 하지 않는다.

사용: uv run --no-project --with playwright python e2e/kakao_web.py <base>
"""

import sys

from _common import base_url, check, finish, launch
from playwright.sync_api import sync_playwright

B = base_url(sys.argv, "kakao_web.py <base>")

with sync_playwright() as p:
    b = launch(p)
    pg = b.new_page()
    errs: list[str] = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(f"{B}/login", wait_until="networkidle")

    a = pg.locator("a", has_text="카카오로 시작하기")
    href = a.get_attribute("href") if a.count() else None
    check("웹 카카오 링크 그대로", a.count() == 1 and href == "/api/auth/kakao/login", href or "없음")
    check("앱 전용 버튼 없음", pg.get_by_role("button", name="카카오로 시작하기").count() == 0)
    r = pg.request.get(f"{B}/api/auth/kakao/login", max_redirects=0)
    loc = r.headers.get("location", "")
    check("링크 → 302 카카오", r.status == 302 and loc.startswith("https://kauth.kakao.com/"), str(r.status))
    check("페이지 오류 없음", not errs, "; ".join(errs)[:120])
    b.close()

finish()
