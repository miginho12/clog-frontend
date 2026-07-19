// API 클라이언트
//
// 백엔드 자체 인증 API 호출 함수.
// - signup: POST /auth/signup
// - localLogin: POST /auth/login/local
// - getMe: GET /users/me (인증 필요)
// - kakaoLoginUrl: 카카오 OAuth 시작 URL

import { API_BASE_URL } from "../config";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  saveTokens,
  type AuthUser,
} from "../lib/auth";

// 백엔드 인증 응답 (signup, login 공통)
export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: AuthUser;
}

// API 에러 (백엔드의 {error: {code, message}} 또는 {detail: ...} 형태)
export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, message: string, code = "error") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// ── 토큰 자동 갱신 + 인증 요청 래퍼 ──

// 진행 중인 갱신 Promise (동시 401 시 갱신 1회만 — 나머지는 이 결과를 공유)
let refreshPromise: Promise<string> | null = null;

async function doRefresh(): Promise<string> {
  const refresh = getRefreshToken();
  if (!refresh) {
    clearTokens();
    throw new ApiError(401, "no refresh token", "no_refresh");
  }
  const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refresh }),
  });
  if (!res.ok) {
    // refresh 자체가 만료/무효 → 재로그인 필요
    clearTokens();
    throw new ApiError(401, "refresh failed", "refresh_failed");
  }
  const data = (await res.json()) as { access_token: string };
  // access 만 갱신 (refresh 는 유지)
  const currentRefresh = getRefreshToken() ?? refresh;
  saveTokens(data.access_token, currentRefresh);
  return data.access_token;
}

function refreshAccessToken(): Promise<string> {
  // 이미 갱신 중이면 그 Promise 재사용 (중복 갱신 방지)
  if (refreshPromise === null) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

// 인증 요청 래퍼: 401 이면 토큰 갱신 후 1회 재시도.
// headersFactory 로 매번 최신 토큰을 헤더에 싣는다 (재시도 시 새 토큰 반영).
async function authFetch(
  url: string,
  init: RequestInit = {},
  headersFactory?: (token: string | null) => HeadersInit,
): Promise<Response> {
  const build = (): RequestInit => {
    const token = getAccessToken();
    const headers = headersFactory
      ? headersFactory(token)
      : token
        ? { Authorization: `Bearer ${token}` }
        : {};
    return { ...init, headers: { ...headers, ...(init.headers ?? {}) } };
  };

  let res = await fetch(url, build());
  if (res.status === 401 && getRefreshToken()) {
    try {
      await refreshAccessToken();
      res = await fetch(url, build()); // 새 토큰으로 재시도
    } catch {
      // 갱신 실패 — 원래 401 응답 그대로 반환 (호출부에서 처리)
    }
  }
  return res;
}

// 공통 응답 처리: 에러면 ApiError 던지기
async function handleResponse<T>(res: Response): Promise<T> {
  if (res.ok) {
    return (await res.json()) as T;
  }

  let message = `요청 실패 (${res.status})`;
  let code = "error";

  try {
    const body = await res.json();
    // 백엔드 형태 1: {error: {code, message}}
    if (body.error?.message) {
      message = body.error.message;
      code = body.error.code ?? code;
    }
    // 백엔드 형태 2: {detail: "..."} 또는 {detail: [{msg}]}
    else if (typeof body.detail === "string") {
      message = body.detail;
    } else if (Array.isArray(body.detail) && body.detail[0]?.msg) {
      message = body.detail[0].msg;
    }
  } catch {
    // JSON 파싱 실패 시 기본 메시지 유지
  }

  throw new ApiError(res.status, message, code);
}

// ── 자체 회원가입 ──
export interface SignupResponse {
  message: string;
  email: string;
}

export async function signup(params: {
  email: string;
  password: string;
  nickname: string;
  profile_image_url?: string;
}): Promise<SignupResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return handleResponse<SignupResponse>(res);
}

export async function verifyEmail(
  token: string,
): Promise<{ verified: boolean }> {
  const res = await fetch(
    `${API_BASE_URL}/auth/verify?token=${encodeURIComponent(token)}`,
  );
  return handleResponse<{ verified: boolean }>(res);
}

