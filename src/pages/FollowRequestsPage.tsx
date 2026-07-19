import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getFollowRequests,
  acceptFollowRequest,
  rejectFollowRequest,
  ApiError,
  type FollowUserItem,
} from "../api/client";
import { avatarGradient } from "../lib/avatarGradient";

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
      <div className="rounded-card-lg bg-white px-6 py-16 text-center shadow-[0_2px_10px_rgba(90,70,140,.07)]">
        <p className="text-sm text-muted">불러오는 중...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-title" aria-label="뒤로">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <span className="text-[16px] font-extrabold text-title">팔로우 요청</span>
      </div>

      {error && <p className="py-8 text-center text-sm text-danger">{error}</p>}

      {!error && items.length === 0 && (
        <p className="py-12 text-center text-sm text-muted">
          받은 팔로우 요청이 없어요.
        </p>
      )}

      <div className="mt-3.5 flex flex-col gap-2">
        {items.map((u) => {
          const initial = (u.nickname ?? "?").charAt(0).toUpperCase();
          const busy = busyId === u.id;
          return (
            <div
              key={u.id}
              className="flex items-center gap-3 rounded-card-lg bg-white px-4 py-3 shadow-[0_2px_12px_rgba(90,70,140,.06)]"
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
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base font-bold text-white"
                    style={{ background: avatarGradient(u.id) }}
                  >
                    {initial}
                  </div>
                )}
                <span className="truncate text-[13.5px] font-bold text-title">
                  {u.nickname}
                </span>
              </button>
              <div className="flex shrink-0 gap-1.5">
                <button
                  type="button"
                  onClick={() => handle(u.id, true)}
                  disabled={busy}
                  className="rounded-pill bg-primary px-3.5 py-1.5 text-xs font-bold text-white transition disabled:opacity-50"
                >
                  수락
                </button>
                <button
                  type="button"
                  onClick={() => handle(u.id, false)}
                  disabled={busy}
                  className="rounded-pill bg-segment px-3.5 py-1.5 text-xs font-bold text-secondary transition disabled:opacity-50"
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
