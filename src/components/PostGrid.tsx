import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ClimbingLog } from "../api/client";
import { colorInfo } from "../lib/colorMap";

// 프로필용 3열 썸네일 그리드 (인스타식).
// 미디어 있으면 이미지/영상 썸네일, 없으면 그레이드 색 타일.
// 썸네일 클릭 → 그 사용자 게시물 피드(/users/:userId/posts?start=:id).

// 게시물이 많으면 영상 썸네일 전부가 마운트와 동시에 preload="metadata"
// 요청을 쏘는데, 한꺼번에 여러 개가 걸리면 nginx 프록시가 버티지 못한다
// (AutoPlayVideo 개발 때도 같은 문제로 503 — 화면 밖 영상까지 동시 요청
// 금지 원칙). 뷰포트 근처에 올 때만 src 를 붙이는 지연 로딩 적용
// (2026-07-30 Android 실기기에서 그리드 썸네일 전체가 깨져 보이는 문제로 발견).
function VideoThumbnail({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video || shouldLoad) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px 0px" },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [shouldLoad]);

  // Android WebView(Capacitor 앱)는 preload="metadata" 만으로는 재생/seek 없이
  // 첫 프레임을 안 그리는 경우가 많아(2026-07-30 실기기 테스트에서 발견 —
  // 데스크톱/일반 브라우저는 정상). loadeddata 시 아주 살짝 seek 해서 프레임
  // 렌더링을 강제로 트리거한다.
  function forceFrame(e: React.SyntheticEvent<HTMLVideoElement>) {
    const video = e.currentTarget;
    if (video.currentTime === 0) {
      video.currentTime = 0.1;
    }
  }

  return (
    <video
      ref={ref}
      src={shouldLoad ? src : undefined}
      className="h-full w-full object-cover"
      muted
      playsInline
      preload="metadata"
      onLoadedData={forceFrame}
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
                <VideoThumbnail src={log.media_url} />
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
