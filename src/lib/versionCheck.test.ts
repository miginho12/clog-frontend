// 새 버전 감지 (감사 M7) — 서버 /version.json 의 buildId 가 내 빌드와 다르면 알려 주고,
// 같은 서버 빌드로는 자동 새로고침을 한 번만 한다(새로고침 루프 방지).
// 훅은 Testing Library 없이 react-dom 으로 직접 렌더한다(이번 범위는 로직만).
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CURRENT_BUILD_ID, autoApplyOnce, useNewVersion } from "./versionCheck";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const reload = vi.fn();
const versionJson = (buildId: unknown, ok = true) =>
  vi.fn(async () => new Response(JSON.stringify({ buildId }), { status: ok ? 200 : 404 }));

function stubSite(hostname: string) {
  vi.stubGlobal("location", { ...window.location, hostname, reload });
}

beforeEach(() => {
  reload.mockReset();
  sessionStorage.clear();
});

describe("autoApplyOnce", () => {
  beforeEach(() => stubSite("climb-log.com"));

  it("같은 서버 빌드로는 한 번만 새로고침한다", () => {
    expect(autoApplyOnce("abc1234")).toBe(true);
    expect(autoApplyOnce("abc1234")).toBe(false); // 캐시된 옛 version.json 등으로 계속 달라도 루프 없음
    expect(reload).toHaveBeenCalledOnce();
  });

  it("그다음 새 배포(다른 ID)면 다시 한 번 새로고침한다", () => {
    autoApplyOnce("abc1234");
    expect(autoApplyOnce("def5678")).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("저장소를 못 쓰면 새로고침하지 않는다", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    expect(autoApplyOnce("abc1234")).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});

describe("useNewVersion", () => {
  let root: Root;
  let latest: string | null = null;

  function Probe({ path }: { path: string }) {
    latest = useNewVersion(path);
    return null;
  }
  const render = (path: string) => act(() => root.render(createElement(Probe, { path })));

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv("DEV", false); // 개발 서버에선 꺼지므로 운영처럼
    latest = null;
    root = createRoot(document.createElement("div"));
  });
  afterEach(() => {
    act(() => root.unmount());
    vi.useRealTimers();
  });

  it("서버에 다른 빌드가 있으면 그 ID 를 돌려준다 (처음 확인은 10초 뒤)", async () => {
    stubSite("climb-log.com");
    const fetch = versionJson("newbld1");
    vi.stubGlobal("fetch", fetch);

    await render("/feed");
    // 처음 렌더 때 경로 효과로 바로 한 번 확인한다
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(latest).toBe("newbld1");
    expect(String((fetch.mock.calls[0] as unknown[])[0])).toMatch(/^\/version\.json\?t=\d+$/); // 캐시 우회 쿼리
  });

  it("서버 빌드가 내 빌드와 같으면 null", async () => {
    stubSite("climb-log.com");
    vi.stubGlobal("fetch", versionJson(CURRENT_BUILD_ID));
    await render("/feed");
    await act(() => vi.advanceTimersByTimeAsync(11_000));
    expect(latest).toBeNull();
  });

  it("version.json 이 없거나(옛 서버) 형식이 다르면 무시한다", async () => {
    stubSite("climb-log.com");
    vi.stubGlobal("fetch", versionJson("x", false));
    await render("/feed");
    await act(() => vi.advanceTimersByTimeAsync(11_000));
    expect(latest).toBeNull();

    vi.stubGlobal("fetch", versionJson(12345));
    await act(() => vi.advanceTimersByTimeAsync(5 * 60_000));
    expect(latest).toBeNull();
  });

  it("경로 이동 때 확인은 마지막 확인 후 1분이 지났을 때만", async () => {
    stubSite("climb-log.com");
    const fetch = versionJson(CURRENT_BUILD_ID);
    vi.stubGlobal("fetch", fetch);
    await render("/feed");
    await act(() => vi.advanceTimersByTimeAsync(0));
    const afterMount = fetch.mock.calls.length;

    await render("/grade"); // 1분 안 이동 → 확인 안 함
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(fetch.mock.calls.length).toBe(afterMount);

    // 10초 첫 확인이 마지막 확인 시각을 갱신 → 그로부터 1분 지난 71초에 이동
    await act(() => vi.advanceTimersByTimeAsync(60_500));
    const at60 = fetch.mock.calls.length;
    await render("/profile"); // 마지막 확인(10초)부터 50초 → 확인 안 함
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(fetch.mock.calls.length).toBe(at60);

    await act(() => vi.advanceTimersByTimeAsync(11_000));
    const beforeMove = fetch.mock.calls.length;
    await render("/search"); // 1분 넘음 → 확인
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(fetch.mock.calls.length).toBe(beforeMove + 1);
  });

  it("앱 번들·개발 서버(localhost)에선 확인하지 않는다", async () => {
    stubSite("localhost");
    const fetch = versionJson("newbld1");
    vi.stubGlobal("fetch", fetch);
    await render("/feed");
    await act(() => vi.advanceTimersByTimeAsync(6 * 60_000));
    expect(fetch).not.toHaveBeenCalled();
    expect(latest).toBeNull();
  });
});
