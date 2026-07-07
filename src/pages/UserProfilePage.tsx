import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getMe,
  getUser,
  listClimbingLogs,
  getFollowers,
  getFollowing,
  getUserStats,
  ApiError,
  type ClimbingLog,
  type PublicUser,
  type ProfileStats,
} from "../api/client";
import { clearTokens, isAuthenticated } from "../lib/auth";
import PostGrid from "../components/PostGrid";
import FollowableAvatar from "../components/FollowableAvatar";
import { colorLabel, colorInfo } from "../lib/colorMap";

// 공용 프로필 페이지 (/users/:id).
// 내 프로필이면 수정/로그아웃, 남이면 (팔로우는 Phase 4) 표시만.
// 헤더(아바타 + 닉네임 + bio + 게시물수) + 3열 그리드.

interface ProfileView {
  id: string;
  nickname: string;
  profile_image_url: string | null;
  bio: string | null;
}

export default function UserProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<ProfileView | null>(null);
  const [logs, setLogs] = useState<ClimbingLog[]>([]);
  const [isMe, setIsMe] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    async function load(userId: string) {
      try {
        let me: PublicUser | null = null;
        if (isAuthenticated()) {
          try {
            const m = await getMe();
            me = m;
          } catch {
            // 토큰 만료 등 — 무시하고 공개 프로필로
          }
        }
        const mine = me?.id === userId;
        if (cancelled) return;
        setIsMe(mine);
        setMyId(me?.id ?? null);

        const p: ProfileView = mine
          ? {
              id: me!.id,
              nickname: me!.nickname,
              profile_image_url: me!.profile_image_url,
              bio: me!.bio,
            }
          : await getUser(userId);
        if (cancelled) return;
        setProfile(p);

        const res = await listClimbingLogs({
          author_id: userId,
          page_size: 50,
        });
        if (cancelled) return;
        setLogs(res.items);

        // 팔로워/팔로잉 카운트 + 내 팔로우 여부
        const [followers, following] = await Promise.all([
          getFollowers(userId),
          getFollowing(userId),
        ]);
        if (cancelled) return;
        setFollowerCount(followers.total);
        setFollowingCount(following.total);

        // 클라이머 통계
        try {
          const st = await getUserStats(userId);
          if (!cancelled) setStats(st);
        } catch {
          // 통계 실패는 치명적이지 않음
        }
        if (me && !mine) {
          setIsFollowing(followers.users.some((u) => u.id === me!.id));
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setError("비공개 프로필이거나 존재하지 않는 사용자예요.");
        } else if (err instanceof ApiError && err.status === 401) {
          navigate("/login");
        } else {
          setError("프로필을 불러오지 못했습니다.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load(id);
    return () => {
      cancelled = true;
    };
  }, [id, navigate]);

  function handleLogout() {
    clearTokens();
    navigate("/login");
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center">
        <p className="text-sm text-gray-400">불러오는 중...</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center">
        <p className="text-sm text-gray-600">{error ?? "프로필 없음"}</p>
        <button
          onClick={() => navigate("/feed")}
          className="mt-3 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-50"
        >
          피드로 돌아가기
        </button>
      </div>
    );
  }

  const initial = profile.nickname.charAt(0).toUpperCase();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-5">
          {!isMe && myId ? (
            <FollowableAvatar
              userId={profile.id}
              nickname={profile.nickname}
              profileImageUrl={profile.profile_image_url}
              initialFollowing={isFollowing}
              onChange={(following, count) => {
                setIsFollowing(following);
                setFollowerCount(count);
              }}
            />
          ) : profile.profile_image_url ? (
            <img
              src={profile.profile_image_url}
              alt={profile.nickname}
              className="h-20 w-20 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-[#FAECE7] text-2xl font-medium text-[#D85A30]">
              {initial}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-medium text-gray-900">
              {profile.nickname}
            </h1>
            <div className="mt-1 flex gap-4 text-sm text-gray-600">
              <span>
                <span className="font-semibold text-gray-900">
                  {logs.length}
                </span>{" "}
                게시물
              </span>
              <button
                onClick={() => navigate(`/users/${profile.id}/followers`)}
                className="transition hover:text-gray-900"
              >
                <span className="font-semibold text-gray-900">
                  {followerCount}
                </span>{" "}
                팔로워
              </button>
              <button
                onClick={() => navigate(`/users/${profile.id}/following`)}
                className="transition hover:text-gray-900"
              >
                <span className="font-semibold text-gray-900">
                  {followingCount}
                </span>{" "}
                팔로잉
              </button>
            </div>
          </div>
        </div>

        {profile.bio && (
          <p className="mt-4 whitespace-pre-wrap text-sm text-gray-700">
            {profile.bio}
          </p>
        )}

        {/* 클라이머 통계 */}
        {stats && stats.total_count > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-gray-50 px-3 py-2.5 text-center">
              <div className="text-lg font-semibold text-gray-900">
                {stats.success_count}
              </div>
              <div className="text-xs text-gray-500">완등</div>
            </div>
            <div className="rounded-xl bg-gray-50 px-3 py-2.5 text-center">
              <div className="text-lg font-semibold text-[#D85A30]">
                {stats.current_score.toFixed(1)}
              </div>
              <div className="text-xs text-gray-500">현재 지수</div>
            </div>
            {stats.top_grade && stats.top_grade_system === "color" ? (
              <div
                className="flex flex-col justify-center rounded-xl px-3 py-2.5 text-center"
                style={{
                  backgroundColor: colorInfo(stats.top_grade).bg,
                  color: colorInfo(stats.top_grade).fg,
                }}
              >
                <div className="text-[11px] opacity-80">최고 등급</div>
                <div className="text-base font-bold">
                  {colorLabel(stats.top_grade)}
                </div>
                {stats.top_grade_gym && (
                  <div className="truncate text-[10px] opacity-70">
                    {stats.top_grade_gym}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col justify-center rounded-xl bg-gray-50 px-3 py-2.5 text-center">
                {stats.top_grade ? (
                  <div className="text-lg font-semibold text-gray-900">
                    {stats.top_grade}
                  </div>
                ) : (
                  <div className="text-lg font-semibold text-gray-300">-</div>
                )}
                <div className="text-xs text-gray-500">최고 등급</div>
              </div>
            )}
          </div>
        )}

        <div className="mt-5 flex gap-2">
          {isMe ? (
            <>
              <button
                onClick={() => navigate("/profile/edit")}
                className="h-[38px] flex-1 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                프로필 수정
              </button>
              <button
                onClick={handleLogout}
                className="h-[38px] flex-1 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                로그아웃
              </button>
            </>
          ) : !myId ? (
            <button
              onClick={() => navigate("/login")}
              className="h-[38px] flex-1 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              로그인하고 팔로우
            </button>
          ) : null}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium text-gray-500">게시물</h2>
        <PostGrid logs={logs} userId={id!} />
      </div>
    </div>
  );
}