// ── 자체 로그인 ──
export async function localLogin(params: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/login/local`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return handleResponse<AuthResponse>(res);
}

// ── 이메일 중복 확인 (회원가입 폼) ──
export async function checkEmailAvailable(email: string): Promise<boolean> {
  const res = await fetch(
    `${API_BASE_URL}/auth/check-email?email=${encodeURIComponent(email)}`,
  );
  const data = await handleResponse<{ available: boolean }>(res);
  return data.available;
}

// ── 비밀번호 찾기 (6자리 코드) ──
export async function requestPasswordReset(email: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/auth/password-reset/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  await handleResponse<{ message: string }>(res);
}

export async function verifyPasswordResetCode(
  email: string,
  code: string,
): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/auth/password-reset/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code }),
  });
  const data = await handleResponse<{ reset_token: string }>(res);
  return data.reset_token;
}

export async function confirmPasswordReset(
  resetToken: string,
  newPassword: string,
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/auth/password-reset/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reset_token: resetToken, new_password: newPassword }),
  });
  if (!res.ok) {
    // 204 는 ok 라 통과, 그 외만 에러 파싱
    return handleResponse<void>(res);
  }
}

// ── 내 정보 조회 (인증 필요) ──
export async function getMe(): Promise<AuthUser> {
  const res = await authFetch(`${API_BASE_URL}/users/me`);
  return handleResponse<AuthUser>(res);
}

// ── 내 정보 수정 (PATCH /users/me) ──
export interface UserUpdateInput {
  nickname?: string;
  bio?: string | null;
  profile_image_url?: string | null;
  is_public?: boolean;
}

export async function updateMe(input: UserUpdateInput): Promise<AuthUser> {
  const res = await authFetch(
    `${API_BASE_URL}/users/me`,
    { method: "PATCH", body: JSON.stringify(input) },
    (t) => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${t}`,
    }),
  );
  return handleResponse<AuthUser>(res);
}

