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

// ── 카카오 로그인 시작 URL ──
export function kakaoLoginUrl(): string {
  return `${API_BASE_URL}/auth/kakao/login`;
}
