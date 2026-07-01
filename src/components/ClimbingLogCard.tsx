import LikeButton from "./LikeButton";
import AutoPlayVideo from "./AutoPlayVideo";
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

      {/* 좋아요 */}
      <div className="mt-3">
        <LikeButton
          logId={log.id}
          initialCount={log.like_count}
          initialLiked={log.liked_by_me}
        />
      </div>

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
