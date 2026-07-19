import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  requestPasswordReset,
  verifyPasswordResetCode,
  confirmPasswordReset,
  ApiError,
} from "../api/client";

const CODE_LEN = 6;
const COUNTDOWN_SECONDS = 180; // 백엔드 password_reset_code_ttl_seconds(3분)와 동일

function fmtCountdown(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// 백엔드 정책(app/core/password.py)과 동일한 기준의 강도 계산.
const SPECIAL_RE = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/;
function passwordStrength(pw: string): number {
  let n = 0;
  if (pw.length >= 12) n++;
  if (/[A-Za-z]/.test(pw)) n++;
  if (/\d/.test(pw)) n++;
  if (SPECIAL_RE.test(pw)) n++;
  return n;
}

type Step = "email" | "code" | "newPassword";

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [digits, setDigits] = useState<string[]>(Array(CODE_LEN).fill(""));
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [focusedIdx, setFocusedIdx] = useState<number | null>(null);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = window.setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearInterval(t);
  }, [secondsLeft]);

  const code = digits.join("");
  const expired = step === "code" && secondsLeft === 0;

  async function sendCode(e?: FormEvent) {
    e?.preventDefault();
    if (!email) return;
    setError(null);
    setLoading(true);
    try {
      await requestPasswordReset(email);
      setStep("code");
      setDigits(Array(CODE_LEN).fill(""));
      setSecondsLeft(COUNTDOWN_SECONDS);
      window.setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } catch {
      setError("코드 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }

  function handleDigitChange(i: number, value: string) {
    const v = value.replace(/\D/g, "").slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[i] = v;
      return next;
    });
    if (v && i < CODE_LEN - 1) inputRefs.current[i + 1]?.focus();
  }

  function handleDigitKeyDown(i: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      inputRefs.current[i - 1]?.focus();
    }
  }

  async function handleVerifyCode() {
    if (code.length !== CODE_LEN || expired) return;
    setError(null);
    setLoading(true);
    try {
      const token = await verifyPasswordResetCode(email, code);
      setResetToken(token);
      setStep("newPassword");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "코드 확인에 실패했습니다",
      );
      setDigits(Array(CODE_LEN).fill(""));
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmNewPassword(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== newPasswordConfirm) {
      setError("비밀번호가 일치하지 않아요");
      return;
    }
    setLoading(true);
    try {
      await confirmPasswordReset(resetToken, newPassword);
      navigate("/login?reset=success");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "비밀번호 변경에 실패했습니다. 처음부터 다시 시도해 주세요.",
      );
    } finally {
      setLoading(false);
    }
  }

  const strength = passwordStrength(newPassword);

  return (
    <div className="min-h-screen bg-page-gradient">
      <div className="flex items-center gap-3 px-5 py-4">
        <button onClick={() => navigate(-1)} className="text-title" aria-label="뒤로">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <span className="text-[16px] font-extrabold text-title">비밀번호 찾기</span>
      </div>

      <div className="mx-auto max-w-sm space-y-3.5 px-6 pb-8">
        {step !== "newPassword" ? (
          <>
            <p className="text-sm leading-[1.6] text-secondary">
              가입한 이메일로 인증 코드를 보내드려요.
              <br />
              코드 입력 후 새 비밀번호를 설정할 수 있어요.
            </p>

            <form onSubmit={sendCode}>
              <label className="mb-1.5 block text-xs font-bold text-muted">이메일</label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="climber@clog.dev"
                  className="flex-1 rounded-2xl bg-white px-4 py-3.5 text-[13.5px] font-semibold text-title shadow-[0_2px_10px_rgba(90,70,140,.07)] outline-none placeholder:font-normal placeholder:text-hint"
                />
                <button
                  type="submit"
                  disabled={!email || loading}
                  className="shrink-0 rounded-2xl bg-primary px-3.5 text-[12.5px] font-bold text-white transition disabled:opacity-50"
                >
                  {step === "code" ? "재전송" : "전송"}
                </button>
              </div>
            </form>

            {step === "code" && (
              <div>
                <div className="mb-1.5 flex items-baseline justify-between">
                  <span className="text-xs font-bold text-muted">인증 코드</span>
                  <span className={"text-xs font-extrabold " + (expired ? "text-danger" : "text-accent")}>
                    {expired ? "만료됨" : fmtCountdown(secondsLeft)}
                  </span>
                </div>
                <div className="flex justify-center gap-2">
                  {digits.map((d, i) => (
                    <input
                      key={i}
                      ref={(el) => {
                        inputRefs.current[i] = el;
                      }}
                      value={d}
                      onChange={(e) => handleDigitChange(i, e.target.value)}
                      onKeyDown={(e) => handleDigitKeyDown(i, e)}
                      onFocus={() => setFocusedIdx(i)}
                      onBlur={() => setFocusedIdx((cur) => (cur === i ? null : cur))}
                      inputMode="numeric"
                      maxLength={1}
                      disabled={expired}
                      className="h-11 w-9 shrink-0 rounded-xl bg-white text-center text-base font-extrabold text-title shadow-[0_2px_10px_rgba(90,70,140,.07)] outline-none disabled:opacity-40"
                      style={
                        focusedIdx === i ? { border: "2px solid #7C5CD8" } : undefined
                      }
                    />
                  ))}
                </div>
                {expired && (
                  <p className="mt-1.5 text-[11px] text-danger">
                    코드가 만료됐어요. 재전송을 눌러주세요.
                  </p>
                )}
              </div>
            )}

            {error && (
              <p className="rounded-2xl bg-danger-tint px-4 py-3 text-sm text-danger">
                {error}
              </p>
            )}

            {step === "code" && (
              <button
                type="button"
                onClick={handleVerifyCode}
                disabled={code.length !== CODE_LEN || expired || loading}
                className="bg-primary-gradient w-full rounded-2xl py-[15px] text-[14.5px] font-extrabold text-white shadow-[0_8px_20px_rgba(124,92,216,.3)] transition disabled:opacity-55"
              >
                {loading ? "확인 중..." : "확인"}
              </button>
            )}
          </>
        ) : (
          <form onSubmit={handleConfirmNewPassword} className="space-y-3">
            <p className="text-sm leading-[1.6] text-secondary">
              새로 사용할 비밀번호를 입력해 주세요.
            </p>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-muted">새 비밀번호</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
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
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-muted">새 비밀번호 확인</label>
              <input
                type="password"
                value={newPasswordConfirm}
                onChange={(e) => setNewPasswordConfirm(e.target.value)}
                required
                placeholder="••••••••••••"
                className="w-full rounded-2xl bg-white px-4 py-3.5 text-sm font-bold tracking-[3px] text-title shadow-[0_2px_10px_rgba(90,70,140,.07)] outline-none placeholder:font-normal placeholder:tracking-normal placeholder:text-hint"
              />
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
              {loading ? "변경 중..." : "비밀번호 재설정"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
