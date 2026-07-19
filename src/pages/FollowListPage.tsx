import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getFollowers,
  getFollowing,
  getMe,
  getUser,
  removeFollower,
  ApiError,
  type FollowUserItem,
} from "../api/client";
import { isAuthenticated } from "../lib/auth";
import { avatarGradient } from "../lib/avatarGradient";
import FollowButton from "../components/FollowButton";

interface Props {
  mode: "followers" | "following";
}

// 팔로워/팔로잉 목록 (/users/:id/followers, /users/:id/following).
export default function FollowListPage({ mode }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [ownerNickname, setOwnerNickname] = useState<string | null>(null);
  const [users, setUsers] = useState<FollowUserItem[]>([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [myId, setMyId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
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
        const [owner, followers, following] = await Promise.all([
          getUser(userId),
          getFollowers(userId),
          getFollowing(userId),
        ]);
        if (cancelled) return;
        setOwnerNickname(owner.nickname);
        setFollowerCount(followers.total);
        setFollowingCount(following.total);
        setUsers(mode === "followers" ? followers.users : following.users);
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

  // 내가 내 팔로워 목록을 보는 경우에만 팔로워를 끊어낼 수 있다.
  const isMyFollowersList = mode === "followers" && !!myId && myId === id;

  async function handleRemoveFollower(followerId: string, nickname: string) {
    if (!window.confirm(`${nickname}님을 팔로워에서 삭제할까요?`)) return;
    setRemovingId(followerId);
    try {
      await removeFollower(followerId);
      setUsers((prev) => prev.filter((u) => u.id !== followerId));
    } catch {
      alert("삭제에 실패했습니다.");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="flex items-center gap-3 px-1">
        <button
          onClick={() => navigate(-1)}
          className="text-title"
          aria-label="뒤로"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <span className="text-[16px] font-extrabold text-title">
          {ownerNickname ?? " "}
        </span>
      </div>

      {id && (
        <div className="mt-3.5 flex rounded-input bg-segment p-1">
          <button
            onClick={() => navigate(`/users/${id}/followers`)}
            className={
              "flex-1 rounded-[11px] py-[9px] text-center text-[13px] font-bold transition " +
              (mode === "followers"
                ? "bg-white text-title shadow-[0_1px_4px_rgba(90,70,140,.12)]"
                : "text-muted")
            }
          >
            팔로워 {followerCount}
          </button>
          <button
            onClick={() => navigate(`/users/${id}/following`)}
            className={
              "flex-1 rounded-[11px] py-[9px] text-center text-[13px] font-bold transition " +
              (mode === "following"
                ? "bg-white text-title shadow-[0_1px_4px_rgba(90,70,140,.12)]"
                : "text-muted")
            }
          >
            팔로잉 {followingCount}
          </button>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2">
        {loading ? (
          <div className="rounded-card-lg bg-white px-6 py-16 text-center shadow-[0_2px_12px_rgba(90,70,140,.06)]">
            <p className="text-sm text-muted">불러오는 중...</p>
          </div>
        ) : error ? (
          <div className="rounded-card-lg bg-white px-6 py-16 text-center shadow-[0_2px_12px_rgba(90,70,140,.06)]">
            <p className="text-sm text-secondary">{error}</p>
          </div>
        ) : users.length === 0 ? (
          <div className="rounded-card-lg bg-white px-6 py-16 text-center shadow-[0_2px_12px_rgba(90,70,140,.06)]">
            <p className="text-sm text-muted">
              {mode === "followers"
                ? "아직 팔로워가 없어요"
                : "아직 팔로우한 클라이머가 없어요"}
            </p>
          </div>
        ) : (
          users.map((u) => {
            const initial = (u.nickname ?? "?").charAt(0).toUpperCase();
            const isMe = u.id === myId;
            return (
              <div
                key={u.id}
                className="flex items-center gap-3 rounded-card-lg bg-white px-4 py-3.5 shadow-[0_2px_12px_rgba(90,70,140,.06)]"
              >
                <button
                  onClick={() => navigate(`/users/${u.id}`)}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  {u.profile_image_url ? (
                    <img
                      src={u.profile_image_url}
                      alt={u.nickname ?? ""}
                      className="h-10 w-10 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                      style={{ background: avatarGradient(u.id) }}
                    >
                      {initial}
                    </div>
                  )}
                  <span className="truncate text-[13.5px] font-bold text-title">
                    {u.nickname ?? "이름 없음"}
                  </span>
                </button>
                {isMyFollowersList && !isMe ? (
                  <button
                    type="button"
                    onClick={() =>
                      handleRemoveFollower(u.id, u.nickname ?? "이 사용자")
                    }
                    disabled={removingId === u.id}
                    className="shrink-0 rounded-pill bg-segment px-3.5 py-1.5 text-xs font-bold text-secondary transition disabled:opacity-50"
                  >
                    삭제
                  </button>
                ) : myId && !isMe ? (
                  <FollowButton
                    userId={u.id}
                    initialFollowing={u.is_following}
                    size="sm"
                  />
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
