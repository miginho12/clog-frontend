import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getNotifications,
  markAllNotificationsRead,
  getClimbingLog,
  listComments,
  ApiError,
  type Notification,
} from "../api/client";
import { avatarGradient } from "../lib/avatarGradient";

// 알림 목록 페이지.
// 진입 시 목록 로드 + 전체 읽음 처리(read-all).
// 타입별 문구, 클릭 시 해당 게시물로 이동.

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

function actionText(type: Notification["type"]): string {
  switch (type) {
    case "post_like":
      return "님이 회원님의 게시물을 좋아합니다.";
    case "post_comment":
      return "님이 회원님의 게시물에 댓글을 남겼습니다.";
    case "comment_reply":
      return "님이 회원님의 댓글에 답글을 남겼습니다.";
    case "follow":
      return "님이 회원님을 팔로우했습니다.";
    case "follow_request":
      return "님이 회원님에게 팔로우를 요청했습니다.";
    case "follow_accept":
      return "님이 회원님의 팔로우 요청을 수락했습니다.";
    case "media_ready":
      return "님의 영상 처리가 완료되었습니다.";
    case "media_failed":
      return "님의 영상 처리에 실패했습니다.";
    default:
      return "님의 새 알림이 있습니다.";
  }
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [navigatingId, setNavigatingId] = useState<string | null>(null);

  // 게시물/댓글 알림 클릭 시, 실제로 아직 존재하는지 먼저 확인한다.
  // 삭제된 게시물/댓글을 가리키는 알림이면 안내 후 메인 피드로 보낸다.
  async function handleClick(n: Notification) {
    if (n.type === "follow_request") {
      navigate("/follow-requests");
      return;
    }
    if (n.type === "follow" || n.type === "follow_accept" || !n.climbing_log_id) {
      navigate(`/users/${n.actor?.id}`);
      return;
    }
    if (n.type === "media_failed") {
      // 트랜스코딩 실패 게시물은 media_status=failed 라 피드/프로필 어디에도
      // 안 보인다(list_feed 필터) — 존재는 하지만 이동해봐야 아무것도 없어
      // 보이니, 바로 안내만 하고 피드로 보낸다.
      navigate("/feed", {
        state: { toast: "영상 처리에 실패해 게시되지 않았어요. 다시 올려주세요." },
      });
      return;
    }

    setNavigatingId(n.id);
    try {
      await getClimbingLog(n.climbing_log_id);
    } catch (err) {
      setNavigatingId(null);
      if (err instanceof ApiError && err.status === 404) {
        navigate("/feed", { state: { toast: "삭제된 게시물입니다" } });
      } else {
        navigate(`/feed?start=${n.climbing_log_id}`);
      }
      return;
    }

    if (
      n.comment_id &&
      (n.type === "post_comment" || n.type === "comment_reply")
    ) {
      try {
        const res = await listComments(n.climbing_log_id);
        const exists = res.items.some(
          (t) =>
            t.comment.id === n.comment_id ||
            t.replies.some((r) => r.id === n.comment_id),
        );
        if (!exists) {
          setNavigatingId(null);
          navigate(`/feed?start=${n.climbing_log_id}`, {
            state: { toast: "삭제된 댓글입니다" },
          });
          return;
        }
      } catch {
        // 댓글 목록 조회 실패는 무시하고 게시물로만 이동
      }
    }

    setNavigatingId(null);
    navigate(`/feed?start=${n.climbing_log_id}`);
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await getNotifications();
        if (!alive) return;
        setItems(res.items);
        if (res.unread_count > 0) {
          markAllNotificationsRead().catch(() => {});
        }
      } catch {
        if (alive) setError(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <p className="py-10 text-center text-sm text-muted">불러오는 중...</p>
    );
  }

  if (error) {
    return (
      <div className="rounded-card-lg bg-danger-tint px-6 py-16 text-center">
        <p className="text-sm text-danger">알림을 불러오지 못했습니다.</p>
        <button
          onClick={() => location.reload()}
          className="mt-3 text-xs font-bold text-secondary underline"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center px-10 py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-primary-tint">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#B49CF0" strokeWidth="2" strokeLinecap="round">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.7 21a1.9 1.9 0 0 1-3.4 0" />
          </svg>
        </div>
        <p className="mt-4 text-[16px] font-extrabold text-title">
          아직 알림이 없어요
        </p>
      </div>
    );
  }

  return (
    <div>
      <span className="text-[16px] font-extrabold text-title">알림</span>
      <div className="mt-3 flex flex-col gap-1">
        {items.map((n) => (
          <button
            key={n.id}
            onClick={() => handleClick(n)}
            disabled={navigatingId === n.id}
            className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition disabled:opacity-60 ${
              n.is_read ? "" : "bg-primary-tint/50"
            }`}
          >
            {n.actor?.profile_image_url ? (
              <img
                src={n.actor.profile_image_url}
                alt={n.actor.nickname}
                className="h-10 w-10 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ background: avatarGradient(n.actor?.id ?? "?") }}
              >
                {n.actor?.nickname.slice(0, 1) ?? "?"}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-body">
                <span className="font-bold text-title">
                  {n.actor?.nickname ?? "알 수 없음"}
                </span>
                {actionText(n.type)}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {timeAgo(n.created_at)}
              </p>
            </div>
            {!n.is_read && (
              <span className="h-2 w-2 shrink-0 rounded-full bg-accent" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
