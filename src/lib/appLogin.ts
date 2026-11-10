// 앱(Capacitor) 카카오 로그인 (2026-11-11, 감사 M14)
//
// 예전: WebView 안에서 카카오 → climb-log.com 콜백으로 이동(allowNavigation) → 로그인 뒤 앱이
// 번들(https://localhost) 대신 원격 사이트로 동작, 토큰도 원격 출처에 저장 → 재시작마다 재로그인.
// 지금: 시스템 브라우저(Custom Tabs / SFSafariViewController)로 로그인 → 백엔드가
// com.climblog.app://auth/callback?code=… 로 돌려보냄 → OS 가 앱을 열고 appUrlOpen →
// 일회용 코드 + PKCE verifier 로 토큰 교환 → 번들 출처에 저장 (RFC 8252·7636).
//
// verifier 는 localStorage 에 둔다 — 브라우저에 있는 동안 OS 가 앱 프로세스를 정리하면
// sessionStorage·메모리는 사라지지만, 돌아와 콜드 스타트해도 교환할 수 있어야 한다.

import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, exchangeKakaoAppCode, kakaoAppLoginUrl } from "../api/client";
import { saveTokens } from "./auth";

const APP_CALLBACK = "com.climblog.app://auth/callback";
const PKCE_KEY = "clog_app_login_pkce";
const PKCE_MAX_AGE_MS = 10 * 60_000; // 로그인 시작 후 이 시간이 지나면 버림 (state TTL 5분보다 넉넉히)

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

function base64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function pkceChallenge(verifier: string): Promise<string> {
  if (!crypto?.subtle) throw new Error("이 기기에서는 안전한 로그인을 지원하지 않아요");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

/** 카카오 로그인 시작 — 시스템 브라우저를 연다 (앱 전용) */
export async function startKakaoAppLogin(): Promise<void> {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(48))); // 64자
  const challenge = await pkceChallenge(verifier);
  localStorage.setItem(PKCE_KEY, JSON.stringify({ v: verifier, at: Date.now() }));
  await Browser.open({ url: kakaoAppLoginUrl(challenge) });
}

function takeVerifier(): string | null {
  const raw = localStorage.getItem(PKCE_KEY);
  localStorage.removeItem(PKCE_KEY); // 한 번만 쓴다
  if (!raw) return null;
  try {
    const { v, at } = JSON.parse(raw) as { v?: unknown; at?: unknown };
    if (typeof v !== "string" || typeof at !== "number") return null;
    return Date.now() - at <= PKCE_MAX_AGE_MS ? v : null;
  } catch {
    return null;
  }
}

// 같은 코드를 두 번 처리하지 않게 (appUrlOpen 과 getLaunchUrl 이 같은 URL 을 줄 수 있고,
// StrictMode 는 effect 를 두 번 실행한다). 코드는 1회용이라 두 번째 교환은 실패한다.
const handledCodes = new Set<string>();

/** 앱 복귀 URL 처리 — 로그인 성공 시 /feed, 실패 시 /login 에 오류 표시 */
export function useAppLoginReturn(): void {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isNativeApp()) return;

    const handle = async (url: string | undefined) => {
      if (!url || !url.startsWith(APP_CALLBACK)) return;
      const code = new URL(url).searchParams.get("code");
      if (!code || handledCodes.has(code)) return;
      handledCodes.add(code);

      Browser.close().catch(() => {}); // iOS 시트 닫기 (Android 는 미지원 — 앱이 앞으로 오며 가려짐)

      const verifier = takeVerifier();
      if (!verifier) {
        navigate("/login", { replace: true, state: { loginError: "로그인 시간이 지났어요. 다시 시도해주세요." } });
        return;
      }
      try {
        const res = await exchangeKakaoAppCode(code, verifier);
        saveTokens(res.access_token, res.refresh_token);
        navigate("/feed", { replace: true });
      } catch (e) {
        const msg = e instanceof ApiError ? e.message : "로그인 중 문제가 발생했어요. 다시 시도해주세요.";
        navigate("/login", { replace: true, state: { loginError: msg } });
      }
    };

    const sub = App.addListener("appUrlOpen", (e) => void handle(e.url));
    // 브라우저에 있는 동안 앱이 정리됐다가 복귀 URL 로 새로 시작된 경우
    App.getLaunchUrl()
      .then((r) => handle(r?.url))
      .catch(() => {});

    return () => {
      void sub.then((h) => h.remove());
    };
  }, [navigate]);
}
