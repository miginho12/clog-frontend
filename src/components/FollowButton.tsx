import { useState } from "react";
import { followUser, unfollowUser, ApiError } from "../api/client";

interface Props {
  userId: string;
  initialFollowing: boolean;
  onChange?: (following: boolean, followerCount: number) => void;
  size?: "sm" | "md";
}

// 팔로우/언팔로우 토글 버튼. 낙관적 업데이트(즉시 UI 반영 후 API).
export default function FollowButton({
  userId,
  initialFollowing,
  onChange,
  size = "md",
}: Props) {
  const [following, setFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);

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
        // 인증 만료 등은 상위에서 처리
      }
    } finally {
      setLoading(false);
    }
  }

  const pad = size === "sm" ? "px-3 py-1 text-xs" : "px-4 py-1.5 text-sm";

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={
        `rounded-lg font-medium transition ${pad} ` +
        (following
          ? "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
          : "bg-[#D85A30] text-white hover:bg-[#c24d27]") +
        (loading ? " opacity-60" : "")
      }
    >
      {following ? "팔로잉" : "팔로우"}
    </button>
  );
}
