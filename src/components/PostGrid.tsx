import { useNavigate } from "react-router-dom";
import type { ClimbingLog } from "../api/client";
import { colorInfo } from "../lib/colorMap";

// 프로필용 3열 썸네일 그리드 (인스타식).
// 미디어 있으면 이미지/영상 썸네일, 없으면 그레이드 색 타일.
// 썸네일 클릭 → 그 사용자 게시물 피드(/users/:userId/posts?start=:id).

// 영상 그리드 썸네일은 <video> 태그로 프레임을 그려서 만들지 않는다 —
// Android WebView(Capacitor 앱)는 src 없거나 재생되지 않은 <video>를 "미디어
// 로드 실패" 아이콘으로 렌더링해서 데스크톱/일반 브라우저와 다르게 보인다
// (2026-07-30 실기기에서 두 차례 패치로도 재발). 대신 백엔드가 트랜스코딩 시
// ffmpeg로 미리 뽑아둔 정지 이미지(thumbnail_url)를 그냥 <img>로 보여준다 —
// 이미지 썸네일과 동일한 방식이라 WebView 차이가 아예 발생할 수 없다.
// thumbnail_url이 없으면(백필 전 구버전 영상) 회색 타일로만 대체.
function VideoThumbnail({ thumbnailUrl }: { thumbnailUrl: string | null | undefined }) {
  if (!thumbnailUrl) {
    return <div className="h-full w-full bg-segment" />;
  }
  return (
    <img
      src={thumbnailUrl}
      alt=""
      loading="lazy"
      className="h-full w-full object-cover"
    />
  );
}

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
                <VideoThumbnail thumbnailUrl={log.thumbnail_url} />
                <span className="absolute right-1.5 top-1.5 text-white drop-shadow">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
              </>
            ) : (
              <img
                src={log.media_url}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
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
