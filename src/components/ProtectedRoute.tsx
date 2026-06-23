import { Navigate } from "react-router-dom";
import { isAuthenticated } from "../lib/auth";
import type { ReactNode } from "react";

// 인증이 필요한 라우트를 감싸는 컴포넌트.
// 토큰이 없으면 /login 으로 리다이렉트.
export default function ProtectedRoute({ children }: { children: ReactNode }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
