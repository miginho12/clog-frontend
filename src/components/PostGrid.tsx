import { useNavigate } from "react-router-dom";
import type { ClimbingLog } from "../api/client";
import { colorInfo } from "../lib/colorMap";

// 프로필용 3열 썸네일 그리드 (인스타식).
// 미디어 있으면 이미지/영상 썸네일, 없으면 그레이드 색 타일.
// 썸네일 클릭 → 게시물 상세(/feed/:id).

function GradeTile({ log }: { log: ClimbingLog }) {
  const isVScale = log.grade_system === "v_scale";
  const ci = isVScale ? null : colorInfo(log.grade_raw);
  const bg = ci?.bg ?? "#FAECE7";
  const fg = ci?.fg ?? "#D85A30";
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

export default function PostGrid({ logs }: { logs: ClimbingLog[] }) {
  const navigate = useNavigate();

  if (logs.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
        <p className="text-sm text-gray-500">아직 게시물이 없어요.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-1 sm:gap-2">
      {logs.map((log) => (
        <button
          key={log.id}
          onClick={() => navigate(`/feed/${log.id}`)}
          className="relative aspect-square overflow-hidden rounded-lg bg-gray-100 transition hover:opacity-90"
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
