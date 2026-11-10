import { Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
// 첫 화면·로그인 흐름은 번들에 포함(즉시), 나머지는 lazyPages 에서 필요할 때 로드 (감사 M6)
import LoginPage from "./pages/LoginPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import FeedPage from "./pages/FeedPage";
import {
  SignupPage,
  ForgotPasswordPage,
  VerifyPage,
  ProfilePage,
  AccountSettingsPage,
  FollowRequestsPage,
  UserProfilePage,
  FollowListPage,
  NotificationsPage,
  FeedNewPage,
  FeedBatchNewPage,
  GradePage,
  SearchPage,
  AdminPage,
} from "./pages/lazyPages";
import AppLayout from "./components/AppLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import PageFallback from "./components/PageFallback";
import { NavDirectionProvider } from "./lib/navDirection";
import { UploadProvider } from "./lib/upload";
import { useAppLoginReturn } from "./lib/appLogin";

// 앱 카카오 로그인 복귀(com.climblog.app://auth/callback) 수신 — Router 안이어야 navigate 가능 (감사 M14)
function AppLoginReturn() {
  useAppLoginReturn();
  return null;
}

export default function App() {
  return (
    <ErrorBoundary variant="root">
    <BrowserRouter>
      <AppLoginReturn />
      <NavDirectionProvider>
        <UploadProvider>
        {/* 레이아웃 밖 화면(가입·비번 찾기 등) 로딩용. 레이아웃 안은 AppLayout 의 Suspense 가 받는다 */}
        <Suspense fallback={<PageFallback fullScreen />}>
        <Routes>
        {/* 인증 바깥 (전체화면) */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/verify" element={<VerifyPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />

        {/* 공통 레이아웃 셸 (비회원도 접근 — 피드/상세는 공개) */}
        <Route element={<AppLayout />}>
          {/* 공개: 피드 보기 */}
          <Route path="/feed" element={<FeedPage />} />
          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <NotificationsPage />
              </ProtectedRoute>
            }
          />

          {/* 보호: 작성/수정/내 정보 (비회원은 /login 으로) */}
          <Route
            path="/feed/new"
            element={
              <ProtectedRoute>
                <FeedNewPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/feed/batch"
            element={
              <ProtectedRoute>
                <FeedBatchNewPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/feed/edit/:id"
            element={
              <ProtectedRoute>
                <FeedNewPage />
              </ProtectedRoute>
            }
          />
          {/* 공개: 게시물 상세 (비로그인도 공개글 조회 가능) */}
          <Route
            path="/me/grade"
            element={
              <ProtectedRoute>
                <GradePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/search"
            element={
              <ProtectedRoute>
                <SearchPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/follow-requests"
            element={
              <ProtectedRoute>
                <FollowRequestsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/edit"
            element={
              <ProtectedRoute>
                <AccountSettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminPage />
              </AdminRoute>
            }
          />
          <Route path="/users/:userId/posts" element={<FeedPage />} />
          <Route path="/gyms/:gymName" element={<FeedPage />} />
          <Route path="/tags/:tag" element={<FeedPage />} />
          <Route
            path="/users/:id/followers"
            element={<FollowListPage mode="followers" />}
          />
          <Route
            path="/users/:id/following"
            element={<FollowListPage mode="following" />}
          />
          <Route
            path="/users/:id"
            element={
              <ProtectedRoute>
                <UserProfilePage />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* 기본 경로 → 피드 (미인증 시 ProtectedRoute가 /login으로) */}
        <Route path="/" element={<Navigate to="/feed" replace />} />
        {/* 그 외 → 피드 */}
        <Route path="*" element={<Navigate to="/feed" replace />} />
        </Routes>
        </Suspense>
        </UploadProvider>
      </NavDirectionProvider>
    </BrowserRouter>
    </ErrorBoundary>
  );
}
