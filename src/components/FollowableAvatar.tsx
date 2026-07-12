import { useState } from "react";
import { followUser, unfollowUser, ApiError } from "../api/client";

type FollowStatus = "none" | "pending" | "accepted";

interface Props {
  userId: string;
  nickname: string;
  profileImageUrl: string | null;
  initialStatus: FollowStatus;
  onChange?: (status: FollowStatus, followerCount: number) => void;
}

// 팔로우 가능한 아바타 (A+E 컨셉).
// - 아바타 자체가 팔로우 토글 (버튼 없음)
// - 팔로우 중이면 홀드 컬러 링 + 힌트 텍스트
export default function FollowableAvatar({
  userId,
  nickname,
  profileImageUrl,
  initialStatus,
  onChange,
}: Props) {
  const [statusVal, setStatusVal] = useState<FollowStatus>(initialStatus);
  const [loading, setLoading] = useState(false);
  const initial = nickname.charAt(0).toUpperCase();

  // 링 표시: accepted(팔로잉) 만. pending 은 '요청됨' 뱃지로 구분.
  const following = statusVal === "accepted";
  const pending = statusVal === "pending";

  async function toggle() {
    if (loading) return;
    const isActive = statusVal !== "none"; // accepted or pending → 해제
    const optimistic: FollowStatus = isActive ? "none" : "accepted";
    setStatusVal(optimistic);
    setLoading(true);
    try {
      if (isActive) {
        const res = await unfollowUser(userId);
        setStatusVal("none");
        onChange?.("none", res.follower_count);
      } else {
        const res = await followUser(userId);
        setStatusVal(res.follow_status); // accepted(공개) or pending(비공개)
        onChange?.(res.follow_status, res.follower_count);
      }
    } catch (err) {
      setStatusVal(statusVal); // 롤백
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
      className={`group relative block h-20 w-20 shrink-0 transition-transform active:scale-95 ${
        loading ? "opacity-60" : ""
      }`}
      aria-label={pending ? "요청됨" : following ? "팔로우 취소" : "팔로우"}
    >
        <span
          className={`absolute inset-0 rounded-full transition-opacity ${
            following ? "opacity-100" : "opacity-0"
          }`}
          style={{
            background:
              "conic-gradient(from 180deg, #D85A30, #F0A03C, #7C5CD8, #D85A30)",
          }}
        />
        <span
          className={`absolute inset-[3px] rounded-full bg-white transition-opacity ${
            following ? "opacity-100" : "opacity-0"
          }`}
        />
        {profileImageUrl ? (
          <img
            src={profileImageUrl}
            alt={nickname}
            className={`relative rounded-full object-cover transition-all ${
              following ? "m-[6px] h-[68px] w-[68px]" : "h-20 w-20"
            }`}
          />
        ) : (
          <div className={`relative flex items-center justify-center rounded-full bg-[#FAECE7] text-2xl font-medium text-[#D85A30] transition-all ${
            following ? "m-[6px] h-[68px] w-[68px]" : "h-20 w-20"
          }`}>
            {initial}
          </div>
        )}
        {pending && (
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gray-800 px-2 py-0.5 text-[9px] font-medium text-white">
            요청됨
          </span>
        )}
    </button>
  );
}