// ── 비밀번호 변경 (PATCH /users/me/password, local 계정만) — 204 ──
export async function changePassword(input: {
  current_password: string;
  new_password: string;
}): Promise<void> {
  const res = await authFetch(
    `${API_BASE_URL}/users/me/password`,
    { method: "PATCH", body: JSON.stringify(input) },
    (t) => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${t}`,
    }),
  );
  if (!res.ok) return handleResponse<void>(res);
}

// ── 회원 탈퇴 (DELETE /users/me) — 204 ──
export async function deleteAccount(): Promise<void> {
  const res = await authFetch(`${API_BASE_URL}/users/me`, {
    method: "DELETE",
  });
  if (!res.ok) return handleResponse<void>(res);
}

// ── 공개 프로필 조회 (인증 필요, is_public=true 사용자만) ──
// UserPublicResponse: 내 정보(AuthUser)와 달리 email/auth_provider 미포함
export interface PublicUser {
  id: string;
  nickname: string;
  profile_image_url: string | null;
  bio: string | null;
  is_public: boolean;
  is_banned?: boolean; // admin 차단 UI 용
  follow_status?: "none" | "pending" | "accepted"; // viewer→이 사용자
}

// ── 유저 검색 (GET /users/search) ──
export interface UserSearchItem {
  id: string;
  nickname: string;
  profile_image_url: string | null;
  bio: string | null;
}

export interface UserSearchResponse {
  items: UserSearchItem[];
  page: number;
  page_size: number;
  has_next: boolean;
}

export async function searchUsers(
  q: string,
  page = 1,
  pageSize = 20,
): Promise<UserSearchResponse> {
  const qs = new URLSearchParams({
    q,
    page: String(page),
    page_size: String(pageSize),
  });
  const res = await authFetch(`${API_BASE_URL}/users/search?${qs.toString()}`);
  return handleResponse<UserSearchResponse>(res);
}


export async function getUser(userId: string): Promise<PublicUser> {
  const res = await authFetch(`${API_BASE_URL}/users/${userId}`);
  return handleResponse<PublicUser>(res);
}

// ── 팔로우 ──
export interface FollowToggleResponse {
  following: boolean;
  follow_status: "none" | "pending" | "accepted";
  follower_count: number;
}

export interface FollowUserItem {
  id: string;
  nickname: string | null;
  profile_image_url: string | null;
  is_following: boolean;
}

export interface FollowListResponse {
  users: FollowUserItem[];
  total: number;
}

export async function followUser(
  userId: string,
): Promise<FollowToggleResponse> {
  const res = await authFetch(
    `${API_BASE_URL}/users/${userId}/follow`,
    { method: "POST" },
    (t) => ({ Authorization: `Bearer ${t}` }),
  );
  return handleResponse<FollowToggleResponse>(res);
}

export async function unfollowUser(
  userId: string,
): Promise<FollowToggleResponse> {
  const res = await authFetch(
    `${API_BASE_URL}/users/${userId}/follow`,
    { method: "DELETE" },
    (t) => ({ Authorization: `Bearer ${t}` }),
  );
  return handleResponse<FollowToggleResponse>(res);
}

export async function getFollowers(
  userId: string,
): Promise<FollowListResponse> {
  const res = await authFetch(`${API_BASE_URL}/users/${userId}/followers`);
  return handleResponse<FollowListResponse>(res);
}

// ── 사용자 차단 (admin) ──
export interface AdminBanResponse {
  user_id: string;
  is_banned: boolean;
}

export async function banUser(userId: string): Promise<AdminBanResponse> {
  const res = await authFetch(
    `${API_BASE_URL}/users/${userId}/ban`,
    { method: "POST" },
    (t) => ({ Authorization: `Bearer ${t}` }),
  );
  return handleResponse<AdminBanResponse>(res);
}

export async function unbanUser(userId: string): Promise<AdminBanResponse> {
  const res = await authFetch(
    `${API_BASE_URL}/users/${userId}/ban`,
    { method: "DELETE" },
    (t) => ({ Authorization: `Bearer ${t}` }),
  );
  return handleResponse<AdminBanResponse>(res);
}

export async function getFollowing(
  userId: string,
): Promise<FollowListResponse> {
  const res = await authFetch(`${API_BASE_URL}/users/${userId}/following`);
  return handleResponse<FollowListResponse>(res);
}

// ── 팔로우 요청 (승인제) ──
export async function getFollowRequests(): Promise<FollowListResponse> {
  const res = await authFetch(`${API_BASE_URL}/users/me/follow-requests`);
  return handleResponse<FollowListResponse>(res);
}

export async function countFollowRequests(): Promise<number> {
  const res = await authFetch(
    `${API_BASE_URL}/users/me/follow-requests/count`,
  );
  const data = await handleResponse<{ count: number }>(res);
  return data.count;
}

// 내 팔로워 끊어내기 (owner 가 자신을 팔로우하던 follower 제거)
export async function removeFollower(followerId: string): Promise<void> {
  const res = await authFetch(
    `${API_BASE_URL}/users/${followerId}/follower`,
    { method: "DELETE" },
    (t) => ({ Authorization: `Bearer ${t}` }),
  );
  if (!res.ok) return handleResponse<void>(res);
}

export async function acceptFollowRequest(requesterId: string): Promise<void> {
  const res = await authFetch(
    `${API_BASE_URL}/users/${requesterId}/follow-request/accept`,
    { method: "POST" },
    (t) => ({ Authorization: `Bearer ${t}` }),
  );
  if (!res.ok) return handleResponse<void>(res);
}

export async function rejectFollowRequest(requesterId: string): Promise<void> {
  const res = await authFetch(
    `${API_BASE_URL}/users/${requesterId}/follow-request/reject`,
    { method: "POST" },
    (t) => ({ Authorization: `Bearer ${t}` }),
  );
  if (!res.ok) return handleResponse<void>(res);
}

// ── 프로필 통계 ──
export interface ProfileStats {
  success_count: number;
  total_count: number;
  current_score: number;
  top_grade: string | null;
  top_grade_gym: string | null;
  top_grade_system: string; // "v_scale" | "color"
}

export async function getUserStats(userId: string): Promise<ProfileStats> {
  const res = await authFetch(`${API_BASE_URL}/users/${userId}/stats`);
  return handleResponse<ProfileStats>(res);
}

// ── 카카오 로그인 시작 URL ──
export function kakaoLoginUrl(): string {
  return `${API_BASE_URL}/auth/kakao/login`;
}

// ── 그레이드 (구현 2~5) ──
//
// GET /me/grade?base_gym= : v_scale + color 두 트랙 산정 결과 (인증 필요)
// GET /gym-grade-systems   : 짐 색체계 목록 (공개) — base_gym 드롭다운 옵션용

export interface VScaleGrade {
  comprehensive_score: number;
  top_rating: number | null;
  top_rating_label: string | null;
  counted_logs: number;
  // 다음 등급 도전 진척도 (ADR-050)
  next_grade_label: string | null;
  readiness_pct: number | null;
}

export interface ColorGrade {
  comprehensive_score: number;
  base_gym: string | null;
  top_rating_label: string | null;
  counted_logs: number;
  // 다음 등급 도전 진척도 (ADR-050). 최상위 색이거나 완등 0건이면 null
  next_grade_label: string | null;
  readiness_pct: number | null;
}

export interface MeGradeResponse {
  v_scale: VScaleGrade;
  color: ColorGrade;
}

export interface GymGradeSystem {
  id: string;
  gym_name: string;
  brand_name: string | null;
  color_order: string[];
  is_official: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ── 내 그레이드 조회 (인증 필요) ──
export interface GradeTimelinePoint {
  date: string; // YYYY-MM-DD
  score: number;
  count: number;
}

// GET /me/grade/timeline : 주별 종합 점수 추이 (인증 필요)
export async function getMyGradeTimeline(
  weeks = 12,
): Promise<GradeTimelinePoint[]> {
  const res = await authFetch(
    `${API_BASE_URL}/me/grade/timeline?weeks=${weeks}`,
  );
  return handleResponse<GradeTimelinePoint[]>(res);
}

export async function getMyGrade(baseGym?: string): Promise<MeGradeResponse> {
  const query = baseGym ? `?base_gym=${encodeURIComponent(baseGym)}` : "";
  const res = await authFetch(`${API_BASE_URL}/me/grade${query}`);
  return handleResponse<MeGradeResponse>(res);
}

// ── 짐 색체계 목록 조회 (공개) ──
// brandName 넘기면 같은 브랜드(체인) 지점만 필터.
export async function listGymGradeSystems(
  brandName?: string,
): Promise<GymGradeSystem[]> {
  const query = brandName
    ? `?brand_name=${encodeURIComponent(brandName)}`
    : "";
  const res = await fetch(`${API_BASE_URL}/gym-grade-systems${query}`);
  return handleResponse<GymGradeSystem[]>(res);
}

// ── 암장 랭킹 (공개 계정의 공개 컬러 등급 기록만) ──
export interface GymRankingUser {
  id: string;
  nickname: string;
  profile_image_url: string | null;
}

export interface GymRankingEntry {
  rank: number;
  user: GymRankingUser;
  score: number;
  top_color_label: string;
  counted_logs: number;
}

export interface GymRankingResponse {
  gym_name: string;
  brand_name: string | null;
  period: "all" | "month" | "week";
  range_start: string | null; // YYYY-MM-DD, period="all" 이면 null
  range_end: string | null;
  entries: GymRankingEntry[];
}

export interface GymRankingParams {
  period?: "all" | "month" | "week";
  year?: number;
  month?: number; // period="month" 일 때
  week?: number; // period="week" 일 때 (ISO 주차)
}

export async function getGymRanking(
  gymName: string,
  params: GymRankingParams = {},
): Promise<GymRankingResponse> {
  const qs = new URLSearchParams({ gym_name: gymName });
  if (params.period) qs.set("period", params.period);
  if (params.year !== undefined) qs.set("year", String(params.year));
  if (params.month !== undefined) qs.set("month", String(params.month));
  if (params.week !== undefined) qs.set("week", String(params.week));
  const res = await fetch(
    `${API_BASE_URL}/gym-grade-systems/ranking?${qs.toString()}`,
  );
  return handleResponse<GymRankingResponse>(res);
}

// ── 짐 색체계 관리 (admin) ──
// POST/PATCH/DELETE 는 백엔드에서 admin 우회 허용 (일반 사용자는 본인 비공식만).

export async function createGymGradeSystem(input: {
  gym_name: string;
  brand_name?: string | null;
  color_order: string[];
  is_official?: boolean;
}): Promise<GymGradeSystem> {
  const res = await authFetch(
    `${API_BASE_URL}/gym-grade-systems`,
    { method: "POST", body: JSON.stringify(input) },
    (t) => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${t}`,
    }),
  );
  return handleResponse<GymGradeSystem>(res);
}

