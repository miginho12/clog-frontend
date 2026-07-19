import { useEffect, useState } from "react";
import LikeButton from "./LikeButton";
import AutoPlayVideo from "./AutoPlayVideo";
import { useNavigate } from "react-router-dom";
import type { ClimbingLog, CommentPreview } from "../api/client";
import { colorInfo, colorLabel } from "../lib/colorMap";
import { useCurrentUser } from "../lib/useCurrentUser";
import { avatarGradient } from "../lib/avatarGradient";

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
    <div className="rounded-card bg-white p-[18px] shadow-card">
      {/* 헤더: 아바타 + (닉네임 / 메타) — 우측에 내 글 액션 */}
      <div className="mb-3 flex items-start justify-between">
        {log.author ? (
          <div className="flex items-center gap-[10px]">
            <button
              onClick={() => navigate(`/users/${log.author!.id}`)}
              className="shrink-0 transition hover:opacity-70"
            >
              {log.author.profile_image_url ? (
                <img
                  src={log.author.profile_image_url}
                  alt={log.author.nickname}
                  className="h-[34px] w-[34px] rounded-full object-cover"
                />
              ) : (
                <span
                  className="flex h-[34px] w-[34px] items-center justify-center rounded-full text-[13px] font-bold text-white"
                  style={{ background: avatarGradient(log.author.id) }}
                >
                  {log.author.nickname.slice(0, 1)}
                </span>
              )}
            </button>
            <div>
              <button
                onClick={() => navigate(`/users/${log.author!.id}`)}
                className="block text-[13.5px] font-bold text-title transition hover:opacity-70"
              >
                {log.author.nickname}
              </button>
              <div className="text-[11px] text-muted">
                {log.gym_name && (
                  <>
                    <button
                      onClick={() =>
                        navigate(`/gyms/${encodeURIComponent(log.gym_name!)}`)
                      }
                      className="hover:text-primary hover:underline"
                    >
                      {log.gym_name}
                    </button>{" "}
                    ·{" "}
                  </>
                )}
                {formatDate(log.climbed_at)} · 시도 {log.attempts}회
              </div>
            </div>
          </div>
        ) : (
          <div />
        )}
        {mine && (
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-full bg-primary-tint px-2 py-0.5 text-xs text-primary">
              내 기록
            </span>
            <button
              type="button"
              onClick={() =>
                navigate(`/feed/edit/${log.id}`, { state: { log } })
              }
              className="text-xs text-muted hover:text-title"
            >
              수정
            </button>
            <button
              type="button"
              onClick={() => onDelete?.(log.id)}
              className="text-xs text-muted hover:text-danger"
            >
              삭제
            </button>
          </div>
        )}
        {!mine && isAdmin && onDelete && (
          <button
            type="button"
            onClick={() => onDelete(log.id)}
            className="flex shrink-0 items-center gap-1 rounded-full bg-danger-tint px-2 py-0.5 text-xs text-danger transition hover:opacity-80"
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

      {/* 뱃지 행: 그레이드 + 완등여부 */}
      <div className="flex items-center gap-1.5">
        <span
          className="rounded-full px-[11px] py-[5px] text-[12px] font-bold"
          style={
            isVScale
              ? { backgroundColor: "#7C5CD8", color: "#fff" }
              : { backgroundColor: ci!.bg, color: ci!.fg }
          }
        >
          {isVScale ? log.grade_raw : colorLabel(log.grade_raw)}
        </span>
        {log.is_success ? (
          <span className="rounded-full bg-success-tint px-[11px] py-[5px] text-[12px] font-bold text-success">
            완등
          </span>
        ) : (
          <span className="rounded-full bg-segment px-[11px] py-[5px] text-[12px] font-bold text-muted">
            시도
          </span>
        )}
        {log.visibility === "private" && (
          <span className="rounded-full bg-segment px-[11px] py-[5px] text-[12px] font-bold text-hint">
            비공개
          </span>
        )}
      </div>

      {/* 미디어 (이미지/영상) — 4:5 기준, 극단 비율만 clamp (로드 전에도 높이 확정) */}
      {log.media_url && (
        <div className="mt-3">
          {log.media_type === "video" ? (
            <AutoPlayVideo src={log.media_url} />
          ) : (
            <div className="aspect-[4/5] w-full overflow-hidden rounded-2xl bg-input">
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
          className="flex items-center gap-1.5 text-[13px] font-semibold text-secondary transition hover:text-title"
          aria-label="댓글 보기"
        >
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
          {commentCount > 0 && <span>{commentCount}</span>}
        </button>
      </div>

      {/* 코멘트 (본문) */}
      {log.comment && (
        <p className="mt-[10px] whitespace-pre-wrap text-[13px] leading-[1.5] text-body">
          {log.comment}
        </p>
      )}

      {/* 카테고리 태그 */}
      {log.categories.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {log.categories.map((c) => (
            <span key={c} className="text-[12.5px] font-bold text-primary">
              #{c}
            </span>
          ))}
        </div>
      )}

      {/* 댓글 미리보기 (top 댓글 + 아바타 + 좋아요/대댓글 수) */}
      {topComment && (
        <button
          onClick={() => onOpenComments?.(log.id)}
          className="mt-3 flex w-full items-start gap-2 border-t border-line pt-3 text-left"
        >
          {topComment.author?.profile_image_url ? (
            <img
              src={topComment.author.profile_image_url}
              alt={topComment.author.nickname}
              className="h-7 w-7 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{
                background: avatarGradient(topComment.author?.id ?? "?"),
              }}
            >
              {topComment.author?.nickname.slice(0, 1) ?? "?"}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-sm">
              <span className="font-bold text-title">
                {topComment.author?.nickname ?? "알 수 없음"}
              </span>{" "}
              <span className="text-body">{topComment.content}</span>
            </div>
            <div className="mt-0.5 flex items-center gap-3 text-xs text-hint">
              {topComment.like_count > 0 && (
                <span>좋아요 {topComment.like_count}</span>
              )}
              {topComment.reply_count > 0 && (
                <span>답글 {topComment.reply_count}</span>
              )}
              {commentCount > 1 && (
                <span className="hover:text-secondary">
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
