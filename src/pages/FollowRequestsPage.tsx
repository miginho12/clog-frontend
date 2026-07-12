import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getFollowRequests,
  acceptFollowRequest,
  rejectFollowRequest,
  ApiError,
  type FollowUserItem,
} from "../api/client";

// 팔로우 요청 화면 (/follow-requests) — 비공개 계정에게 온 pending 요청 관리.
export default function FollowRequestsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<FollowUserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getFollowRequests()
      .then((res) => {
        if (!alive) return;
        setItems(res.users);
        setLoading(false);
      })
      .catch((e) => {
        if (!alive) return;
        if (e instanceof ApiError && e.status === 401) {
          navigate("/login");
          return;
        }
        setError("요청을 불러오지 못했습니다.");
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [navigate]);

  async function handle(requesterId: string, accept: boolean) {
    setBusyId(requesterId);
    try {
      if (accept) await acceptFollowRequest(requesterId);
      else await rejectFollowRequest(requesterId);
      setItems((prev) => prev.filter((u) => u.id !== requesterId));
    } catch {
      alert(accept ? "수락에 실패했습니다." : "거절에 실패했습니다.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center">
        <p className="text-sm text-gray-400">불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-gray-400 transition hover:text-gray-700"
        >
          ←
        </button>
        <h1 className="text-lg font-semibold text-gray-900">팔로우 요청</h1>
      </div>

      {error && <p className="py-8 text-center text-sm text-red-500">{error}</p>}

      {!error && items.length === 0 && (
        <p className="py-12 text-center text-sm text-gray-400">
          받은 팔로우 요청이 없어요.
        </p>
      )}

      <div className="space-y-1">
        {items.map((u) => {
          const initial = (u.nickname ?? "?").charAt(0).toUpperCase();
          const busy = busyId === u.id;
          return (
            <div
              key={u.id}
              className="flex items-center gap-3 rounded-xl px-2 py-2"
            >
              <button
                onClick={() => navigate(`/users/${u.id}`)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                {u.profile_image_url ? (
                  <img
                    src={u.profile_image_url}
                    alt={u.nickname ?? ""}
                    className="h-11 w-11 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FAECE7] text-base font-medium text-[#D85A30]">
                    {initial}
                  </div>
                )}
                <span className="truncate text-sm font-medium text-gray-900">
                  {u.nickname}
                </span>
              </button>
              <div className="flex shrink-0 gap-1.5">
                <button
                  type="button"
                  onClick={() => handle(u.id, true)}
                  disabled={busy}
                  className="rounded-lg bg-[#D85A30] px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  수락
                </button>
                <button
                  type="button"
                  onClick={() => handle(u.id, false)}
                  disabled={busy}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
                >
                  거절
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
