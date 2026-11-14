import { useEffect, useRef, useState } from "react";

// 새 버전 감지 (2026-11-10, 감사 M7)
//
// 배포 후에도 열린 탭·앱(WebView)은 옛 번들로 계속 돈다. 서버의 /version.json(빌드마다 다른 ID)을
// 주기적으로 확인해, 내 빌드 ID 와 다르면 "새 버전 있음" 상태가 된다.
// - 확인 시점: 처음 10초 뒤 · 화면 복귀(visibilitychange) · 5분마다 · 경로 이동(1분에 최대 1회)
// - 반영: AppLayout 이 배너를 띄우고, 안전한 다음 이동 때 새로고침으로 적용(autoApplyOnce — 서버 빌드당 한 번)
// - 앱 번들(https://localhost)·개발 서버(localhost)에선 끈다 — 서버와 비교할 대상이 다르다.

export const CURRENT_BUILD_ID = __APP_BUILD_ID__;

const POLL_MS = 5 * 60_000;
const ROUTE_THROTTLE_MS = 60_000;
const APPLIED_KEY = "clog_version_applied_for";

function checkEnabled(): boolean {
  return !import.meta.env.DEV && window.location.hostname !== "localhost";
}

async function fetchServerBuildId(): Promise<string | null> {
  try {
    // 쿼리로 Cloudflare·브라우저 캐시 우회 (nginx 도 no-cache)
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null; // 옛 서버(파일 없음)·일시 장애는 무시
    const body = (await res.json()) as { buildId?: unknown };
    return typeof body.buildId === "string" ? body.buildId : null;
  } catch {
    return null;
  }
}

/** 서버에 다른 빌드가 있으면 그 빌드 ID, 아니면 null */
export function useNewVersion(pathname: string): string | null {
  const [serverId, setServerId] = useState<string | null>(null);
  const lastCheck = useRef(0);

  const check = useRef(async () => {
    if (!checkEnabled()) return;
    lastCheck.current = Date.now();
    const id = await fetchServerBuildId();
    if (id && id !== CURRENT_BUILD_ID) setServerId(id);
  });

  useEffect(() => {
    if (!checkEnabled()) return;
    const first = window.setTimeout(() => void check.current(), 10_000);
    const timer = window.setInterval(() => void check.current(), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void check.current();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    if (Date.now() - lastCheck.current > ROUTE_THROTTLE_MS) void check.current();
  }, [pathname]);

  return serverId;
}

/**
 * 같은 서버 빌드로는 자동 새로고침을 한 번만 — 캐시된 옛 version.json 등으로 새로고침 뒤에도
 * ID 가 계속 다르면 이동할 때마다 새로고침되는 루프를 막는다(그땐 배너만 남는다).
 */
export function autoApplyOnce(serverId: string): boolean {
  try {
    if (sessionStorage.getItem(APPLIED_KEY) === serverId) return false;
    sessionStorage.setItem(APPLIED_KEY, serverId);
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}