export async function updateGymGradeSystem(
  id: string,
  colorOrder: string[],
  brandName?: string | null,
): Promise<GymGradeSystem> {
  const res = await authFetch(
    `${API_BASE_URL}/gym-grade-systems/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        color_order: colorOrder,
        brand_name: brandName ?? null,
      }),
    },
    (t) => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${t}`,
    }),
  );
  return handleResponse<GymGradeSystem>(res);
}

export async function deleteGymGradeSystem(id: string): Promise<void> {
  const res = await authFetch(`${API_BASE_URL}/gym-grade-systems/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    return handleResponse<void>(res);
  }
}

// ── 클라이밍 로그 (피드 / 작성) ──
//
// GET  /climbing-logs            피드 (공개, 비로그인 허용 / 로그인 시 본인 private 포함)
// POST /climbing-logs            작성 (인증)
// GET  /climbing-logs/meta/categories  추천 카테고리 태그

export type GradeSystemType = "v_scale" | "color";
export type VisibilityType = "public" | "private";

export interface ClimbingLogAuthor {
  id: string;
  nickname: string;
  profile_image_url: string | null;
}

export interface CommentPreview {
  id: string;
  content: string;
  like_count: number;
  reply_count: number;
  author: CommentAuthor | null;
}

export interface ClimbingLog {
  id: string;
  user_id: string;
  author?: ClimbingLogAuthor | null;
  grade_raw: string;
  grade_system: string;
  gym_name: string | null;
  categories: string[];
  comment: string | null;
  attempts: number;
  is_success: boolean;
  climbed_at: string; // date (YYYY-MM-DD)
  media_type: string | null;
  media_url: string | null;
  visibility: string;
  created_at: string;
  updated_at: string;
  like_count: number;
  liked_by_me: boolean;
  comment_count: number;
  top_comment: CommentPreview | null;
}

export interface ClimbingLogListResponse {
  items: ClimbingLog[];
  page: number;
  page_size: number;
  has_next: boolean;
}

export interface ClimbingLogCreateInput {
  grade_raw: string;
  grade_system: GradeSystemType;
  gym_name?: string | null;
  categories?: string[];
  comment?: string | null;
  attempts?: number;
  is_success?: boolean;
  climbed_at?: string | null; // null 이면 백엔드 기본(오늘)
  visibility?: VisibilityType;
  media_type?: string | null; // "image" | "video"
  media_url?: string | null;
}

export interface FeedParams {
  author_id?: string;
  category?: string;
  gym_name?: string;
  grade_system?: GradeSystemType;
  only_success?: boolean;
  page?: number;
  page_size?: number;
}

// ── 피드 조회 (공개 — 토큰 있으면 본인 private 포함) ──
export async function listClimbingLogs(
  params: FeedParams = {},
): Promise<ClimbingLogListResponse> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) qs.set(k, String(v));
  }
  const query = qs.toString() ? `?${qs.toString()}` : "";
  const res = await authFetch(`${API_BASE_URL}/climbing-logs${query}`);
  return handleResponse<ClimbingLogListResponse>(res);
}

// ── 인기 태그 집계 (검색 탭 발견용, 공개 — 비로그인도 조회 가능) ──
export interface CategoryCount {
  tag: string;
  count: number;
}

export async function getPopularCategories(
  limit = 10,
): Promise<CategoryCount[]> {
  const res = await fetch(
    `${API_BASE_URL}/climbing-logs/meta/categories/popular?limit=${limit}`,
  );
  return handleResponse<CategoryCount[]>(res);
}

// ── 작성 (인증) ──
export async function createClimbingLog(
  input: ClimbingLogCreateInput,
): Promise<ClimbingLog> {
  const res = await authFetch(
    `${API_BASE_URL}/climbing-logs`,
    { method: "POST", body: JSON.stringify(input) },
    (t) => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${t}`,
    }),
  );
  return handleResponse<ClimbingLog>(res);
}

