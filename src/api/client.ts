// API 클라이언트
//
// 백엔드 자체 인증 API 호출 함수.
// - signup: POST /auth/signup
// - localLogin: POST /auth/login/local
// - getMe: GET /users/me (인증 필요)
// - kakaoLoginUrl: 카카오 OAuth 시작 URL

import { API_BASE_URL } from "../config";
import { getAccessToken, type AuthUser } from "../lib/auth";

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
export async function signup(params: {
  email: string;
  password: string;
  nickname: string;
  profile_image_url?: string;
}): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return handleResponse<AuthResponse>(res);
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

// ── 내 정보 조회 (인증 필요) ──
export async function getMe(): Promise<AuthUser> {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE_URL}/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<AuthUser>(res);
}

// ── 공개 프로필 조회 (인증 필요, is_public=true 사용자만) ──
// UserPublicResponse: 내 정보(AuthUser)와 달리 email/auth_provider 미포함
export interface PublicUser {
  id: string;
  nickname: string;
  profile_image_url: string | null;
  bio: string | null;
  is_public: boolean;
}

export async function getUser(userId: string): Promise<PublicUser> {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE_URL}/users/${userId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  return handleResponse<PublicUser>(res);
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
}

export interface ColorGrade {
  comprehensive_score: number;
  base_gym: string | null;
  top_rating_label: string | null;
  counted_logs: number;
}

export interface MeGradeResponse {
  v_scale: VScaleGrade;
  color: ColorGrade;
}

export interface GymGradeSystem {
  id: string;
  gym_name: string;
  color_order: string[];
  is_official: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ── 내 그레이드 조회 (인증 필요) ──
export async function getMyGrade(baseGym?: string): Promise<MeGradeResponse> {
  const token = getAccessToken();
  const query = baseGym ? `?base_gym=${encodeURIComponent(baseGym)}` : "";
  const res = await fetch(`${API_BASE_URL}/me/grade${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<MeGradeResponse>(res);
}

// ── 짐 색체계 목록 조회 (공개) ──
export async function listGymGradeSystems(): Promise<GymGradeSystem[]> {
  const res = await fetch(`${API_BASE_URL}/gym-grade-systems`);
  return handleResponse<GymGradeSystem[]>(res);
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
  const token = getAccessToken();
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) qs.set(k, String(v));
  }
  const query = qs.toString() ? `?${qs.toString()}` : "";
  const res = await fetch(`${API_BASE_URL}/climbing-logs${query}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  return handleResponse<ClimbingLogListResponse>(res);
}

// ── 작성 (인증) ──
export async function createClimbingLog(
  input: ClimbingLogCreateInput,
): Promise<ClimbingLog> {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE_URL}/climbing-logs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });
  return handleResponse<ClimbingLog>(res);
}

// ── 단건 조회 (수정 폼 prefill 용) ──
export async function getClimbingLog(id: string): Promise<ClimbingLog> {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE_URL}/climbing-logs/${id}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  return handleResponse<ClimbingLog>(res);
}

// ── 수정 (본인만, 인증) ──
export async function updateClimbingLog(
  id: string,
  input: Partial<ClimbingLogCreateInput>,
): Promise<ClimbingLog> {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE_URL}/climbing-logs/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });
  return handleResponse<ClimbingLog>(res);
}

// ── 삭제 (본인만, 인증) — 204 No Content ──
export async function deleteClimbingLog(id: string): Promise<void> {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE_URL}/climbing-logs/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
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
  const token = getAccessToken();
  const res = await fetch(`${API_BASE_URL}/climbing-logs/${id}/like`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<LikeToggleResponse>(res);
}

export async function unlikePost(id: string): Promise<LikeToggleResponse> {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE_URL}/climbing-logs/${id}/like`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
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
  const token = getAccessToken();
  const res = await fetch(`${API_BASE_URL}/media/presign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ content_type: contentType, filename }),
  });
  return handleResponse<PresignResponse>(res);
}

// presigned URL 로 파일 직접 업로드 (PUT)
export async function uploadToPresigned(
  uploadUrl: string,
  file: File,
): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!res.ok) {
    throw new ApiError(res.status, `파일 업로드 실패 (${res.status})`, "upload_failed");
  }
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
  const token = getAccessToken();
  const res = await fetch(`${API_BASE_URL}/climbing-logs/${logId}/comments`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  return handleResponse<CommentListResponse>(res);
}

// 작성 (인증)
export async function createComment(
  logId: string,
  content: string,
  parentId?: string | null,
): Promise<Comment> {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE_URL}/climbing-logs/${logId}/comments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ content, parent_id: parentId ?? null }),
  });
  return handleResponse<Comment>(res);
}

// 수정 (본인)
export async function updateComment(
  commentId: string,
  content: string,
): Promise<Comment> {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE_URL}/comments/${commentId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ content }),
  });
  return handleResponse<Comment>(res);
}

// 삭제 (본인, soft)
export async function deleteComment(commentId: string): Promise<void> {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE_URL}/comments/${commentId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    return handleResponse<void>(res);
  }
}
