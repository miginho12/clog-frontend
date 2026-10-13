import { useUpload } from "../lib/upload";

// 전역 업로드 진행 배너 — 하단 탭바 위에 상주.
// 업로드 중에도 사용자가 앱을 자유롭게 돌아다닐 수 있게 함.
// 여러 건이 대기열에 있으면 "n/총" 진행과 실패 건수를 요약해서 보여준다.
export default function UploadBanner() {
  const { items, dismiss, retry } = useUpload();
  if (items.length === 0) return null;

  const total = items.length;
  const current = items.find((it) => it.phase === "uploading" || it.phase === "creating");
  const failed = items.filter((it) => it.phase === "error");
  const doneCount = items.filter((it) => it.phase === "done").length;
  const busy = current !== undefined || items.some((it) => it.phase === "pending");
  const isError = !busy && failed.length > 0;
  const isDone = !busy && failed.length === 0;
  // 한 건이면 기존 문구 그대로, 여러 건이면 순번을 붙인다
  const seq = total > 1 && current ? ` (${items.indexOf(current) + 1}/${total})` : "";
  const failNote = failed.length > 0 ? ` · ${failed.length}개 실패` : "";

  let title = "";
  let subtitle = "";
  if (current?.phase === "uploading") {
    title = `업로드 중${seq}… ${current.progress}%`;
    subtitle = current.file.name + failNote;
  } else if (current?.phase === "creating") {
    title = `게시하는 중${seq}…`;
    subtitle = current.file.name + failNote;
  } else if (isDone) {
    const hasVideo = items.some((it) => it.file.type.startsWith("video/"));
    title = total > 1 ? `${total}개 업로드 완료` : hasVideo ? "업로드 완료" : "게시 완료";
    subtitle = hasVideo
      ? "영상 처리가 끝나면 알림으로 알려드릴게요"
      : "피드에 게시되었어요";
  } else if (isError) {
    title = total > 1 ? `${failed.length}개 업로드 실패 (${doneCount}개 완료)` : "업로드 실패";
    subtitle = failed[0].error ?? "다시 시도해 주세요";
  }

  return (
    <div className="mx-5 mb-2 rounded-2xl border border-line bg-white px-4 py-3 shadow-card">
      <div className="flex items-center gap-3">
        {/* 상태 아이콘 */}
        <div className="shrink-0">
          {busy ? (
            <svg className="h-5 w-5 animate-spin text-primary" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
            </svg>
          ) : isDone ? (
            <svg className="h-5 w-5 text-success" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 011.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="h-5 w-5 text-danger" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.7 7.3a1 1 0 00-1.4 1.4L8.6 10l-1.3 1.3a1 1 0 101.4 1.4L10 11.4l1.3 1.3a1 1 0 001.4-1.4L11.4 10l1.3-1.3a1 1 0 00-1.4-1.4L10 8.6 8.7 7.3z" clipRule="evenodd" />
            </svg>
          )}
        </div>
        {/* 텍스트 */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-title">{title}</p>
          <p className="truncate text-xs text-muted">{subtitle}</p>
        </div>
        {/* 에러 시 재시도, 완료/에러 시 닫기 */}
        {isError && (
          <button
            onClick={retry}
            className="shrink-0 rounded-lg bg-primary-tint px-2.5 py-1 text-xs font-bold text-primary hover:opacity-80"
          >
            재시도
          </button>
        )}
        {(isDone || isError) && (
          <button
            onClick={dismiss}
            className="shrink-0 rounded-lg px-2 py-1 text-xs text-muted hover:bg-segment"
          >
            닫기
          </button>
        )}
      </div>
      {/* 진행률 바 (업로드 중만) */}
      {current?.phase === "uploading" && (
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-segment">
          <div
            className="h-full rounded-full bg-primary transition-all duration-200"
            style={{ width: `${current.progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
