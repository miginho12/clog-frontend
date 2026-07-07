import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getFollowers,
  getFollowing,
  getMe,
  ApiError,
  type FollowUserItem,
} from "../api/client";
import { isAuthenticated } from "../lib/auth";
import FollowButton from "../components/FollowButton";

interface Props {
  mode: "followers" | "following";
}

// 팔로워/팔로잉 목록 (/users/:id/followers, /users/:id/following).
export default function FollowListPage({ mode }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [users, setUsers] = useState<FollowUserItem[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    async function load(userId: string) {
      try {
        if (isAuthenticated()) {
          try {
            const me = await getMe();
            if (!cancelled) setMyId(me.id);
          } catch {
            // 무시
          }
        }
        const res =
          mode === "followers"
            ? await getFollowers(userId)
            : await getFollowing(userId);
        if (cancelled) return;
        setUsers(res.users);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          navigate("/login");
        } else {
          setError("목록을 불러오지 못했습니다.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load(id);
    return () => {
      cancelled = true;
    };
  }, [id, mode, navigate]);

  const title = mode === "followers" ? "팔로워" : "팔로잉";

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="rounded-lg p-1.5 text-gray-500 transition hover:bg-gray-100"
          aria-label="뒤로"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="text-lg font-medium text-gray-900">{title}</h1>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center">
          <p className="text-sm text-gray-400">불러오는 중...</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center">
          <p className="text-sm text-gray-600">{error}</p>
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center">
          <p className="text-sm text-gray-400">
            {mode === "followers"
              ? "아직 팔로워가 없어요"
              : "아직 팔로우한 클라이머가 없어요"}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white">
          {users.map((u) => {
            const initial = (u.nickname ?? "?").charAt(0).toUpperCase();
            const isMe = u.id === myId;
            return (
              <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                <button
                  onClick={() => navigate(`/users/${u.id}`)}
                  className="flex min-w-0 flex-1 items-center gap-3"
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
                    {u.nickname ?? "이름 없음"}
                  </span>
                </button>
                {myId && !isMe && (
                  <FollowButton
                    userId={u.id}
                    initialFollowing={u.is_following}
                    size="sm"
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
