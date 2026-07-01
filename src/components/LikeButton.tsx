import { useState } from "react";
import { likePost, unlikePost, ApiError } from "../api/client";
import { isAuthenticated } from "../lib/auth";
import { useNavigate } from "react-router-dom";

// 좋아요 버튼 — 낙관적 토글.
// 누르는 즉시 UI 반영, API 실패 시 롤백.
// 비로그인은 /login 으로 유도.

interface LikeButtonProps {
  logId: string;
  initialCount: number;
  initialLiked: boolean;
}

export default function LikeButton({
  logId,
  initialCount,
  initialLiked,
}: LikeButtonProps) {
  const navigate = useNavigate();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [pending, setPending] = useState(false);

  async function toggle() {
    if (!isAuthenticated()) {
      navigate("/login");
      return;
    }
    if (pending) return;

    const prevLiked = liked;
    const prevCount = count;
    const nextLiked = !liked;
    setLiked(nextLiked);
    setCount((c) => c + (nextLiked ? 1 : -1));
    setPending(true);

    try {
      const res = nextLiked ? await likePost(logId) : await unlikePost(logId);
      setLiked(res.liked);
      setCount(res.like_count);
    } catch (err) {
      setLiked(prevLiked);
      setCount(prevCount);
      if (err instanceof ApiError && err.status === 401) {
        navigate("/login");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      className="flex items-center gap-1.5 text-sm transition disabled:opacity-60"
      aria-label={liked ? "좋아요 취소" : "좋아요"}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill={liked ? "#D85A30" : "none"}
        stroke={liked ? "#D85A30" : "#9CA3AF"}
        strokeWidth="2"
        className="transition"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
      {count > 0 && (
        <span className={liked ? "text-[#D85A30]" : "text-gray-500"}>
          {count}
        </span>
      )}
    </button>
  );
}
