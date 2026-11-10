// 지연 로드 페이지를 받는 동안의 자리 표시 (감사 M6). 탭 페이지는 미리 받아 두므로 대부분 안 보인다.
export default function PageFallback({ fullScreen = false }: { fullScreen?: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center justify-center ${fullScreen ? "min-h-dvh" : "py-16"}`}
    >
      <p className="text-sm text-muted">불러오는 중...</p>
    </div>
  );
}