// ── 단건 조회 (수정 폼 prefill 용) ──
export async function getClimbingLog(id: string): Promise<ClimbingLog> {
  const res = await authFetch(`${API_BASE_URL}/climbing-logs/${id}`);
  return handleResponse<ClimbingLog>(res);
}

// ── 수정 (본인만, 인증) ──
export async function updateClimbingLog(
  id: string,
  input: Partial<ClimbingLogCreateInput>,
): Promise<ClimbingLog> {
  const res = await authFetch(
    `${API_BASE_URL}/climbing-logs/${id}`,
    { method: "PATCH", body: JSON.stringify(input) },
    (t) => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${t}`,
    }),
  );
  return handleResponse<ClimbingLog>(res);
}

// ── 삭제 (본인만, 인증) — 204 No Content ──
export async function deleteClimbingLog(id: string): Promise<void> {
  const res = await authFetch(`${API_BASE_URL}/climbing-logs/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    // 204 는 ok 라 통과, 그 외만 에러 파싱
    return handleResponse<void>(res);
  }
}

// ── 좋아요 토글 (인증 필요) ──
export interface LikeToggleResponse {
  liked: boolean;
  like_count: number;
}

export async function likePost(id: string): Promise<LikeToggleResponse> {
  const res = await authFetch(`${API_BASE_URL}/climbing-logs/${id}/like`, {
    method: "POST",
  });
  return handleResponse<LikeToggleResponse>(res);
}

