import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signup, checkEmailAvailable, ApiError } from "../api/client";

// 백엔드 비밀번호 정책(app/core/password.py)과 동일한 기준으로 강도 계산.
// 최소 12자 + 영문 + 숫자 + 특수문자 — 4개 중 충족한 개수 = 강도 바 개수.
const SPECIAL_RE = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/;
function passwordStrength(pw: string): number {
  let n = 0;
  if (pw.length >= 12) n++;
  if (/[A-Za-z]/.test(pw)) n++;
  if (/\d/.test(pw)) n++;
  if (SPECIAL_RE.test(pw)) n++;
  return n;
}

export default function SignupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [emailChecked, setEmailChecked] = useState(false);
  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [nickname, setNickname] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const strength = passwordStrength(password);
  const allAgreed = agreeTerms && agreePrivacy;

  async function handleCheckEmail() {
    if (!email) return;
    setCheckingEmail(true);
    setError(null);
    try {
      const available = await checkEmailAvailable(email);
      setEmailAvailable(available);
      setEmailChecked(true);
    } catch {
      setError("이메일 확인에 실패했습니다");
    } finally {
      setCheckingEmail(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== passwordConfirm) {
      setError("비밀번호가 일치하지 않아요");
      return;
    }
    if (!allAgreed) {
      setError("필수 약관에 동의해 주세요");
      return;
    }
    setLoading(true);
    try {
      await signup({ email, password, nickname });
      setSubmitted(true);
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

  function toggleAll() {
    const next = !allAgreed;
    setAgreeTerms(next);
    setAgreePrivacy(next);
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page-gradient px-8 text-center">
        <div className="w-full max-w-sm">
          <div className="bg-hero-gradient mx-auto flex h-14 w-14 items-center justify-center rounded-full text-2xl">
            📬
          </div>
          <h1 className="mt-4 text-lg font-extrabold text-title">
            인증 메일을 보냈어요
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-secondary">
            <span className="font-bold text-title">{email}</span> 으로
            <br />
            인증 메일을 발송했어요.
            <br />
            메일함에서 인증을 완료하면 로그인할 수 있어요.
          </p>
          <p className="mt-3 text-xs text-muted">
            메일이 안 보이면 스팸함도 확인해 주세요.
          </p>
          <Link
            to="/login"
            className="bg-primary-gradient mt-6 inline-block w-full rounded-2xl py-3 text-sm font-extrabold text-white shadow-[0_8px_20px_rgba(124,92,216,.3)]"
          >
            로그인 화면으로
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page-gradient">
      <div className="flex items-center gap-3 px-5 py-4">
        <button
          onClick={() => navigate(-1)}
          className="text-title"
          aria-label="뒤로"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <span className="text-[16px] font-extrabold text-title">회원가입</span>
      </div>

      <form onSubmit={handleSubmit} className="mx-auto max-w-sm space-y-3 px-6 pb-8">
        <Field label="이메일">
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailChecked(false);
                setEmailAvailable(null);
              }}
              required
              placeholder="climber@clog.dev"
              className="flex-1 rounded-2xl bg-white px-4 py-3.5 text-[13.5px] font-semibold text-title shadow-[0_2px_10px_rgba(90,70,140,.07)] outline-none placeholder:font-normal placeholder:text-hint"
            />
            <button
              type="button"
              onClick={handleCheckEmail}
              disabled={!email || checkingEmail}
              className="shrink-0 rounded-2xl bg-primary-tint px-3.5 text-[12.5px] font-bold text-primary transition disabled:opacity-50"
            >
              {checkingEmail ? "확인 중…" : "중복 확인"}
            </button>
          </div>
          {emailChecked && (
            <p className={"mt-1.5 text-[11px] font-semibold " + (emailAvailable ? "text-success" : "text-danger")}>
              {emailAvailable ? "✓ 사용 가능한 이메일이에요" : "이미 가입된 이메일이에요"}
            </p>
          )}
        </Field>

        <Field label="비밀번호">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••••••"
            className="w-full rounded-2xl bg-white px-4 py-3.5 text-sm font-bold tracking-[3px] text-title shadow-[0_2px_10px_rgba(90,70,140,.07)] outline-none placeholder:font-normal placeholder:tracking-normal placeholder:text-hint"
          />
          <div className="mt-1.5 flex gap-1">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={"h-1 flex-1 rounded-full " + (i < strength ? "bg-primary" : "bg-line")}
              />
            ))}
          </div>
          <p className="mt-1 text-[11px] text-muted">
            영문·숫자·특수문자 포함 12자 이상
          </p>
        </Field>

        <Field label="비밀번호 확인">
          <input
            type="password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            required
            placeholder="••••••••••••"
            className="w-full rounded-2xl bg-white px-4 py-3.5 text-sm font-bold tracking-[3px] text-title shadow-[0_2px_10px_rgba(90,70,140,.07)] outline-none placeholder:font-normal placeholder:tracking-normal placeholder:text-hint"
          />
        </Field>

        <Field label="닉네임">
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            required
            minLength={2}
            maxLength={50}
            placeholder="클라이머"
            className="w-full rounded-2xl bg-white px-4 py-3.5 text-[13.5px] font-semibold text-title shadow-[0_2px_10px_rgba(90,70,140,.07)] outline-none placeholder:font-normal placeholder:text-hint"
          />
        </Field>

        <div className="flex flex-col gap-2.5 rounded-2xl bg-white p-4 shadow-[0_2px_10px_rgba(90,70,140,.07)]">
          <Checkbox checked={allAgreed} onChange={toggleAll} label="전체 동의" bold />
          <Checkbox checked={agreeTerms} onChange={() => setAgreeTerms((v) => !v)} label="[필수] 이용약관 동의" indent />
          <Checkbox checked={agreePrivacy} onChange={() => setAgreePrivacy((v) => !v)} label="[필수] 개인정보 수집·이용 동의" indent />
        </div>

        {error && (
          <p className="rounded-2xl bg-danger-tint px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="bg-primary-gradient w-full rounded-2xl py-[15px] text-[14.5px] font-extrabold text-white shadow-[0_8px_20px_rgba(124,92,216,.3)] transition disabled:opacity-60"
        >
          {loading ? "가입 중..." : "가입 완료"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold text-muted">{label}</label>
      {children}
    </div>
  );
}

function Checkbox({
  checked,
  onChange,
  label,
  bold = false,
  indent = false,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  bold?: boolean;
  indent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={"flex items-center gap-2.5 text-left " + (indent ? "pl-0.5" : "")}
    >
      <span
        className={
          (indent ? "h-[17px] w-[17px] rounded-[5px]" : "h-[19px] w-[19px] rounded-md") +
          " flex shrink-0 items-center justify-center transition " +
          (checked ? "bg-primary" : "bg-segment")
        }
      >
        {checked && (
          <svg width={indent ? 10 : 11} height={indent ? 10 : 11} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 13 4 4L19 7" />
          </svg>
        )}
      </span>
      <span className={bold ? "text-[12.5px] font-bold text-title" : "text-xs text-secondary"}>
        {label}
      </span>
    </button>
  );
}
