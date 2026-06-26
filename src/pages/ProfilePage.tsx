import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMe, ApiError } from "../api/client";
import { clearTokens, type AuthUser } from "../lib/auth";

export default function ProfilePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          // 토큰 만료/무효 → 로그인으로
          clearTokens();
          navigate("/login");
        } else {
          setError("프로필을 불러오지 못했습니다");
        }
      });
  }, [navigate]);

  function handleLogout() {
    clearTokens();
    navigate("/login");
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center">
        <p className="text-sm text-gray-400">불러오는 중...</p>
      </div>
    );
  }

  const initial = user.nickname.charAt(0).toUpperCase();

  return (
    <div className="mx-auto max-w-sm">
      <div className="rounded-2xl border border-gray-200 bg-white p-8">
        {/* 아바타 */}
        <div className="flex flex-col items-center">
          {user.profile_image_url ? (
            <img
              src={user.profile_image_url}
              alt={user.nickname}
              className="h-20 w-20 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#FAECE7] text-2xl font-medium text-[#D85A30]">
              {initial}
            </div>
          )}
          <h1 className="mt-3 text-xl font-medium text-gray-900">
            {user.nickname}
          </h1>
          <p className="text-sm text-gray-500">{user.email}</p>
        </div>

        {/* 정보 */}
        <div className="mt-6 space-y-2 border-t border-gray-100 pt-5 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">가입 방식</span>
            <span className="text-gray-900">
              {user.auth_provider === "local" ? "이메일" : user.auth_provider}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">프로필 공개</span>
            <span className="text-gray-900">
              {user.is_public ? "공개" : "비공개"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">가입일</span>
            <span className="text-gray-900">
              {new Date(user.created_at).toLocaleDateString("ko-KR")}
            </span>
          </div>
        </div>

        {user.bio && (
          <p className="mt-4 rounded-lg bg-gray-50 px-3 py-2.5 text-sm text-gray-700">
            {user.bio}
          </p>
        )}

        <button
          onClick={handleLogout}
          className="mt-6 h-[42px] w-full rounded-lg border border-gray-200 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          로그아웃
        </button>
      </div>
    </div>
  );
}
