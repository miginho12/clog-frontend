import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useCurrentUser } from "../lib/useCurrentUser";

// admin 전용 라우트 가드.
// - 미로그인 → /login
// - 로그인했지만 admin 아님 → /feed
// - 확인 중 → 로딩 표시
export default function AdminRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useCurrentUser();

  if (loading) {
    return (
      <div className="py-16 text-center text-sm text-muted">확인 중…</div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (!user.is_admin) {
    return <Navigate to="/feed" replace />;
  }
  return <>{children}</>;
}
