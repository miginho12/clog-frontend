import { useState } from "react";
import { followUser, unfollowUser, ApiError } from "../api/client";

interface Props {
  userId: string;
  nickname: string;
  profileImageUrl: string | null;
  initialFollowing: boolean;
  onChange?: (following: boolean, followerCount: number) => void;
}

// 팔로우 가능한 아바타 (A+E 컨셉).
// - 아바타 자체가 팔로우 토글 (버튼 없음)
// - 팔로우 중이면 홀드 컬러 링 + 힌트 텍스트
export default function FollowableAvatar({
  userId,
  nickname,
  profileImageUrl,
  initialFollowing,
  onChange,
}: Props) {
  const [following, setFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);
  const initial = nickname.charAt(0).toUpperCase();

  async function toggle() {
    if (loading) return;
    const next = !following;
    setFollowing(next);
    setLoading(true);
    try {
      const res = next
        ? await followUser(userId)
        : await unfollowUser(userId);
      setFollowing(res.following);
      onChange?.(res.following, res.follower_count);
    } catch (err) {
      setFollowing(!next);
      if (err instanceof ApiError && err.status === 401) {
        // 상위에서 처리
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`group relative shrink-0 transition-transform active:scale-95 ${
        loading ? "opacity-60" : ""
      }`}
      aria-label={following ? "팔로우 취소" : "팔로우"}
    >
        <span
          className={`absolute -inset-1 rounded-full transition-opacity ${
            following ? "opacity-100" : "opacity-0"
          }`}
          style={{
            background:
              "conic-gradient(from 180deg, #D85A30, #F0A03C, #7C5CD8, #D85A30)",
          }}
        />
        <span
          className={`absolute -inset-0.5 rounded-full bg-white transition-opacity ${
            following ? "opacity-100" : "opacity-0"
          }`}
        />
        {profileImageUrl ? (
          <img
            src={profileImageUrl}
            alt={nickname}
            className="relative h-20 w-20 rounded-full object-cover"
          />
        ) : (
          <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-[#FAECE7] text-2xl font-medium text-[#D85A30]">
            {initial}
          </div>
        )}
    </button>
  );
}
