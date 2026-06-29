import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import ProfilePage from "./pages/ProfilePage";
import FeedPage from "./pages/FeedPage";
import FeedNewPage from "./pages/FeedNewPage";
import GradePage from "./pages/GradePage";
import GymsPage from "./pages/GymsPage";
import AppLayout from "./components/AppLayout";
import ProtectedRoute from "./components/ProtectedRoute";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 인증 바깥 (전체화면) */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />

        {/* 인증 영역 (공통 레이아웃 셸 + 중첩 라우트) */}
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/feed" element={<FeedPage />} />
          <Route path="/feed/new" element={<FeedNewPage />} />
          <Route path="/me/grade" element={<GradePage />} />
          <Route path="/gyms" element={<GymsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>

        {/* 기본 경로 → 피드 (미인증 시 ProtectedRoute가 /login으로) */}
        <Route path="/" element={<Navigate to="/feed" replace />} />
        {/* 그 외 → 피드 */}
        <Route path="*" element={<Navigate to="/feed" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
