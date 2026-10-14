import {
  createContext,
  useContext,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  presignMedia,
  uploadToPresigned,
  createClimbingLog,
  type ClimbingLogCreateInput,
} from "../api/client";
import {
  abandonMultipart,
  shouldUseMultipart,
  uploadMultipart,
} from "./multipartUpload";

// 대기열 항목 단계
type ItemPhase = "pending" | "uploading" | "creating" | "done" | "error";

export interface UploadItem {
  id: number;
  file: File;
  payload: ClimbingLogCreateInput;
  phase: ItemPhase;
  progress: number; // 0-100 (업로드 단계)
  error?: string;
}

interface UploadContextValue {
  // 대기열 전체 (배너가 요약 표시). 비어 있으면 배너 숨김.
  items: UploadItem[];
  // 여러 건을 대기열에 추가. 호출 즉시 반환 → 호출측은 바로 페이지 이동 가능.
  // 휴대폰 대역폭·서버 부하를 위해 한 번에 한 건씩 순서대로 올린다.
  enqueueUploads: (entries: { file: File; payload: ClimbingLogCreateInput }[]) => void;
  // 한 건짜리 호환용 (기존 작성 화면)
  startUpload: (file: File, payload: ClimbingLogCreateInput) => void;
  // 실패 항목 포기 + 완료 항목 정리 (진행 중·대기 항목은 유지)
  dismiss: () => void;
  // 실패 항목을 같은 파일/입력값으로 다시 대기열에 (폼 재입력 없이)
  retry: () => void;
}

const UploadContext = createContext<UploadContextValue | null>(null);

// 실패 항목이 있어도 다음 항목은 계속 진행한다 — 여러 건을 맡겨 두고 기다리는
// 사용 방식이라 한 건 실패로 나머지가 멈추면 안 된다. 실패분은 배너에서 재시도.
export function UploadProvider({ children }: { children: ReactNode }) {
  // 진행 로직은 ref(즉시 반영)를 기준으로, 렌더용 스냅샷은 state 로 따로 둔다.
  const itemsRef = useRef<UploadItem[]>([]);
  const [items, setItems] = useState<UploadItem[]>([]);
  const nextId = useRef(1);
  const running = useRef(false);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const commit = useCallback((next: UploadItem[]) => {
    itemsRef.current = next;
    setItems(next);
  }, []);

  const patch = useCallback(
    (id: number, changes: Partial<UploadItem>) =>
      commit(itemsRef.current.map((it) => (it.id === id ? { ...it, ...changes } : it))),
    [commit],
  );

  const uploadOne = useCallback(
    async (item: UploadItem) => {
      const onProgress = (pct: number) => patch(item.id, { progress: pct });
      // 영상은 분할 업로드(긴 단일 요청이 와이파이 등에서 끊김 — multipartUpload.ts 참고), 사진은 단일 PUT.
      // 분할 업로드는 실패해도 이어 올리기 기록이 남아, retry 시 빠진 조각만 올린다.
      let uploaded: { public_url: string; category: string };
      if (shouldUseMultipart(item.file)) {
        uploaded = await uploadMultipart(item.file, onProgress);
      } else {
        const presign = await presignMedia(item.file.type, item.file.name);
        await uploadToPresigned(presign.upload_url, item.file, onProgress);
        uploaded = presign;
      }
      patch(item.id, { phase: "creating", progress: 100 });
      await createClimbingLog({
        ...item.payload,
        media_url: uploaded.public_url,
        media_type: uploaded.category,
      });
    },
    [patch],
  );

  // 대기 항목이 없어질 때까지 한 건씩 처리. 동시에 두 루프가 돌지 않게 running 으로 막는다.
  const pump = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      for (;;) {
        const item = itemsRef.current.find((it) => it.phase === "pending");
        if (!item) break;
        patch(item.id, { phase: "uploading", progress: 0, error: undefined });
        try {
          await uploadOne(item);
          patch(item.id, { phase: "done" });
        } catch (e) {
          patch(item.id, {
            phase: "error",
            error: e instanceof Error ? e.message : "업로드에 실패했습니다",
          });
        }
      }
    } finally {
      running.current = false;
    }
    // 모두 성공했으면 완료 표시를 잠깐 보여준 뒤 정리. 실패가 있으면 사용자가 닫을 때까지 유지.
    if (itemsRef.current.every((it) => it.phase === "done")) {
      clearTimer.current = setTimeout(() => {
        if (itemsRef.current.every((it) => it.phase === "done")) commit([]);
      }, 4000);
    }
  }, [patch, uploadOne, commit]);

  const enqueueUploads = useCallback(
    (entries: { file: File; payload: ClimbingLogCreateInput }[]) => {
      if (entries.length === 0) return;
      if (clearTimer.current) clearTimeout(clearTimer.current);
      // 이전 배치가 모두 끝난 상태면 완료 항목은 비우고 새로 시작 (n/총 표시가 새 배치 기준이 되게)
      const base = itemsRef.current.every((it) => it.phase === "done")
        ? []
        : itemsRef.current;
      const added = entries.map(({ file, payload }) => ({
        id: nextId.current++,
        file,
        payload,
        phase: "pending" as const,
        progress: 0,
      }));
      commit([...base, ...added]);
      void pump();
    },
    [commit, pump],
  );

  const startUpload = useCallback(
    (file: File, payload: ClimbingLogCreateInput) => enqueueUploads([{ file, payload }]),
    [enqueueUploads],
  );

  const retry = useCallback(() => {
    if (clearTimer.current) clearTimeout(clearTimer.current);
    commit(
      itemsRef.current.map((it) =>
        it.phase === "error" ? { ...it, phase: "pending", progress: 0, error: undefined } : it,
      ),
    );
    void pump();
  }, [commit, pump]);

  const dismiss = useCallback(() => {
    // 실패한 업로드를 포기 → 분할 업로드였다면 서버의 조각과 이어 올리기 기록 정리
    for (const it of itemsRef.current) {
      if (it.phase === "error" && shouldUseMultipart(it.file)) void abandonMultipart(it.file);
    }
    commit(itemsRef.current.filter((it) => it.phase !== "error" && it.phase !== "done"));
  }, [commit]);

  return (
    <UploadContext.Provider value={{ items, enqueueUploads, startUpload, dismiss, retry }}>
      {children}
    </UploadContext.Provider>
  );
}

// Provider 와 같은 파일에 두는 흔한 Context 패턴이라 Fast Refresh 최적화만
// 못 받을 뿐 실제 문제는 아님 (풀 리로드로 폴백되는 정도).
// eslint-disable-next-line react-refresh/only-export-components
export function useUpload(): UploadContextValue {
  const ctx = useContext(UploadContext);
  if (ctx === null) {
    throw new Error("useUpload must be used within UploadProvider");
  }
  return ctx;
}
