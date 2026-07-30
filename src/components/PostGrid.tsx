import { useNavigate } from "react-router-dom";
import type { ClimbingLog } from "../api/client";
import { colorInfo } from "../lib/colorMap";

// Android WebView(Capacitor 앱)는 preload="metadata" 만으로는 재생/seek 없이
// 첫 프레임을 안 그리는 경우가 많아(2026-07-30 실기기 테스트에서 발견 —
// 데스크톱/일반 브라우저는 정상, 그리드 썸네일만 깨져 보임). loadeddata 시
// 아주 살짝 seek 해서 프레임 렌더링을 강제로 트리거한다.
function forceVideoFrame(e: React.SyntheticEvent<HTMLVideoElement>) {
  const video = e.currentTarget;
  if (video.currentTime === 0) {
    video.currentTime = 0.1;
  }
}

// 프로필용 3열 썸네일 그리드 (인스타식).
// 미디어 있으면 이미지/영상 썸네일, 없으면 그레이드 색 타일.
// 썸네일 클릭 → 그 사용자 게시물 피드(/users/:userId/posts?start=:id).

function GradeTile({ log }: { log: ClimbingLog }) {
  const isVScale = log.grade_system === "v_scale";
  const ci = isVScale ? null : colorInfo(log.grade_raw);
  const bg = ci?.bg ?? "#7C5CD8";
  const fg = ci?.fg ?? "#ffffff";
  return (
    <div
      className="flex h-full w-full items-center justify-center"
      style={{ backgroundColor: bg }}
    >
      <span className="text-lg font-semibold" style={{ color: fg }}>
        {isVScale ? log.grade_raw : ci?.label ?? log.grade_raw}
      </span>
    </div>
  );
}

export default function PostGrid({
  logs,
  userId,
}: {
  logs: ClimbingLog[];
  userId: string;
}) {
  const navigate = useNavigate();

  if (logs.length === 0) {
    return (
      <div className="rounded-card-lg bg-white px-6 py-12 text-center shadow-[0_2px_12px_rgba(90,70,140,.06)]">
        <p className="text-sm text-muted">아직 게시물이 없어요.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-1.5">
      {logs.map((log) => (
        <button
          key={log.id}
          onClick={() => navigate(`/users/${userId}/posts?start=${log.id}`)}
          className="relative aspect-square overflow-hidden rounded-tile bg-segment transition hover:opacity-90"
        >
          {log.media_url ? (
            log.media_type === "video" ? (
              <>
                <video
                  src={log.media_url}
                  className="h-full w-full object-cover"
                  muted
                  playsInline
                  preload="metadata"
                  onLoadedData={forceVideoFrame}
                />
                <span className="absolute right-1.5 top-1.5 text-white drop-shadow">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
              </>
            ) : (
              <img src={log.media_url} alt="" className="h-full w-full object-cover" />
            )
          ) : (
            <GradeTile log={log} />
          )}
          {!log.is_success && (
            <span className="absolute bottom-1.5 left-1.5 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white">
              시도
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
