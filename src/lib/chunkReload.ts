// 배포 후 옛 청크 로드 실패 처리 (2026-11-10, 감사 M6)
//
// 코드 분할 후엔 페이지 JS 가 별도 파일(해시 이름)이다. 배포하면 새 이미지에 옛 해시 파일이 없으므로,
// 배포 전에 열어 둔 탭/WebView 가 아직 안 받은 페이지로 이동하면 import() 가 404 로 실패한다.
// → 한 번 새로고침해 새 index.html·새 청크를 받는다. 10초 안에 또 실패하면(진짜 장애·오프라인)
//   새로고침 루프를 막기 위해 에러를 그대로 올려 ErrorBoundary 가 안내 화면을 띄운다.

const KEY = "clog_chunk_reload_at";
const GUARD_MS = 10_000;

export function isChunkLoadError(e: unknown): boolean {
  const msg = e instanceof Error ? `${e.name} ${e.message}` : String(e);
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Unable to preload CSS/i.test(
    msg,
  );
}

/** 최근에 새로고침하지 않았으면 새로고침하고 true. 루프 방지에 걸리면 false. */
export function reloadOnceForNewVersion(): boolean {
  let last: number;
  try {
    last = Number(sessionStorage.getItem(KEY) ?? 0);
  } catch {
    // 저장소 접근 불가(사생활 모드 등) — 루프 판단을 못 하므로 새로고침하지 않는다
    return false;
  }
  if (Date.now() - last < GUARD_MS) return false;
  try {
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}
