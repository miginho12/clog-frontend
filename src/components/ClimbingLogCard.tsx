import { useEffect, useState } from "react";
import LikeButton from "./LikeButton";
import AutoPlayVideo from "./AutoPlayVideo";
import { useNavigate } from "react-router-dom";
import type { ClimbingLog, CommentPreview } from "../api/client";
import { colorInfo, colorLabel } from "../lib/colorMap";
import { useCurrentUser } from "../lib/useCurrentUser";

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
  onOpenComments,
}: {
  log: ClimbingLog;
  mine?: boolean;
  onDelete?: (id: string) => void;
  onOpenComments?: (logId: string) => void;
}) {
  const navigate = useNavigate();
  const { isAdmin } = useCurrentUser();
  const [commentCount, setCommentCount] = useState(log.comment_count);
  const [topComment, setTopComment] = useState<CommentPreview | null>(
    log.top_comment,
  );

  // 부모(FeedPage)가 log 를 갱신하면 미리보기/카운트 동기화
  useEffect(() => {
    setCommentCount(log.comment_count);
    setTopComment(log.top_comment);
  }, [log.comment_count, log.top_comment]);
  const isVScale = log.grade_system === "v_scale";
  const ci = isVScale ? null : colorInfo(log.grade_raw);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      {/* 작성자 헤더 (왼쪽) + 내 글 액션 (우상단) */}
      <div className="mb-3 flex items-start justify-between">
        {log.author ? (
          <button
            onClick={() => navigate(`/users/${log.author!.id}`)}
            className="flex items-center gap-2 transition hover:opacity-70"
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
        ) : (
          <div />
        )}
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
        {!mine && isAdmin && onDelete && (
          <button
            type="button"
            onClick={() => onDelete(log.id)}
            className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-600 transition hover:bg-red-100"
            title="관리자 권한으로 삭제"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
            </svg>
            관리자 삭제
          </button>
        )}
      </div>

      {/* 상단: 그레이드 배지 + 완등여부 */}
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

      {/* 짐 + 날짜 + 시도 */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
        {log.gym_name && <span className="text-gray-700">{log.gym_name}</span>}
        <span>{formatDate(log.climbed_at)}</span>
        <span>시도 {log.attempts}회</span>
      </div>

      {/* 미디어 (이미지/영상) — 4:5 고정 규격 (로드 전에도 높이 확정) */}
      {log.media_url && (
        <div className="mt-3">
          {log.media_type === "video" ? (
            <AutoPlayVideo src={log.media_url} />
          ) : (
            <div className="aspect-[4/5] w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
              <img
                src={log.media_url}
                alt="기록 미디어"
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </div>
          )}
        </div>
      )}

      {/* 액션 바: 좋아요 + 댓글 아이콘 */}
      <div className="mt-3 flex items-center gap-4">
        <LikeButton
          logId={log.id}
          initialCount={log.like_count}
          initialLiked={log.liked_by_me}
        />
        <button
          onClick={() => onOpenComments?.(log.id)}
          className="flex items-center gap-1.5 text-sm text-gray-500 transition hover:text-gray-700"
          aria-label="댓글 보기"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
          {commentCount > 0 && <span>{commentCount}</span>}
        </button>
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

      {/* 댓글 미리보기 (top 댓글 + 아바타 + 좋아요/대댓글 수) */}
      {topComment && (
        <button
          onClick={() => onOpenComments?.(log.id)}
          className="mt-3 flex w-full items-start gap-2 border-t border-gray-100 pt-3 text-left"
        >
          {topComment.author?.profile_image_url ? (
            <img
              src={topComment.author.profile_image_url}
              alt={topComment.author.nickname}
              className="h-7 w-7 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs text-gray-500">
              {topComment.author?.nickname.slice(0, 1) ?? "?"}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-sm">
              <span className="font-medium text-gray-800">
                {topComment.author?.nickname ?? "알 수 없음"}
              </span>{" "}
              <span className="text-gray-700">{topComment.content}</span>
            </div>
            <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-400">
              {topComment.like_count > 0 && (
                <span>좋아요 {topComment.like_count}</span>
              )}
              {topComment.reply_count > 0 && (
                <span>답글 {topComment.reply_count}</span>
              )}
              {commentCount > 1 && (
                <span className="hover:text-gray-600">
                  댓글 {commentCount}개 모두 보기
                </span>
              )}
            </div>
          </div>
        </button>
      )}
    </div>
  );
}
