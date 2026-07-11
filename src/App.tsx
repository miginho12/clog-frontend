import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import VerifyPage from "./pages/VerifyPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import ProfilePage from "./pages/ProfilePage";
import AccountSettingsPage from "./pages/AccountSettingsPage";
import UserProfilePage from "./pages/UserProfilePage";
import FollowListPage from "./pages/FollowListPage";
import FeedPage from "./pages/FeedPage";
import NotificationsPage from "./pages/NotificationsPage";
import FeedNewPage from "./pages/FeedNewPage";
import GradePage from "./pages/GradePage";
import SearchPage from "./pages/SearchPage";
import AppLayout from "./components/AppLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import AdminPage from "./pages/AdminPage";
import { NavDirectionProvider } from "./lib/navDirection";
import { UploadProvider } from "./lib/upload";

export default function App() {
  return (
    <BrowserRouter>
      <NavDirectionProvider>
        <UploadProvider>
        <Routes>
        {/* 인증 바깥 (전체화면) */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
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
        </UploadProvider>
      </NavDirectionProvider>
    </BrowserRouter>
  );
}
