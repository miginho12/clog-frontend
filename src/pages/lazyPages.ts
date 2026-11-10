import { lazy, type ComponentType } from "react";
import { isChunkLoadError, reloadOnceForNewVersion } from "../lib/chunkReload";

// 코드 분할 (2026-11-10, 감사 M6) — 첫 로딩에 관리자·업로드·그레이드 페이지까지 받지 않게.
// 즉시 로드(번들 포함): FeedPage(첫 화면), LoginPage·AuthCallbackPage(로그인 흐름) — App.tsx 에서 정적 import.
// 나머지는 이동할 때 받는다. 탭 페이지는 AppLayout 이 첫 화면 뒤 유휴 시간에 미리 받는다(preloadTabPages).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function page<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  const Lazy = lazy(() =>
    load().catch((e: unknown) => {
      // 배포 후 옛 청크 404 → 한 번 새로고침(새로고침이 시작되면 영원히 대기해 깜빡임 없음)
      if (isChunkLoadError(e) && reloadOnceForNewVersion()) {
        return new Promise<{ default: T }>(() => {});
      }
      throw e; // ErrorBoundary 가 안내 화면
    }),
  );
  return Object.assign(Lazy, { preload: () => load().catch(() => {}) });
}

export const SignupPage = page(() => import("./SignupPage"));
export const ForgotPasswordPage = page(() => import("./ForgotPasswordPage"));
export const VerifyPage = page(() => import("./VerifyPage"));
export const ProfilePage = page(() => import("./ProfilePage"));
export const AccountSettingsPage = page(() => import("./AccountSettingsPage"));
export const FollowRequestsPage = page(() => import("./FollowRequestsPage"));
export const UserProfilePage = page(() => import("./UserProfilePage"));
export const FollowListPage = page(() => import("./FollowListPage"));
export const NotificationsPage = page(() => import("./NotificationsPage"));
export const FeedNewPage = page(() => import("./FeedNewPage"));
export const FeedBatchNewPage = page(() => import("./FeedBatchNewPage"));
export const GradePage = page(() => import("./GradePage"));
export const SearchPage = page(() => import("./SearchPage"));
export const AdminPage = page(() => import("./AdminPage"));

/** 하단 탭·자주 가는 화면 — 스와이프 때 로딩 깜빡임 없게 미리 받아 둔다 */
export function preloadTabPages() {
  for (const p of [GradePage, SearchPage, ProfilePage, UserProfilePage, FeedNewPage, NotificationsPage]) {
    p.preload();
  }
}