export async function unlikePost(id: string): Promise<LikeToggleResponse> {
  const res = await authFetch(`${API_BASE_URL}/climbing-logs/${id}/like`, {
    method: "DELETE",
  });
  return handleResponse<LikeToggleResponse>(res);
}

// ── 추천 카테고리 태그 (공개) ──
export async function getSuggestedCategories(): Promise<string[]> {
  const res = await fetch(`${API_BASE_URL}/climbing-logs/meta/categories`);
  return handleResponse<string[]>(res);
}


// ── 미디어 업로드 (presigned) ──
//
// POST /media/presign : presigned PUT URL 발급 (인증)
// 흐름: presign 요청 → 받은 upload_url 로 파일 직접 PUT → public_url 을 기록에 저장

export interface PresignResponse {
  upload_url: string;
  object_key: string;
  public_url: string;
  category: string; // "image" | "video"
  expires_in: number;
}

// presigned URL 발급
export async function presignMedia(
  contentType: string,
  filename?: string,
): Promise<PresignResponse> {
  const res = await authFetch(
    `${API_BASE_URL}/media/presign`,
    {
      method: "POST",
      body: JSON.stringify({ content_type: contentType, filename }),
    },
    (t) => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${t}`,
    }),
  );
  return handleResponse<PresignResponse>(res);
}

// presigned URL 로 파일 직접 업로드 (PUT)
export async function uploadToPresigned(
  uploadUrl: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<void> {
  // XMLHttpRequest 사용: fetch 는 업로드 진행률(progress) 이벤트를 못 줌.
  // 대용량 영상 업로드의 진행 상태를 백그라운드 배너에 표시하기 위함.
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(
          new ApiError(xhr.status, `파일 업로드 실패 (${xhr.status})`, "upload_failed"),
        );
      }
    };
    xhr.onerror = () =>
      reject(new ApiError(0, "네트워크 오류로 업로드 실패", "upload_failed"));
    xhr.send(file);
  });
}

// ── 댓글 (comments) ──

export interface CommentAuthor {
  id: string;
  nickname: string;
  profile_image_url: string | null;
}

export interface Comment {
  id: string;
  content: string;
  created_at: string;
  is_pinned: boolean;
  parent_id: string | null;
  author: CommentAuthor | null;
  reply_count: number;
  is_mine: boolean;
  can_pin: boolean;
  like_count: number;
  liked_by_me: boolean;
}

export interface CommentThread {
  comment: Comment;
  replies: Comment[];
}

export interface CommentListResponse {
  items: CommentThread[];
  total: number;
}

// 목록 (비로그인 허용 — 공개글)
export async function listComments(
  logId: string,
): Promise<CommentListResponse> {
  const res = await authFetch(
    `${API_BASE_URL}/climbing-logs/${logId}/comments`,
  );
  return handleResponse<CommentListResponse>(res);
}

// 작성 (인증)
export async function createComment(
  logId: string,
  content: string,
  parentId?: string | null,
): Promise<Comment> {
  const res = await authFetch(
    `${API_BASE_URL}/climbing-logs/${logId}/comments`,
    {
      method: "POST",
      body: JSON.stringify({ content, parent_id: parentId ?? null }),
    },
    (t) => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${t}`,
    }),
  );
  return handleResponse<Comment>(res);
}

