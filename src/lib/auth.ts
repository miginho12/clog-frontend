// 인증 토큰 관리 (localStorage 기반)
//
// access/refresh 토큰을 브라우저 localStorage 에 저장.
// 주의: localStorage 는 XSS 에 취약하므로, 실제 프로덕션에선
// httpOnly 쿠키 등을 고려해야 함. 학습/개발 단계에선 localStorage 사용.

const ACCESS_KEY = "clog_access_token";
const REFRESH_KEY = "clog_refresh_token";

export interface AuthUser {
  id: string;
  email: string;
  nickname: string;
  profile_image_url: string | null;
  bio: string | null;
  auth_provider: string;
  is_public: boolean;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

export function saveTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function isAuthenticated(): boolean {
  return getAccessToken() !== null;
}
