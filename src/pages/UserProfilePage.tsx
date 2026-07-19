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
  followUser,
  unfollowUser,
  ApiError,
  type ClimbingLog,
  type PublicUser,
  type ProfileStats,
} from "../api/client";
import { clearTokens, isAuthenticated } from "../lib/auth";
import { useCurrentUser } from "../lib/useCurrentUser";
import { countFollowRequests } from "../api/client";
import PostGrid from "../components/PostGrid";
import { colorLabel, colorInfo } from "../lib/colorMap";
import { avatarGradient } from "../lib/avatarGradient";

// 공용 프로필 페이지 (/users/:id).
// 내 프로필이면 수정/로그아웃, 남이면 팔로우 버튼 표시.
// 헤더(아바타 + 닉네임 + bio + 게시물수) + 3열 그리드.

interface ProfileView {
  id: string;
  nickname: string;
  profile_image_url: string | null;
  bio: string | null;
  is_public: boolean;
}

type FollowStatus = "none" | "pending" | "accepted";

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
  const [followStatus, setFollowStatus] = useState<FollowStatus>("none");
  const [followBusy, setFollowBusy] = useState(false);
  const [requestCount, setRequestCount] = useState(0);
  const [followToast, setFollowToast] = useState<string | null>(null);
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

        // 본인이 비공개 계정이면 받은 요청 수 조회 (버튼 노출 판단)
        if (mine && p.is_public === false) {
          countFollowRequests()
            .then((c) => {
              if (!cancelled) setRequestCount(c);
            })
            .catch(() => {});
        }

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

  async function handleFollowToggle() {
    if (!profile) return;
    if (!myId) {
      navigate("/login");
      return;
    }
    if (followBusy) return;
    setFollowBusy(true);
    const prev = followStatus;
    const isActive = prev !== "none";
    try {
      if (isActive) {
        const res = await unfollowUser(profile.id);
        setFollowStatus("none");
        setFollowerCount(res.follower_count);
        setFollowToast(
          prev === "pending" ? "팔로우 요청을 취소했어요" : "팔로우를 취소했어요",
        );
      } else {
        const res = await followUser(profile.id);
        setFollowStatus(res.follow_status);
        setFollowerCount(res.follower_count);
        setFollowToast(
          res.follow_status === "pending"
            ? "팔로우 요청을 보냈어요"
            : "팔로우했어요",
        );
      }
      window.setTimeout(() => setFollowToast(null), 2000);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) navigate("/login");
    } finally {
      setFollowBusy(false);
    }
  }

  function handleLogout() {
    clearTokens();
    navigate("/login");
  }

  if (loading) {
    return (
      <div className="rounded-card border border-line bg-white px-6 py-16 text-center">
        <p className="text-sm text-muted">불러오는 중...</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="rounded-card border border-line bg-white px-6 py-16 text-center">
        <p className="text-sm text-secondary">{error ?? "프로필 없음"}</p>
        <button
          onClick={() => navigate("/feed")}
          className="mt-3 rounded-input border border-line px-4 py-2 text-sm text-secondary transition hover:bg-segment"
        >
          피드로 돌아가기
        </button>
      </div>
    );
  }

  const initial = profile.nickname.charAt(0).toUpperCase();

  return (
    <div className="mx-auto max-w-xl space-y-3.5">
      {followToast && (
        <div className="fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-full bg-title/90 px-4 py-2 text-sm font-medium text-white shadow-float">
          {followToast}
        </div>
      )}
      <div className="rounded-card bg-white p-6 text-center shadow-card">
        {profile.profile_image_url ? (
          <img
            src={profile.profile_image_url}
            alt={profile.nickname}
            className="mx-auto h-[76px] w-[76px] rounded-full object-cover"
          />
        ) : (
          <div
            className="mx-auto flex h-[76px] w-[76px] items-center justify-center rounded-full text-[28px] font-extrabold text-white"
            style={{ background: avatarGradient(profile.id) }}
          >
            {initial}
          </div>
        )}

        <h1 className="mt-3 truncate text-[18px] font-extrabold text-title">
          {profile.nickname}
        </h1>
        {profile.bio && (
          <p className="mt-0.5 whitespace-pre-wrap text-xs text-muted">
            {profile.bio}
          </p>
        )}

        <div className="mt-3.5 flex justify-center gap-[22px] text-xs text-secondary">
          <span>
            <b className="text-title">{logs.length}</b> 게시물
          </span>
          <button
            onClick={() => navigate(`/users/${profile.id}/followers`)}
            className="transition hover:text-title"
          >
            <b className="text-title">{followerCount}</b> 팔로워
          </button>
          <button
            onClick={() => navigate(`/users/${profile.id}/following`)}
            className="transition hover:text-title"
          >
            <b className="text-title">{followingCount}</b> 팔로잉
          </button>
        </div>

        {isAdmin && !isMe && (
          <div className="mt-4 rounded-2xl border border-danger-line bg-danger-tint p-3 text-left">
            <p className="mb-2 text-[11px] font-medium text-danger">
              관리자 · 사용자 관리
            </p>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-secondary">
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
                    ? "shrink-0 rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                    : "shrink-0 rounded-lg bg-danger px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                }
              >
                {banBusy ? "처리 중…" : banned ? "차단 해제" : "차단"}
              </button>
            </div>
          </div>
        )}

        {isMe && profile.is_public === false && requestCount > 0 && (
          <button
            onClick={() => navigate("/follow-requests")}
            className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-input bg-primary-tint py-2 text-sm font-medium text-primary transition hover:opacity-90"
          >
            받은 팔로우 요청 {requestCount}개
          </button>
        )}

        {isMe && isAdmin && (
          <button
            onClick={() => navigate("/admin")}
            className="mt-4 flex w-full items-center gap-2.5 rounded-2xl bg-title px-4 py-3.5"
          >
            <span className="rounded-[5px] bg-primary px-[7px] py-[3px] text-[9.5px] font-extrabold tracking-[.06em] text-white">
              ADMIN
            </span>
            <span className="flex-1 text-left text-[13.5px] font-bold text-white">
              어드민 콘솔 열기
            </span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.6)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        )}

        <div className="mt-4 flex gap-2">
          {isMe ? (
            <>
              <button
                onClick={() => navigate("/profile/edit")}
                className="h-[42px] flex-1 rounded-input bg-segment text-[13px] font-extrabold text-secondary transition hover:opacity-80"
              >
                회원정보 수정
              </button>
              <button
                onClick={handleLogout}
                className="h-[42px] flex-1 rounded-input bg-segment text-[13px] font-extrabold text-secondary transition hover:opacity-80"
              >
                로그아웃
              </button>
            </>
          ) : !myId ? (
            <button
              onClick={() => navigate("/login")}
              className="h-[42px] flex-1 rounded-input bg-segment text-[13px] font-extrabold text-secondary transition hover:opacity-80"
            >
              로그인하고 팔로우
            </button>
          ) : (
            <button
              onClick={handleFollowToggle}
              disabled={followBusy}
              className={
                "h-[42px] flex-1 rounded-input text-[13px] font-extrabold transition disabled:opacity-60 " +
                (followStatus === "none"
                  ? "bg-primary-gradient text-white shadow-[0_6px_16px_rgba(124,92,216,.28)]"
                  : "bg-segment text-secondary")
              }
            >
              {followStatus === "none"
                ? "팔로우"
                : followStatus === "pending"
                  ? "요청됨"
                  : "팔로잉"}
            </button>
          )}
        </div>
      </div>

      {/* 클라이머 통계 */}
      {stats && stats.total_count > 0 && (
        <div className="grid grid-cols-3 gap-2.5">
          <div className="rounded-[18px] bg-white px-2 py-3.5 text-center shadow-card">
            <div className="text-[19px] font-extrabold text-title">
              {stats.success_count}
            </div>
            <div className="text-[11px] text-muted">완등</div>
          </div>
          <div className="rounded-[18px] bg-white px-2 py-3.5 text-center shadow-card">
            <div className="text-[19px] font-extrabold text-accent">
              {stats.current_score.toFixed(1)}
            </div>
            <div className="text-[11px] text-muted">점수</div>
          </div>
          {stats.top_grade && stats.top_grade_system === "color" ? (
            <div
              className="rounded-[18px] px-2 py-3.5 text-center"
              style={{
                backgroundColor: colorInfo(stats.top_grade).bg,
                color: colorInfo(stats.top_grade).fg,
              }}
            >
              <div className="text-[15px] font-extrabold">
                {colorLabel(stats.top_grade)}
              </div>
              <div className="text-[11px] opacity-75">최고 등급</div>
              {stats.top_grade_gym && (
                <div className="truncate text-[10px] opacity-70">
                  {stats.top_grade_gym}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-[18px] bg-segment px-2 py-3.5 text-center">
              <div className="text-[15px] font-extrabold text-title">
                {stats.top_grade ?? "-"}
              </div>
              <div className="text-[11px] text-muted">최고 등급</div>
            </div>
          )}
        </div>
      )}

      <div>
        <h2 className="mb-2 text-sm font-bold text-title">게시물</h2>
        {!isMe && profile.is_public === false ? (
          <div className="rounded-card bg-white px-6 py-12 text-center shadow-card">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-segment">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9C93B5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="11" width="16" height="9" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
            </div>
            <p className="text-sm font-medium text-secondary">비공개 계정입니다</p>
            <p className="mt-1 text-xs text-muted">
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
