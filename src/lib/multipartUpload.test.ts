// 영상 분할 업로드 — 조각 동시 업로드·재시도·presigned 만료 재발급(single-flight)·이어 올리기.
// 서버 호출(api/client)은 가짜로 바꾸고, 재시도 대기(1·2초)는 가짜 타이머로 건너뛴다.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client";
import * as api from "../api/client";
import { abandonMultipart, shouldUseMultipart, uploadMultipart } from "./multipartUpload";

vi.mock("../api/client", async (orig) => ({
  ...(await orig<typeof import("../api/client")>()),
  initMultipart: vi.fn(),
  multipartStatus: vi.fn(),
  completeMultipart: vi.fn(),
  abortMultipart: vi.fn(),
  uploadPartToPresigned: vi.fn(),
}));

const m = vi.mocked(api);
// 10바이트 · 조각 4바이트 → 1(4) 2(4) 3(2)
const file = () => new File(["0123456789"], "climb.mp4", { type: "video/mp4", lastModified: 1 });
const KEY = "clog_multipart:climb.mp4:10:1";
const REF = { object_key: "k/climb.mp4", upload_id: "up1" };
const parts = (ns: number[], v = "a") => ns.map((n) => ({ part_number: n, url: `https://minio/${v}/${n}` }));

async function run<T>(p: Promise<T>): Promise<T> {
  // 실패 경로도 끝까지 돌리기 위해 결과를 먼저 붙잡고 타이머를 전부 진행
  const settled = p.then(
    (v) => ({ ok: true as const, v }),
    (e: unknown) => ({ ok: false as const, e }),
  );
  await vi.runAllTimersAsync();
  const r = await settled;
  if (!r.ok) throw r.e;
  return r.v;
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  vi.resetAllMocks();
  m.initMultipart.mockResolvedValue({ ...REF, part_size: 4, parts: parts([1, 2, 3]) } as never);
  m.completeMultipart.mockResolvedValue({ public_url: "https://cdn/climb.mp4", category: "video" } as never);
  m.uploadPartToPresigned.mockImplementation(async (_u, blob, onProgress) => onProgress?.(blob.size));
});

describe("shouldUseMultipart", () => {
  it("영상만 분할 (사진은 단일 PUT)", () => {
    expect(shouldUseMultipart({ type: "video/quicktime" })).toBe(true);
    expect(shouldUseMultipart({ type: "image/jpeg" })).toBe(false);
  });
});