// 수정 (본인)
export async function updateComment(
  commentId: string,
  content: string,
): Promise<Comment> {
  const res = await authFetch(
    `${API_BASE_URL}/comments/${commentId}`,
    { method: "PATCH", body: JSON.stringify({ content }) },
    (t) => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${t}`,
    }),
  );
  return handleResponse<Comment>(res);
}

// 삭제 (본인, soft)
export async function setCommentPin(
  commentId: string,
  pinned: boolean,
): Promise<Comment> {
  const res = await authFetch(
    `${API_BASE_URL}/comments/${commentId}/pin`,
    { method: "PATCH", body: JSON.stringify({ pinned }) },
    (t) => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${t}`,
    }),
  );
  return handleResponse<Comment>(res);
}

export async function deleteComment(commentId: string): Promise<void> {
  const res = await authFetch(`${API_BASE_URL}/comments/${commentId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    return handleResponse<void>(res);
  }
}

// ── 댓글 좋아요 ──

export async function likeComment(
  commentId: string,
): Promise<LikeToggleResponse> {
  const res = await authFetch(`${API_BASE_URL}/comments/${commentId}/like`, {
    method: "POST",
  });
  return handleResponse<LikeToggleResponse>(res);
}

export async function unlikeComment(
  commentId: string,
): Promise<LikeToggleResponse> {
  const res = await authFetch(`${API_BASE_URL}/comments/${commentId}/like`, {
    method: "DELETE",
  });
  return handleResponse<LikeToggleResponse>(res);
}

// ── 알림 (notifications) ──

export interface NotificationActor {
  id: string;
  nickname: string;
  profile_image_url: string | null;
}

export interface Notification {
  id: string;
  type:
    | "post_like"
    | "post_comment"
    | "comment_reply"
    | "media_ready"
    | "media_failed"
    | "follow"
    | "follow_request"
    | "follow_accept";
  climbing_log_id: string | null; // follow 알림은 게시물이 없다
  comment_id: string | null;
  is_read: boolean;
  created_at: string;
  actor: NotificationActor | null;
}

export interface NotificationListResponse {
  items: Notification[];
  unread_count: number;
}

export async function getNotifications(): Promise<NotificationListResponse> {
  const res = await authFetch(`${API_BASE_URL}/notifications`);
  return handleResponse<NotificationListResponse>(res);
}

export async function getUnreadCount(): Promise<number> {
  const res = await authFetch(`${API_BASE_URL}/notifications/unread-count`);
  const data = await handleResponse<{ unread_count: number }>(res);
  return data.unread_count;
}

export async function markAllNotificationsRead(): Promise<void> {
  const res = await authFetch(`${API_BASE_URL}/notifications/read-all`, {
    method: "POST",
  });
  if (!res.ok) throw new ApiError(res.status, "read-all failed");
}
