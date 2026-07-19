import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  listComments,
  createComment,
  deleteComment,
  likeComment,
  unlikeComment,
  setCommentPin,
  ApiError,
  type Comment,
  type CommentThread,
} from "../api/client";
import { isAuthenticated } from "../lib/auth";
import { useCurrentUser } from "../lib/useCurrentUser";
import { avatarGradient } from "../lib/avatarGradient";

// 게시물 상세의 댓글 영역.
// 스레드 렌더(최상위 + 대댓글 들여쓰기) + 작성 + 대댓글 + 삭제.
// 좋아요/고정은 Phase 3b/3d.

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR");
}

function CommentRow({
  c,
  onReply,
  onDelete,
  onPin,
  isReply,
  isAdmin,
}: {
  c: Comment;
  onReply?: (c: Comment) => void;
  onDelete: (id: string) => void;
  onPin?: (c: Comment) => void;
  isReply?: boolean;
  isAdmin?: boolean;
}) {
  const navigate = useNavigate();
  const [liked, setLiked] = useState(c.liked_by_me);
  const [likeCount, setLikeCount] = useState(c.like_count);
  const [likePending, setLikePending] = useState(false);

  async function toggleLike() {
    if (!isAuthenticated()) {
      navigate("/login");
      return;
    }
    if (likePending) return;
    const prevLiked = liked;
    const prevCount = likeCount;
    const next = !liked;
    setLiked(next);
    setLikeCount((n) => n + (next ? 1 : -1));
    setLikePending(true);
    try {
      const res = next
        ? await likeComment(c.id)
        : await unlikeComment(c.id);
      setLiked(res.liked);
      setLikeCount(res.like_count);
    } catch {
      setLiked(prevLiked);
      setLikeCount(prevCount);
    } finally {
      setLikePending(false);
    }
  }

  return (
    <div className={isReply ? "ml-10 mt-3" : "mt-4"}>
      <div className="flex gap-2.5">
        <button
          onClick={() => c.author && navigate(`/users/${c.author.id}`)}
          className="shrink-0"
        >
          {c.author?.profile_image_url ? (
            <img
              src={c.author.profile_image_url}
              alt={c.author.nickname}
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : (
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ background: avatarGradient(c.author?.id ?? "?") }}
            >
              {c.author?.nickname.slice(0, 1) ?? "?"}
            </span>
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div className="rounded-2xl bg-input px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-title">
                {c.author?.nickname ?? "알 수 없음"}
              </span>
              {c.is_pinned && (
                <span className="rounded bg-primary-tint px-1.5 py-0.5 text-[10px] font-bold text-primary">
                  고정
                </span>
              )}
            </div>
            <p className="mt-0.5 whitespace-pre-wrap text-sm text-body">
              {c.content}
            </p>
          </div>
          <div className="mt-1 flex items-center gap-3 px-1 text-xs text-muted">
            <span>{timeAgo(c.created_at)}</span>
            <button
              onClick={toggleLike}
              disabled={likePending}
              className="flex items-center gap-1 font-semibold hover:text-secondary disabled:opacity-60"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill={liked ? "#E86A5C" : "none"}
                stroke={liked ? "#E86A5C" : "currentColor"}
                strokeWidth="2.2"
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              {likeCount > 0 && (
                <span className={liked ? "text-accent" : ""}>
                  {likeCount}
                </span>
              )}
            </button>
            {onReply && (
              <button
                onClick={() => onReply(c)}
                className="font-semibold hover:text-secondary"
              >
                답글
              </button>
            )}
            {c.is_mine && (
              <button
                onClick={() => onDelete(c.id)}
                className="font-semibold hover:text-danger"
              >
                삭제
              </button>
            )}
            {!c.is_mine && isAdmin && (
              <button
                onClick={() => onDelete(c.id)}
                className="font-semibold text-danger hover:opacity-80"
                title="관리자 권한으로 삭제"
              >
                관리자 삭제
              </button>
            )}
            {c.can_pin && !isReply && onPin && (
              <button
                onClick={() => onPin(c)}
                className="font-semibold hover:text-primary"
              >
                {c.is_pinned ? "고정 해제" : "고정"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CommentSection({
  logId,
  bare = false,
}: {
  logId: string;
  bare?: boolean;
}) {
  const navigate = useNavigate();
  const { isAdmin } = useCurrentUser();
  const [threads, setThreads] = useState<CommentThread[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    try {
      const res = await listComments(logId);
      setThreads(res.items);
      setTotal(res.total);
    } catch {
      // 조회 실패는 조용히
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logId]);

  async function handleSubmit() {
    if (!isAuthenticated()) {
      navigate("/login");
      return;
    }
    const content = text.trim();
    if (!content || submitting) return;
    setSubmitting(true);
    try {
      await createComment(logId, content, replyTo?.id ?? null);
      setText("");
      setReplyTo(null);
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) navigate("/login");
      else alert("댓글 작성에 실패했습니다");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("이 댓글을 삭제할까요?")) return;
    try {
      await deleteComment(id);
      await load();
    } catch {
      alert("삭제에 실패했습니다");
    }
  }

  async function handlePin(c: Comment) {
    try {
      await setCommentPin(c.id, !c.is_pinned);
      await load(); // 고정 시 정렬이 바뀌므로 재조회
    } catch {
      alert("고정 처리에 실패했습니다");
    }
  }

  return (
    <div
      className={
        bare
          ? "px-4 py-2"
          : "rounded-card-lg bg-white p-5 shadow-[0_4px_20px_rgba(90,70,140,.07)]"
      }
    >
      <h2 className="text-[13px] font-extrabold text-title">
        댓글 {total > 0 && <span className="text-muted">{total}</span>}
      </h2>

      {loading ? (
        <p className="py-6 text-center text-sm text-muted">불러오는 중...</p>
      ) : threads.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">
          첫 댓글을 남겨보세요.
        </p>
      ) : (
        <div className="mt-1">
          {threads.map((t) => (
            <div key={t.comment.id}>
              <CommentRow
                c={t.comment}
                onReply={setReplyTo}
                onDelete={handleDelete}
                onPin={handlePin}
                isAdmin={isAdmin}
              />
              {t.replies.map((r) => (
                <CommentRow
                  key={r.id}
                  c={r}
                  onDelete={handleDelete}
                  isReply
                  isAdmin={isAdmin}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 border-t border-line pt-4">
        {replyTo && (
          <div className="mb-2 flex items-center justify-between rounded-input bg-input px-3 py-1.5 text-xs text-secondary">
            <span>
              <span className="font-bold">{replyTo.author?.nickname}</span>
              님에게 답글
            </span>
            <button
              onClick={() => setReplyTo(null)}
              className="text-muted hover:text-secondary"
            >
              취소
            </button>
          </div>
        )}
        <div className="flex items-center gap-2.5 rounded-pill bg-input px-4 py-2.5">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                handleSubmit();
              }
            }}
            placeholder={replyTo ? "답글 달기..." : "댓글 남기기…"}
            className="min-w-0 flex-1 bg-transparent text-[12.5px] text-title outline-none placeholder:text-muted"
          />
          <button
            onClick={handleSubmit}
            disabled={submitting || !text.trim()}
            aria-label="댓글 등록"
            className="shrink-0 disabled:opacity-40"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7C5CD8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m22 2-7 20-4-9-9-4z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
