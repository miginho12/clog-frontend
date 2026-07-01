import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ClimbingLog } from "../api/client";
import { colorInfo, colorLabel } from "../lib/colorMap";

// 피드/목록의 단일 기록 카드.
// 작성자 표시는 백엔드 author join 추가 후 (현재 미지원).

function formatDate(d: string): string {
  // "2026-06-26" → "2026. 6. 26."
  const [y, m, day] = d.split("-");
  return `${y}. ${Number(m)}. ${Number(day)}.`;
}

export default function ClimbingLogCard({
  log,
  mine = false,
  onDelete,
}: {
  log: ClimbingLog;
  mine?: boolean;
  onDelete?: (id: string) => void;
}) {
  const navigate = useNavigate();
  const isVScale = log.grade_system === "v_scale";
  const ci = isVScale ? null : colorInfo(log.grade_raw);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      {/* 작성자 (클릭 → 프로필) */}
      {log.author && (
        <button
          onClick={() => navigate(`/users/${log.author!.id}`)}
          className="mb-3 flex items-center gap-2 transition hover:opacity-70"
        >
          {log.author.profile_image_url ? (
            <img
              src={log.author.profile_image_url}
              alt={log.author.nickname}
              className="h-7 w-7 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-xs text-gray-500">
              {log.author.nickname.slice(0, 1)}
            </span>
          )}
          <span className="text-sm font-medium text-gray-800">
            {log.author.nickname}
          </span>
        </button>
      )}

      {/* 상단: 그레이드 배지 + 완등여부 + (내 글 표시) */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="rounded-lg px-2.5 py-1 text-sm font-medium"
            style={
              isVScale
                ? { backgroundColor: "#D85A30", color: "#fff" }
                : { backgroundColor: ci!.bg, color: ci!.fg }
            }
          >
            {isVScale ? log.grade_raw : colorLabel(log.grade_raw)}
          </span>
          {log.is_success ? (
            <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
              완등
            </span>
          ) : (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
              시도
            </span>
          )}
          {log.visibility === "private" && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-400">
              비공개
            </span>
          )}
        </div>
        {mine && (
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#FAECE7] px-2 py-0.5 text-xs text-[#D85A30]">
              내 기록
            </span>
            <button
              type="button"
              onClick={() =>
                navigate(`/feed/edit/${log.id}`, { state: { log } })
              }
              className="text-xs text-gray-400 hover:text-gray-700"
            >
              수정
            </button>
            <button
              type="button"
              onClick={() => onDelete?.(log.id)}
              className="text-xs text-gray-400 hover:text-red-600"
            >
              삭제
            </button>
          </div>
        )}
      </div>

      {/* 짐 + 날짜 + 시도 */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
        {log.gym_name && <span className="text-gray-700">{log.gym_name}</span>}
        <span>{formatDate(log.climbed_at)}</span>
        <span>시도 {log.attempts}회</span>
      </div>

      {/* 미디어 (이미지/영상) */}
      {log.media_url && (
        <div className="mt-3">
          {log.media_type === "video" ? (
            <AutoPlayVideo src={log.media_url} />
          ) : (
            <img
              src={log.media_url}
              alt="기록 미디어"
              loading="lazy"
              className="max-h-96 w-full rounded-lg border border-gray-200 object-cover"
            />
          )}
        </div>
      )}

      {/* 코멘트 */}
      {log.comment && (
        <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">
          {log.comment}
        </p>
      )}

      {/* 카테고리 태그 */}
      {log.categories.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {log.categories.map((c) => (
            <span
              key={c}
              className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
            >
              #{c}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}


// 뷰포트에 보이면 자동재생, 벗어나면 정지 + 미니멀 커스텀 컨트롤 (인스타 스타일)
function AutoPlayVideo({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0); // 0~100

  // 뷰포트 자동재생/정지
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      { threshold: 0.6 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  // 재생/정지 토글 (영상 탭)
  function togglePlay() {
    const video = ref.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  }

  // 음소거 토글
  function toggleMute(e: React.MouseEvent) {
    e.stopPropagation();
    const video = ref.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  }

  // 진행바 클릭으로 시크
  function handleSeek(e: React.MouseEvent<HTMLDivElement>) {
    e.stopPropagation();
    const video = ref.current;
    if (!video || !video.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    video.currentTime = ratio * video.duration;
  }

  return (
    <div className="group relative overflow-hidden rounded-lg border border-gray-200 bg-black">
      <video
        ref={ref}
        src={src}
        muted={muted}
        loop
        playsInline
        onClick={togglePlay}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          if (v.duration) setProgress((v.currentTime / v.duration) * 100);
        }}
        className="w-full cursor-pointer"
      />

      {/* 일시정지 시 가운데 재생 아이콘 */}
      {!playing && (
        <button
          type="button"
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </button>
      )}

      {/* 음소거 버튼 (우하단) */}
      <button
        type="button"
        onClick={toggleMute}
        className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur transition hover:bg-black/70"
      >
        {muted ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
          </svg>
        )}
      </button>

      {/* 하단 얇은 진행바 (클릭 시크) */}
      <div
        onClick={handleSeek}
        className="absolute bottom-0 left-0 right-0 h-1 cursor-pointer bg-white/25"
      >
        <div
          className="h-full bg-white"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
