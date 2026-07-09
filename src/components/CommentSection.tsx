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
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-xs text-gray-500">
              {c.author?.nickname.slice(0, 1) ?? "?"}
            </span>
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div className="rounded-2xl bg-gray-50 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-800">
                {c.author?.nickname ?? "알 수 없음"}
              </span>
              {c.is_pinned && (
                <span className="rounded bg-[#FAECE7] px-1.5 py-0.5 text-[10px] font-medium text-[#D85A30]">
                  고정
                </span>
              )}
            </div>
            <p className="mt-0.5 whitespace-pre-wrap text-sm text-gray-700">
              {c.content}
            </p>
          </div>
          <div className="mt-1 flex items-center gap-3 px-1 text-xs text-gray-400">
            <span>{timeAgo(c.created_at)}</span>
            <button
              onClick={toggleLike}
              disabled={likePending}
              className="flex items-center gap-1 font-medium hover:text-gray-600 disabled:opacity-60"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill={liked ? "#D85A30" : "none"}
                stroke={liked ? "#D85A30" : "currentColor"}
                strokeWidth="2.2"
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              {likeCount > 0 && (
                <span className={liked ? "text-[#D85A30]" : ""}>
                  {likeCount}
                </span>
              )}
            </button>
            {onReply && (
              <button
                onClick={() => onReply(c)}
                className="font-medium hover:text-gray-600"
              >
                답글
              </button>
            )}
            {c.is_mine && (
              <button
                onClick={() => onDelete(c.id)}
                className="font-medium hover:text-red-500"
              >
                삭제
              </button>
            )}
            {!c.is_mine && isAdmin && (
              <button
                onClick={() => onDelete(c.id)}
                className="font-medium text-red-500 hover:text-red-600"
                title="관리자 권한으로 삭제"
              >
                관리자 삭제
              </button>
            )}
            {c.can_pin && !isReply && onPin && (
              <button
                onClick={() => onPin(c)}
                className="font-medium hover:text-[#D85A30]"
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
        bare ? "px-4 py-2" : "rounded-2xl border border-gray-200 bg-white p-5"
      }
    >
      <h2 className="text-sm font-medium text-gray-900">
        댓글 {total > 0 && <span className="text-gray-500">{total}</span>}
      </h2>

      {loading ? (
        <p className="py-6 text-center text-sm text-gray-400">불러오는 중...</p>
      ) : threads.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">
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

      <div className="mt-4 border-t border-gray-100 pt-4">
        {replyTo && (
          <div className="mb-2 flex items-center justify-between rounded-lg bg-gray-50 px-3 py-1.5 text-xs text-gray-600">
            <span>
              <span className="font-medium">{replyTo.author?.nickname}</span>
              님에게 답글
            </span>
            <button
              onClick={() => setReplyTo(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              취소
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                handleSubmit();
              }
            }}
            placeholder={replyTo ? "답글 달기..." : "댓글 달기..."}
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#D85A30]"
          />
          <button
            onClick={handleSubmit}
            disabled={submitting || !text.trim()}
            className="rounded-lg bg-[#D85A30] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            등록
          </button>
        </div>
      </div>
    </div>
  );
}
