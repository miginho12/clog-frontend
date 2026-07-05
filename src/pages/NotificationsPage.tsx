import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getNotifications,
  markAllNotificationsRead,
  type Notification,
} from "../api/client";

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
  }
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

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
        // 조용히
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
      <p className="py-10 text-center text-sm text-gray-400">불러오는 중...</p>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center">
        <p className="text-sm text-gray-400">아직 알림이 없어요.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-3 text-lg font-medium text-gray-900">알림</h1>
      <div className="space-y-1">
        {items.map((n) => (
          <button
            key={n.id}
            onClick={() => navigate(`/feed?start=${n.climbing_log_id}`)}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-gray-50 ${
              n.is_read ? "" : "bg-[#FAECE7]/40"
            }`}
          >
            {n.actor?.profile_image_url ? (
              <img
                src={n.actor.profile_image_url}
                alt={n.actor.nickname}
                className="h-10 w-10 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm text-gray-500">
                {n.actor?.nickname.slice(0, 1) ?? "?"}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm text-gray-800">
                <span className="font-medium">
                  {n.actor?.nickname ?? "알 수 없음"}
                </span>
                {actionText(n.type)}
              </p>
              <p className="mt-0.5 text-xs text-gray-400">
                {timeAgo(n.created_at)}
              </p>
            </div>
            {!n.is_read && (
              <span className="h-2 w-2 shrink-0 rounded-full bg-[#D85A30]" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
