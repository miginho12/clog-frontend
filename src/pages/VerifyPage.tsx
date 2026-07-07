import { useEffect, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { verifyEmail } from "../api/client";

type Status = "loading" | "success" | "failed";

// 이메일 인증 페이지 (/verify?token=xxx).
// 메일 링크 클릭 → 이 페이지 접속 → 자동으로 인증 실행 → 결과 표시.
export default function VerifyPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>("loading");
  const ran = useRef(false); // StrictMode 중복 실행 방지 (토큰 일회용)

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    if (!token) {
      setStatus("failed");
      return;
    }
    verifyEmail(token)
      .then((res) => setStatus(res.verified ? "success" : "failed"))
      .catch(() => setStatus("failed"));
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 text-center">
        {status === "loading" && (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#FAECE7] text-2xl">
              🧗
            </div>
            <p className="mt-4 text-sm text-gray-500">인증 중이에요...</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-2xl">
              ✅
            </div>
            <h1 className="mt-4 text-lg font-medium text-gray-900">
              이메일 인증 완료!
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-gray-500">
              이제 Clog에 로그인할 수 있어요.
            </p>
            <Link
              to="/login"
              className="mt-6 inline-block w-full rounded-lg bg-[#D85A30] py-2.5 text-sm font-medium text-white transition hover:bg-[#c24d27]"
            >
              로그인하러 가기
            </Link>
          </>
        )}

        {status === "failed" && (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-2xl">
              ⚠️
            </div>
            <h1 className="mt-4 text-lg font-medium text-gray-900">
              인증에 실패했어요
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-gray-500">
              인증 링크가 만료되었거나 유효하지 않아요.
              <br />
              다시 회원가입하거나 로그인해 주세요.
            </p>
            <Link
              to="/login"
              className="mt-6 inline-block w-full rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              로그인 화면으로
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
