import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { signup, ApiError } from "../api/client";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signup({ email, password, nickname });
      setSubmitted(true); // 인증 메일 안내 화면으로
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("회원가입 중 문제가 발생했습니다");
      }
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#FAECE7] text-2xl">
            📬
          </div>
          <h1 className="mt-4 text-lg font-medium text-gray-900">
            인증 메일을 보냈어요
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-gray-500">
            <span className="font-medium text-gray-700">{email}</span> 으로
            <br />
            인증 메일을 발송했어요.
            <br />
            메일함에서 인증을 완료하면 로그인할 수 있어요.
          </p>
          <p className="mt-3 text-xs text-gray-400">
            메일이 안 보이면 스팸함도 확인해 주세요.
          </p>
          <Link
            to="/login"
            className="mt-6 inline-block w-full rounded-lg bg-[#D85A30] py-2.5 text-sm font-medium text-white transition hover:bg-[#c24d27]"
          >
            로그인 화면으로
          </Link>
        </div>
      </div>
    );
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
        <p className="mt-1 text-center text-sm text-gray-500">계정 만들기</p>

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

          <label className="mb-1.5 block text-sm text-gray-500">닉네임</label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            required
            minLength={2}
            maxLength={50}
            className="mb-3.5 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#D85A30]"
            placeholder="클라이머"
          />

          <label className="mb-1.5 block text-sm text-gray-500">비밀번호</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mb-1.5 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#D85A30]"
            placeholder="••••••••••••"
          />
          <p className="mb-5 text-xs text-gray-400">
            최소 12자, 영문·숫자·특수문자를 포함하세요
          </p>

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
            {loading ? "가입 중..." : "회원가입"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-gray-500">
          이미 계정이 있나요?{" "}
          <Link to="/login" className="font-medium text-[#D85A30]">
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