describe("uploadMultipart", () => {
  it("조각을 전부 올리고 합친 뒤 이어 올리기 기록을 지운다, 100% 는 합치기 성공 후에만", async () => {
    const progress: number[] = [];
    const res = await run(uploadMultipart(file(), (p) => progress.push(p)));

    expect(res).toEqual({ public_url: "https://cdn/climb.mp4", category: "video" });
    const sent = m.uploadPartToPresigned.mock.calls.map(([url, blob]) => [url, blob.size]);
    expect(sent).toEqual([
      ["https://minio/a/1", 4],
      ["https://minio/a/2", 4],
      ["https://minio/a/3", 2], // 마지막 조각은 남은 크기만
    ]);
    expect(m.completeMultipart).toHaveBeenCalledWith(REF, 10);
    expect(progress.at(-1)).toBe(100);
    expect(progress.slice(0, -1).every((p) => p <= 99)).toBe(true);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("여러 조각이 동시에 403(presigned 만료)이어도 URL 재발급(status)은 1번, 새 URL 로 재시도", async () => {
    m.uploadPartToPresigned.mockImplementation(async (url) => {
      if (url.includes("/a/")) throw new ApiError(403, "expired", "upload_failed");
    });
    m.multipartStatus.mockResolvedValue({ uploaded: [], parts: parts([1, 2, 3], "b") } as never);

    await run(uploadMultipart(file()));

    expect(m.multipartStatus).toHaveBeenCalledOnce();
    const retried = m.uploadPartToPresigned.mock.calls.map(([u]) => u).filter((u) => u.includes("/b/"));
    expect(retried.sort()).toEqual(["https://minio/b/1", "https://minio/b/2", "https://minio/b/3"]);
  });

  it("옛 URL 조각이 재발급이 끝난 뒤 늦게 403 을 받아도 다시 재발급하지 않는다", async () => {
    m.uploadPartToPresigned.mockImplementation(async (url) => {
      if (!url.includes("/a/")) return;
      // 조각 3은 느린 회선 — 1·2 의 재발급이 끝난 한참 뒤에 403
      if (url.endsWith("/3")) await new Promise((r) => setTimeout(r, 5_000));
      throw new ApiError(403, "expired", "upload_failed");
    });
    m.multipartStatus.mockResolvedValue({ uploaded: [], parts: parts([1, 2, 3], "b") } as never);

    await run(uploadMultipart(file()));

    expect(m.multipartStatus).toHaveBeenCalledOnce();
    expect(m.uploadPartToPresigned.mock.calls.map(([u]) => u)).toContain("https://minio/b/3");
  });

  it("조각이 3번 다 실패하면 합치지 않고 실패, 이어 올리기 기록은 남긴다", async () => {
    m.uploadPartToPresigned.mockImplementation(async (url) => {
      if (url.endsWith("/2")) throw new ApiError(0, "network", "upload_failed");
    });

    await expect(run(uploadMultipart(file()))).rejects.toMatchObject({ status: 0 });

    const part2 = m.uploadPartToPresigned.mock.calls.filter(([u]) => u.endsWith("/2"));
    expect(part2).toHaveLength(3); // 1 + 재시도 2
    expect(m.completeMultipart).not.toHaveBeenCalled(); // 깨진 영상이 게시되지 않음
    expect(JSON.parse(localStorage.getItem(KEY)!)).toMatchObject({ ...REF, size: 10, part_size: 4 });
  });

  it("같은 파일로 다시 시도하면 이미 올라간 조각은 건너뛰고 이어서 올린다", async () => {
    localStorage.setItem(KEY, JSON.stringify({ ...REF, size: 10, part_size: 4, saved_at: Date.now() }));
    m.multipartStatus.mockResolvedValue({ uploaded: [1, 2], parts: parts([3], "c") } as never);
    const progress: number[] = [];

    await run(uploadMultipart(file(), (p) => progress.push(p)));

    expect(m.initMultipart).not.toHaveBeenCalled();
    expect(m.uploadPartToPresigned.mock.calls.map(([u]) => u)).toEqual(["https://minio/c/3"]);
    expect(progress[0]).toBe(80); // 이미 올라간 8/10 바이트부터
  });

  it("서버에 그 업로드가 없으면(만료·완료) 기록을 버리고 처음부터", async () => {
    localStorage.setItem(KEY, JSON.stringify({ ...REF, upload_id: "gone", size: 10, part_size: 4, saved_at: Date.now() }));
    m.multipartStatus.mockRejectedValue(new ApiError(404, "not found", "multipart_not_found"));

    await run(uploadMultipart(file()));

    expect(m.initMultipart).toHaveBeenCalledOnce();
    expect(m.uploadPartToPresigned).toHaveBeenCalledTimes(3);
  });

  it("이어 올리기 확인이 네트워크 오류면 새로 시작하지 않고 실패 (다음 재시도에서 이어감)", async () => {
    localStorage.setItem(KEY, JSON.stringify({ ...REF, size: 10, part_size: 4, saved_at: Date.now() }));
    m.multipartStatus.mockRejectedValue(new ApiError(0, "network", "error"));

    await expect(run(uploadMultipart(file()))).rejects.toMatchObject({ status: 0 });
    expect(m.initMultipart).not.toHaveBeenCalled();
    expect(localStorage.getItem(KEY)).not.toBeNull();
  });

  it("24시간 지난 기록은 쓰지 않는다", async () => {
    localStorage.setItem(KEY, JSON.stringify({ ...REF, size: 10, part_size: 4, saved_at: Date.now() - 25 * 3600_000 }));
    await run(uploadMultipart(file()));
    expect(m.multipartStatus).not.toHaveBeenCalled();
    expect(m.initMultipart).toHaveBeenCalledOnce();
  });
});

describe("abandonMultipart", () => {
  it("서버 조각을 정리하고 기록을 지운다 — 정리가 실패해도 예외 없음", async () => {
    localStorage.setItem(KEY, JSON.stringify({ ...REF, size: 10, part_size: 4, saved_at: Date.now() }));
    m.abortMultipart.mockRejectedValue(new Error("down"));

    await expect(abandonMultipart(file())).resolves.toBeUndefined();
    expect(m.abortMultipart).toHaveBeenCalledWith(REF);
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
