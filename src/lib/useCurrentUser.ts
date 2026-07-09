// 현재 로그인 사용자(/users/me) 조회 훅.
//
// 모듈 레벨 캐시로 여러 컴포넌트가 getMe() 를 중복 호출하지 않도록 공유한다.
// 캐시는 access token 기준으로 자기무효화된다 — 로그아웃(토큰 제거) 또는
// 다른 계정 재로그인(토큰 변경) 시 자동으로 재조회하므로, 로그아웃 로직을
// 별도로 건드릴 필요가 없다.
//
// user/loading 은 렌더 시 token+cache+fetched 로 파생 계산한다. effect 안에서는
// 비동기 콜백(then/catch)에서만 setState 하므로 동기 cascading render 가 없다.

import { useEffect, useState } from "react";
import { getMe } from "../api/client";
import { getAccessToken, type AuthUser } from "./auth";

let cache: { token: string; user: AuthUser } | null = null;
let inflight: { token: string; p: Promise<AuthUser> } | null = null;

export interface CurrentUserState {
  user: AuthUser | null;
  loading: boolean;
  isAdmin: boolean;
}

export function useCurrentUser(): CurrentUserState {
  const token = getAccessToken();
  const cachedUser = cache && cache.token === token ? cache.user : null;
  // 비동기 조회 결과 (token 과 함께 저장 → 토큰 바뀌면 무시)
  const [fetched, setFetched] = useState<{
    token: string;
    user: AuthUser | null;
  } | null>(null);

  useEffect(() => {
    if (!token) return; // 미로그인 → 조회 안 함
    if (cache && cache.token === token) return; // 캐시 히트 → 조회 안 함

    let alive = true;
    if (!inflight || inflight.token !== token) {
      const p = getMe()
        .then((u) => {
          cache = { token, user: u };
          return u;
        })
        .finally(() => {
          if (inflight?.token === token) inflight = null;
        });
      inflight = { token, p };
    }
    inflight.p
      .then((u) => {
        if (alive) setFetched({ token, user: u });
      })
      .catch(() => {
        if (alive) setFetched({ token, user: null });
      });

    return () => {
      alive = false;
    };
  }, [token]);

  const resolved =
    cachedUser ?? (fetched && fetched.token === token ? fetched.user : null);
  const hasResult =
    cachedUser !== null || (fetched !== null && fetched.token === token);
  const loading = token !== null && !hasResult;

  return { user: resolved, loading, isAdmin: !!resolved?.is_admin };
}
