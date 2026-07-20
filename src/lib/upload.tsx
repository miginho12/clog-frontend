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

// 업로드 진행 단계
type UploadPhase = "uploading" | "creating" | "done" | "error";

interface UploadState {
  active: boolean; // 배너 표시 여부
  phase: UploadPhase;
  progress: number; // 0-100 (업로드 단계)
  fileName: string;
  isVideo: boolean;
  error?: string;
}

interface UploadContextValue {
  state: UploadState;
  // 파일 + 폼 데이터를 받아 백그라운드 업로드 시작.
  // 호출 즉시 반환(비동기 진행) → 호출측은 바로 페이지 이동 가능.
  startUpload: (file: File, payload: ClimbingLogCreateInput) => void;
  dismiss: () => void;
  // 실패 시 같은 파일/입력값으로 재시도 (폼을 다시 채울 필요 없이)
  retry: () => void;
}

const IDLE: UploadState = {
  active: false,
  phase: "done",
  progress: 0,
  fileName: "",
  isVideo: false,
};

const UploadContext = createContext<UploadContextValue | null>(null);

export function UploadProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<UploadState>(IDLE);
  // 실패 시 재시도용으로 마지막 업로드 입력을 기억해둔다 (폼 재입력 없이 재시도).
  const lastAttempt = useRef<{
    file: File;
    payload: ClimbingLogCreateInput;
  } | null>(null);

  const run = useCallback((file: File, payload: ClimbingLogCreateInput) => {
    lastAttempt.current = { file, payload };
    const isVideo = file.type.startsWith("video/");
    setState({
      active: true,
      phase: "uploading",
      progress: 0,
      fileName: file.name,
      isVideo,
    });

    void (async () => {
      try {
        const presign = await presignMedia(file.type, file.name);
        await uploadToPresigned(presign.upload_url, file, (pct) => {
          setState((s) =>
            s.phase === "uploading" ? { ...s, progress: pct } : s,
          );
        });
        setState((s) => ({ ...s, phase: "creating", progress: 100 }));
        await createClimbingLog({
          ...payload,
          media_url: presign.public_url,
          media_type: presign.category,
        });
        setState((s) => ({ ...s, phase: "done", active: true }));
        lastAttempt.current = null;
        setTimeout(() => setState(IDLE), 4000);
      } catch (e) {
        setState((s) => ({
          ...s,
          phase: "error",
          error: e instanceof Error ? e.message : "업로드에 실패했습니다",
        }));
      }
    })();
  }, []);

  const startUpload = useCallback(
    (file: File, payload: ClimbingLogCreateInput) => run(file, payload),
    [run],
  );

  const retry = useCallback(() => {
    const attempt = lastAttempt.current;
    if (attempt) run(attempt.file, attempt.payload);
  }, [run]);

  const dismiss = useCallback(() => {
    lastAttempt.current = null;
    setState(IDLE);
  }, []);

  return (
    <UploadContext.Provider value={{ state, startUpload, dismiss, retry }}>
      {children}
    </UploadContext.Provider>
  );
}

export function useUpload(): UploadContextValue {
  const ctx = useContext(UploadContext);
  if (ctx === null) {
    throw new Error("useUpload must be used within UploadProvider");
  }
  return ctx;
}
