import { useState, type FormEvent } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { localLogin, kakaoLoginUrl, ApiError } from "../api/client";
import { saveTokens } from "../lib/auth";

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const verified = searchParams.get("verified");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await localLogin({ email, password });
      saveTokens(res.access_token, res.refresh_token);
      navigate("/feed");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("로그인 중 문제가 발생했습니다");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8">
        {/* 로고 */}
        <div className="flex items-center justify-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FAECE7] text-lg">
            🧗
          </span>
          <span className="text-xl font-medium text-gray-900">Clog</span>
        </div>
        <p className="mt-1 text-center text-sm text-gray-500">
          오르고, 기록하고, 성장하기
        </p>

        <form onSubmit={handleSubmit} className="mt-7">
          <label className="mb-1.5 block text-sm text-gray-500">이메일</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mb-3.5 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#D85A30]"
            placeholder="climber@clog.dev"
          />

          <label className="mb-1.5 block text-sm text-gray-500">비밀번호</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mb-5 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#D85A30]"
            placeholder="••••••••••••"
          />

          {verified === "success" && (
            <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
              ✅ 이메일 인증이 완료됐어요! 이제 로그인할 수 있어요.
            </div>
          )}
          {verified === "failed" && (
            <div className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
              인증 링크가 만료되었거나 유효하지 않아요. 다시 시도해 주세요.
            </div>
          )}
          {error && (
            <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="h-[42px] w-full rounded-lg bg-[#D85A30] text-[15px] font-medium text-white transition hover:bg-[#c44e28] disabled:opacity-60"
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>

        {/* 구분선 */}
        <div className="my-4 flex items-center gap-2.5">
          <span className="h-px flex-1 bg-gray-200" />
          <span className="text-xs text-gray-400">또는</span>
          <span className="h-px flex-1 bg-gray-200" />
        </div>

        {/* 카카오 로그인 */}
        <a
          href={kakaoLoginUrl()}
          className="flex h-[42px] w-full items-center justify-center gap-2 rounded-lg bg-[#FEE500] text-sm font-medium text-[#191600] transition hover:brightness-95"
        >
          카카오로 시작하기
        </a>

        <p className="mt-5 text-center text-sm text-gray-500">
          아직 계정이 없나요?{" "}
          <Link to="/signup" className="font-medium text-[#D85A30]">
            회원가입
          </Link>
        </p>
      </div>
    </div>
  );
}
