import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  banUser,
  getMe,
  getUser,
  unbanUser,
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
import { useCurrentUser } from "../lib/useCurrentUser";
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
  is_public: boolean;
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
  const [followStatus, setFollowStatus] = useState<"none" | "pending" | "accepted">("none");
  const [myId, setMyId] = useState<string | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const { isAdmin } = useCurrentUser();
  const [banned, setBanned] = useState(false);
  const [banBusy, setBanBusy] = useState(false);

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
              is_public: me!.is_public,
            }
          : await getUser(userId);
        setBanned(!!(p as PublicUser).is_banned);
        if (!mine) {
          setFollowStatus((p as PublicUser).follow_status ?? "none");
        }
        if (cancelled) return;
        setProfile(p);

        // 비공개 계정(타인)은 게시글을 볼 수 없음 → 조회 스킵(빈 배열)
        if (!mine && p.is_public === false) {
          setLogs([]);
        } else {
          const res = await listClimbingLogs({
            author_id: userId,
            page_size: 50,
          });
          if (cancelled) return;
          setLogs(res.items);
        }

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
        // 팔로우 상태는 getUser 의 follow_status 로 이미 세팅됨 (pending 포함)
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


  async function handleBanToggle() {
    const verb = banned ? "차단 해제" : "차단";
    if (!window.confirm(`${profile?.nickname} 님을 ${verb}할까요?`)) return;
    setBanBusy(true);
    try {
      const res = banned
        ? await unbanUser(profile!.id)
        : await banUser(profile!.id);
      setBanned(res.is_banned);
    } catch {
      alert(`${verb}에 실패했습니다`);
    } finally {
      setBanBusy(false);
    }
  }
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
              initialStatus={followStatus}
              onChange={(st, count) => {
                setFollowStatus(st);
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

        {isAdmin && !isMe && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="mb-2 text-[11px] font-medium text-red-700">
              관리자 · 사용자 관리
            </p>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-gray-600">
                {banned
                  ? "차단됨 — 로그인·활동이 모두 막혀 있습니다"
                  : "정상 활동 중"}
              </span>
              <button
                type="button"
                onClick={handleBanToggle}
                disabled={banBusy}
                className={
                  banned
                    ? "shrink-0 rounded-lg bg-gray-600 px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                    : "shrink-0 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                }
              >
                {banBusy ? "처리 중…" : banned ? "차단 해제" : "차단"}
              </button>
            </div>
          </div>
        )}

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
              <div className="text-xs text-gray-500">점수</div>
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

        {isMe && profile.is_public === false && (
          <button
            onClick={() => navigate("/follow-requests")}
            className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#FAECE7] py-2 text-sm font-medium text-[#D85A30] transition hover:opacity-90"
          >
            받은 팔로우 요청 보기
          </button>
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
        {!isMe && profile.is_public === false ? (
          <div className="rounded-2xl border border-gray-200 bg-white px-6 py-12 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="11" width="16" height="9" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-700">비공개 계정입니다</p>
            <p className="mt-1 text-xs text-gray-400">
              이 사용자의 게시물은 볼 수 없어요. 프로필 정보만 공개되어 있습니다.
            </p>
          </div>
        ) : (
          <PostGrid logs={logs} userId={id!} />
        )}
      </div>
    </div>
  );
}
