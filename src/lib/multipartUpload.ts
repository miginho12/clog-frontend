// 영상 분할(multipart) 업로드 — 조각 나누기·동시 업로드·재시도·이어 올리기.
//
// 왜: 영상은 크기와 상관없이 전부 분할로 올린다.
// - Cloudflare 가 요청 1건당 100MB 를 넘으면 413 으로 끊는다(2026-10-13 실측 99MB 통과 / 101MB 413).
// - 2026-10-14: 폰 + 집 와이파이에서 Cloudflare 경유 단일 PUT 이 크기와 무관하게 시작 후 35~40초에
//   끊겼다(68·74·173MB, nginx 400 + cloudflared "context canceled"). 같은 파일이 모바일 데이터·
//   서버(curl, Chromium)에선 90초 넘게 걸려도 성공 → 클라이언트 쪽 네트워크 문제라 서버에서 못 고친다.
//   16MiB 조각은 같은 와이파이에서도 항상 성공했고, 조각마다 재시도·이어 올리기도 붙는다.
// 서버(/media/multipart/*)가 조각별 presigned URL 을 주고, 다 올라오면 조각 개수·크기를 검증해
// 합친다 — 하나라도 빠지거나 잘리면 합치기가 거부돼 깨진 영상이 게시되지 않는다.
import {
  ApiError,
  abortMultipart,
  completeMultipart,
  initMultipart,
  multipartStatus,
  uploadPartToPresigned,
  type MultipartRef,
} from "../api/client";

const CONCURRENCY = 3;
const MAX_ATTEMPTS = 3; // 조각당 시도 횟수 (1 + 재시도 2)
const RESUME_TTL_MS = 24 * 60 * 60 * 1000;
const STORE_PREFIX = "clog_multipart:";

// 영상은 전부 분할, 사진은 작아서 단일 PUT (서버도 분할은 영상만 허용).
export function shouldUseMultipart(file: Pick<File, "type">): boolean {
  return file.type.startsWith("video/");
}

// ── 이어 올리기 기록 (localStorage) ──
// 같은 파일(이름·크기·수정시각)로 다시 시도하면 이미 올라간 조각은 건너뛴다.
// 앱을 껐다 켜서 같은 영상을 다시 골라도 이어진다. 저장 실패(사생활 모드 등)는 무시 — 처음부터 올릴 뿐.
interface SavedUpload extends MultipartRef {
  size: number;
  part_size: number;
  saved_at: number;
}

function storeKey(file: File): string {
  return `${STORE_PREFIX}${file.name}:${file.size}:${file.lastModified}`;
}

function loadSaved(file: File): SavedUpload | null {
  try {
    const raw = localStorage.getItem(storeKey(file));
    if (!raw) return null;
    const saved = JSON.parse(raw) as SavedUpload;
    if (Date.now() - saved.saved_at > RESUME_TTL_MS || saved.size !== file.size) {
      localStorage.removeItem(storeKey(file));
      return null;
    }
    return saved;
  } catch {
    return null;
  }
}

function save(file: File, saved: SavedUpload): void {
  try {
    localStorage.setItem(storeKey(file), JSON.stringify(saved));
  } catch {
    /* 저장 불가여도 업로드 자체는 진행 */
  }
}

