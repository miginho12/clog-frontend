import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { saveTokens } from "../lib/auth";

// 카카오 OAuth 콜백 수신 페이지.
//
// 백엔드가 토큰을 URL fragment(#)에 담아 이 페이지로 리다이렉트한다.
//   /auth/callback#access_token=xxx&refresh_token=yyy&expires_in=3600&is_new=false
//
// fragment 는 JS 로만 읽을 수 있고 서버로 전송되지 않음 (보안).
export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;

    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (accessToken && refreshToken) {
      saveTokens(accessToken, refreshToken);
      navigate("/feed", { replace: true });
    } else {
      setError("로그인 정보를 받지 못했습니다. 다시 시도해주세요.");
    }
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
        <p className="text-sm text-red-600">{error}</p>
        <button
          onClick={() => navigate("/login", { replace: true })}
          className="mt-4 rounded-lg bg-[#D85A30] px-6 py-2 text-sm font-medium text-white"
        >
          로그인으로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-sm text-gray-400">로그인 처리 중...</p>
    </div>
  );
}
