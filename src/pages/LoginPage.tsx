import { useState, type FormEvent } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { localLogin, kakaoLoginUrl, ApiError } from "../api/client";
import { saveTokens } from "../lib/auth";

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const verified = searchParams.get("verified");
  const resetSuccess = searchParams.get("reset") === "success";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="flex min-h-screen items-center justify-center bg-page-gradient px-8">
      <div className="w-full max-w-sm">
        {/* 로고 */}
        <div className="mb-5 flex h-[60px] w-[60px] items-center justify-center rounded-[19px] bg-hero-gradient shadow-[0_12px_28px_rgba(124,92,216,.35)]">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
          </svg>
        </div>
        <h1 className="text-[28px] font-extrabold leading-[1.25] tracking-[-1px] text-title">
          기록이 쌓이면,
          <br />
          실력이 보여요
          <span className="text-primary">.</span>
        </h1>

        <form onSubmit={handleSubmit} className="mt-[30px] flex flex-col gap-2.5">
          <label className="rounded-2xl bg-white px-[18px] py-3.5 shadow-[0_2px_10px_rgba(90,70,140,.07)]">
            <span className="block text-[11px] font-bold text-muted">이메일</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="climber@clog.dev"
              className="mt-0.5 w-full bg-transparent text-sm font-semibold text-title outline-none placeholder:font-normal placeholder:text-hint"
            />
          </label>

          <label className="flex items-center justify-between rounded-2xl bg-white px-[18px] py-3.5 shadow-[0_2px_10px_rgba(90,70,140,.07)]">
            <span className="flex-1">
              <span className="block text-[11px] font-bold text-muted">비밀번호</span>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••••••"
                className="mt-0.5 w-full bg-transparent text-sm font-bold tracking-[3px] text-title outline-none placeholder:font-normal placeholder:tracking-normal placeholder:text-hint"
              />
            </span>
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 표시"}
              className="shrink-0 text-hint"
            >
              {showPassword ? (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              ) : (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-6.5 0-10-7-10-7a19.6 19.6 0 0 1 4.22-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 7 10 7a19.5 19.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <path d="M1 1l22 22" />
                </svg>
              )}
            </button>
          </label>

          {verified === "success" && (
            <div className="rounded-2xl bg-success-tint px-4 py-3 text-sm text-success">
              이메일 인증이 완료됐어요! 이제 로그인할 수 있어요.
            </div>
          )}
          {resetSuccess && (
            <div className="rounded-2xl bg-success-tint px-4 py-3 text-sm text-success">
              비밀번호가 변경됐어요! 새 비밀번호로 로그인해 주세요.
            </div>
          )}
          {verified === "failed" && (
            <div className="rounded-2xl bg-danger-tint px-4 py-3 text-sm text-danger">
              인증 링크가 만료되었거나 유효하지 않아요. 다시 시도해 주세요.
            </div>
          )}
          {error && (
            <p className="rounded-2xl bg-danger-tint px-4 py-3 text-sm text-danger">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="bg-primary-gradient mt-1 rounded-2xl py-[15px] text-[14.5px] font-extrabold text-white shadow-[0_8px_20px_rgba(124,92,216,.3)] transition disabled:opacity-60"
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>

          <div className="my-1.5 flex items-center gap-2.5">
            <span className="h-px flex-1 bg-[#E4DFF0]" />
            <span className="text-[11px] font-semibold text-hint">또는</span>
            <span className="h-px flex-1 bg-[#E4DFF0]" />
          </div>

          <a
            href={kakaoLoginUrl()}
            className="flex items-center justify-center gap-2 rounded-2xl bg-[#FEE500] py-3.5 transition hover:brightness-95"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#3A2929">
              <path d="M12 3C6.5 3 2 6.6 2 11c0 2.8 1.9 5.3 4.7 6.7l-1 3.7c-.1.3.3.6.6.4l4.4-2.9c.4 0 .9.1 1.3.1 5.5 0 10-3.6 10-8S17.5 3 12 3z" />
            </svg>
            <span className="text-sm font-bold text-[#3A2929]">카카오로 시작하기</span>
          </a>
        </form>

        <div className="mt-5 flex justify-center gap-3.5 text-[12.5px]">
          <Link to="/forgot-password" className="text-muted">
            비밀번호 찾기
          </Link>
          <span className="text-[#E4DFF0]">|</span>
          <Link to="/signup" className="font-bold text-primary">
            회원가입
          </Link>
        </div>
      </div>
    </div>
  );
}