function forget(file: File): void {
  try {
    localStorage.removeItem(storeKey(file));
  } catch {
    /* noop */
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface MultipartResult {
  public_url: string;
  category: string;
}

/**
 * file 을 분할 업로드하고 합쳐진 객체의 public_url 을 돌려준다.
 * 실패하면 이어 올리기 기록을 남긴 채 예외 — 같은 파일로 다시 부르면 빠진 조각만 올린다.
 */
export async function uploadMultipart(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<MultipartResult> {
  const total = file.size;
  let ref: MultipartRef | null = null;
  let partSize = 0;
  let pending: { part_number: number; url: string }[] = [];
  let doneBytes = 0;

  const saved = loadSaved(file);
  if (saved) {
    try {
      const st = await multipartStatus(saved, total);
      ref = { object_key: saved.object_key, upload_id: saved.upload_id };
      partSize = saved.part_size;
      pending = st.parts;
      for (const n of st.uploaded) doneBytes += Math.min(partSize, total - (n - 1) * partSize);
    } catch (e) {
      // 만료·취소·완료된 업로드면 새로 시작, 그 외(네트워크 등)는 그대로 실패시켜 재시도에 맡김
      if (!(e instanceof ApiError && e.code === "multipart_not_found")) throw e;
      forget(file);
    }
  }
  if (!ref) {
    const init = await initMultipart(file.type, file.name, total);
    ref = { object_key: init.object_key, upload_id: init.upload_id };
    partSize = init.part_size;
    pending = init.parts;
    save(file, { ...ref, size: total, part_size: partSize, saved_at: Date.now() });
  }
  const upload: MultipartRef = ref;

  // 진행률 = 끝난 조각 바이트 + 전송 중 조각들의 보낸 바이트. 100% 는 합치기 성공 후에만.
  const inflight = new Map<number, number>();
  const report = () => {
    let sent = doneBytes;
    for (const b of inflight.values()) sent += b;
    onProgress?.(Math.min(99, Math.round((sent / total) * 100)));
  };
  report();

  // presigned URL 재발급 — 여러 조각이 동시에 403(만료)을 받아도 status 는 한 번만 (single-flight)
  const urls = new Map(pending.map((p) => [p.part_number, p.url]));
  let refreshing: Promise<void> | null = null;
  const refreshUrls = () => {
    refreshing ??= multipartStatus(upload, total)
      .then((st) => st.parts.forEach((p) => urls.set(p.part_number, p.url)))
      .finally(() => {
        refreshing = null;
      });
    return refreshing;
  };

  const queue = pending.map((p) => p.part_number);
  let failed: unknown = null;

  const uploadOne = async (n: number) => {
    const start = (n - 1) * partSize;
    const blob = file.slice(start, Math.min(start + partSize, total));
    for (let attempt = 1; ; attempt++) {
      const usedUrl = urls.get(n)!;
      try {
        await uploadPartToPresigned(usedUrl, blob, (loaded) => {
          inflight.set(n, loaded);
          report();
        });
        inflight.delete(n);
        doneBytes += blob.size;
        report();
        return;
      } catch (e) {
        inflight.delete(n);
        report();
        if (attempt >= MAX_ATTEMPTS || failed) throw e;
        if (e instanceof ApiError && e.status === 403) {
          // presigned URL 만료. 이 조각이 쓴 URL 이 이미 (다른 조각의 재발급으로) 바뀌었으면
          // 다시 발급받지 않는다 — 옛 URL 로 나갔던 조각들이 시차를 두고 403 을 받아도 status 1회.
          if (refreshing) await refreshing;
          else if (urls.get(n) === usedUrl) await refreshUrls();
        }
        await sleep(1000 * 2 ** (attempt - 1));
      }
    }
  };

  // 작업자 CONCURRENCY 개가 큐에서 조각을 꺼내 올린다. 한 조각이 끝내 실패하면
  // 나머지 작업자도 새 조각을 집지 않고 멈춘다(실패한 업로드에 대역폭을 계속 쓰지 않게).
  const worker = async () => {
    while (queue.length && !failed) {
      const n = queue.shift()!;
      try {
        await uploadOne(n);
      } catch (e) {
        failed ??= e;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
  if (failed) throw failed;

  const done = await completeMultipart(upload, total);
  forget(file);
  onProgress?.(100);
  return { public_url: done.public_url, category: done.category };
}

/** 사용자가 업로드를 포기했을 때: 서버의 조각 정리 + 이어 올리기 기록 삭제 (실패해도 무시). */
export async function abandonMultipart(file: File): Promise<void> {
  const saved = loadSaved(file);
  forget(file);
  if (!saved) return;
  try {
    await abortMultipart({ object_key: saved.object_key, upload_id: saved.upload_id });
  } catch {
    /* 정리 실패는 MinIO 미완료 업로드 자동 만료에 맡긴다 */
  }
}
