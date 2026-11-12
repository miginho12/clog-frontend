"""e2e 스크립트 공통 — 브라우저 실행·항목별 PASS/FAIL·종료코드.

브라우저: CLOG_CHROMIUM 환경변수(실행 파일 경로)가 있으면 그것, 없으면 Playwright 기본 브라우저
(`uv run --no-project --with playwright python -m playwright install chromium-headless-shell`).
Pi(arm64)는 Playwright 가 받은 headless_shell 경로를 CLOG_CHROMIUM 으로 주면 된다.
"""

import os
import sys

from playwright.sync_api import Browser, Playwright

_results: list[bool] = []


def launch(p: Playwright) -> Browser:
    exe = os.environ.get("CLOG_CHROMIUM")
    return p.chromium.launch(executable_path=os.path.expanduser(exe)) if exe else p.chromium.launch()


def check(name: str, ok: object, extra: str = "") -> None:
    _results.append(bool(ok))
    print(("PASS " if ok else "FAIL ") + name + (f"  ({extra})" if extra else ""))


def finish() -> None:
    ok = all(_results) and bool(_results)
    print(f"{'ALL PASS' if ok else 'FAILED'} ({sum(_results)}/{len(_results)})")
    sys.exit(0 if ok else 1)


def base_url(argv: list[str], usage: str) -> str:
    if len(argv) < 2:
        print(f"사용: {usage}", file=sys.stderr)
        sys.exit(2)
    return argv[1].rstrip("/")
