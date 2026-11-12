import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isChunkLoadError, reloadOnceForNewVersion } from "./chunkReload";

describe("isChunkLoadError", () => {
  it.each([
    "Failed to fetch dynamically imported module: https://climb-log.com/assets/FeedPage-abc.js", // Chrome
    "Importing a module script failed.", // Safari
    "error loading dynamically imported module", // Firefox
    "Unable to preload CSS for /assets/x.css", // vite preload
  ])("배포 후 옛 청크 실패로 본다: %s", (msg) => {
    expect(isChunkLoadError(new TypeError(msg))).toBe(true);
  });

  it("다른 오류는 청크 실패가 아니다 (새로고침하면 안 됨)", () => {
    expect(isChunkLoadError(new TypeError("Cannot read properties of undefined"))).toBe(false);
    expect(isChunkLoadError(new Error("요청 실패 (500)"))).toBe(false);
    expect(isChunkLoadError("ChunkLoadError: Loading chunk 3 failed")).toBe(true); // 문자열로 던져진 경우
  });
});

describe("reloadOnceForNewVersion", () => {
  const reload = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-12T00:00:00Z"));
    sessionStorage.clear();
    reload.mockReset();
    vi.stubGlobal("location", { ...window.location, reload });
  });
  afterEach(() => vi.useRealTimers());

  it("처음엔 새로고침한다", () => {
    expect(reloadOnceForNewVersion()).toBe(true);
    expect(reload).toHaveBeenCalledOnce();
  });

  it("10초 안에 또 실패하면 새로고침하지 않는다 (루프 방지 → ErrorBoundary 안내)", () => {
    reloadOnceForNewVersion();
    vi.advanceTimersByTime(9_999);
    expect(reloadOnceForNewVersion()).toBe(false);
    expect(reload).toHaveBeenCalledOnce();
  });

  it("10초가 지나면 다시 새로고침할 수 있다 (다음 배포)", () => {
    reloadOnceForNewVersion();
    vi.advanceTimersByTime(10_000);
    expect(reloadOnceForNewVersion()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("저장소를 못 쓰면(사생활 모드) 루프를 판단할 수 없으니 새로고침하지 않는다", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    expect(reloadOnceForNewVersion()).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});
