import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getMe, ApiError } from "../api/client";
import { clearTokens } from "../lib/auth";

// /profile → 내 공용 프로필(/users/:myId) 로 리다이렉트.
// 네비게이션 "프로필" 과 작성자 클릭이 같은 UserProfilePage 로 통일됨.
export default function ProfilePage() {
  const navigate = useNavigate();

  useEffect(() => {
    getMe()
      .then((me) => {
        navigate(`/users/${me.id}`, { replace: true });
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          clearTokens();
        }
        navigate("/login", { replace: true });
      });
  }, [navigate]);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center">
      <p className="text-sm text-gray-400">불러오는 중...</p>
    </div>
  );
}
