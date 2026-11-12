// 토큰 자동 갱신 (authFetch) — 401 → refresh 1회 → 재시도, 동시 401 은 갱신 1번(single-flight),
// refresh 회전(감사 M2)·다른 탭 경합·옛 백엔드 호환·갱신 실패 시 로그아웃.
// 공개 함수 getMe() 로 authFetch 를 지나가게 하고, fetch 는 가짜 서버로 바꾼다.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, getMe } from "./client";
import { getAccessToken, getRefreshToken, saveTokens } from "../lib/auth";

const ME = { id: "u1", nickname: "me" };
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

interface Server {
  fetch: ReturnType<typeof vi.fn>;
  refreshCalls: () => RequestInit[];
}

/** /users/me 는 유효 access 일 때만 200, /auth/refresh 는 onRefresh 가 응답 */
function fakeServer(validAccess: string, onRefresh: (body: { refresh_token: string }) => Response | Promise<Response>): Server {
  const fetch = vi.fn(async (url: string, init: RequestInit = {}) => {
    if (url.endsWith("/auth/refresh")) return onRefresh(JSON.parse(String(init.body)));
    if (url.endsWith("/users/me")) {
      const auth = (init.headers as Record<string, string>)?.Authorization;
      return auth === `Bearer ${validAccess}` ? json(200, ME) : json(401, { detail: "token expired" });
    }
    throw new Error(`unexpected ${url}`);
  });
  vi.stubGlobal("fetch", fetch);
  return {
    fetch,
    refreshCalls: () =>
      fetch.mock.calls.filter(([u]) => String(u).endsWith("/auth/refresh")).map(([, i]) => i as RequestInit),
  };
}

beforeEach(() => {
  localStorage.clear();
  saveTokens("old-access", "old-refresh");
});

describe("authFetch 토큰 갱신", () => {
  it("401 이면 refresh 후 새 access 로 재시도하고, 회전된 refresh 를 저장한다", async () => {
    const s = fakeServer("new-access", () => json(200, { access_token: "new-access", refresh_token: "new-refresh" }));

    await expect(getMe()).resolves.toEqual(ME);

    expect(s.refreshCalls()).toHaveLength(1);
    const call = s.refreshCalls()[0];
    expect(JSON.parse(String(call.body))).toEqual({ refresh_token: "old-refresh" });
    // 회전 지원 신호 — 없으면 백엔드가 새 refresh 를 주지 않는다(옛 앱 보호)
    expect((call.headers as Record<string, string>)["X-Clog-Refresh-Rotation"]).toBe("1");
    expect([getAccessToken(), getRefreshToken()]).toEqual(["new-access", "new-refresh"]);
  });

  it("동시에 여러 요청이 401 이어도 refresh 는 1번만 (회전 토큰을 두 번 쓰면 재사용 감지로 전체 로그아웃)", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const s = fakeServer("new-access", async () => {
      await gate; // 세 요청이 모두 401 을 받고 갱신을 기다리는 동안 붙잡아 둔다
      return json(200, { access_token: "new-access", refresh_token: "new-refresh" });
    });

    const all = Promise.all([getMe(), getMe(), getMe()]);
    await vi.waitFor(() => expect(s.refreshCalls()).toHaveLength(1));
    release();

    await expect(all).resolves.toEqual([ME, ME, ME]);
    expect(s.refreshCalls()).toHaveLength(1);
  });

  it("옛 백엔드(refresh_token 없이 access 만)면 기존 refresh 를 유지한다", async () => {
    fakeServer("new-access", () => json(200, { access_token: "new-access" }));
    await getMe();
    expect([getAccessToken(), getRefreshToken()]).toEqual(["new-access", "old-refresh"]);
  });

  it("refresh 가 거절되면 토큰을 지우고 원래 401 을 ApiError 로 올린다 (재로그인)", async () => {
    fakeServer("never", () => json(401, { detail: "invalid refresh" }));
    const err = await getMe().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(401);
    expect([getAccessToken(), getRefreshToken()]).toEqual([null, null]);
  });

  it("다른 탭이 그사이 회전했으면 거절돼도 로그아웃하지 않고 그 탭의 토큰을 쓴다", async () => {
    fakeServer("tab2-access", () => {
      // 내 요청(old-refresh)이 서버에 도착하기 전에 다른 탭이 회전을 끝내 저장소가 바뀐 상황
      saveTokens("tab2-access", "tab2-refresh");
      return json(401, { detail: "refresh reused or rotated" });
    });

    await expect(getMe()).resolves.toEqual(ME);
    expect([getAccessToken(), getRefreshToken()]).toEqual(["tab2-access", "tab2-refresh"]);
  });

  it("refresh token 이 없으면 갱신을 시도하지 않는다", async () => {
    localStorage.clear();
    const s = fakeServer("x", () => json(200, {}));
    await expect(getMe()).rejects.toBeInstanceOf(ApiError);
    expect(s.refreshCalls()).toHaveLength(0);
  });
});

describe("오류 응답 해석", () => {
  it.each([
    [{ error: { code: "USER_NOT_FOUND", message: "사용자를 찾을 수 없습니다" } }, "USER_NOT_FOUND", "사용자를 찾을 수 없습니다"],
    [{ detail: "account is banned" }, "error", "account is banned"],
    [{ detail: [{ msg: "field required" }] }, "error", "field required"],
  ])("%j → code=%s", async (body, code, message) => {
    saveTokens("ok", "r");
    vi.stubGlobal("fetch", vi.fn(async () => json(403, body)));
    await expect(getMe()).rejects.toMatchObject({ status: 403, code, message });
  });

  it("본문이 JSON 이 아니면 상태코드 기본 메시지", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>502</html>", { status: 502 })));
    await expect(getMe()).rejects.toMatchObject({ status: 502, message: "요청 실패 (502)" });
  });
});
