import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { searchUsers, ApiError, type UserSearchItem } from "../api/client";

// 유저 검색 (/search) — 하단 탭 '검색'.
// 닉네임 입력 시 디바운스(300ms) 실시간 검색. 결과 클릭 → 프로필로.

export default function SearchPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<UserSearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const reqId = useRef(0); // 오래된 응답 무시(레이스 방지)

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const query = q.trim();
    if (query === "") {
      setItems([]);
      setSearched(false);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const myReq = ++reqId.current;
    const timer = window.setTimeout(async () => {
      try {
        const res = await searchUsers(query, 1, 30);
        if (myReq !== reqId.current) return; // 더 최신 입력 있음 → 폐기
        setItems(res.items);
        setError(null);
      } catch (e) {
        if (myReq !== reqId.current) return;
        setError(e instanceof ApiError ? e.message : "검색에 실패했습니다.");
        setItems([]);
      } finally {
        if (myReq === reqId.current) {
          setLoading(false);
          setSearched(true);
        }
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [q]);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-gray-900">검색</h1>

      {/* 검색 입력 */}
      <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 focus-within:border-[#D85A30]">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="닉네임으로 검색"
          className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            className="text-gray-400 transition hover:text-gray-600"
            aria-label="지우기"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* 상태 */}
      {loading && (
        <p className="py-8 text-center text-sm text-gray-400">검색 중…</p>
      )}
      {error && (
        <p className="py-8 text-center text-sm text-red-500">{error}</p>
      )}
      {!loading && !error && searched && items.length === 0 && (
        <p className="py-8 text-center text-sm text-gray-400">
          '{q.trim()}' 검색 결과가 없어요.
        </p>
      )}
      {!loading && !error && !searched && (
        <p className="py-8 text-center text-sm text-gray-400">
          클라이머를 닉네임으로 찾아보세요.
        </p>
      )}

      {/* 결과 목록 */}
      <div className="space-y-1">
        {items.map((u) => {
          const initial = u.nickname.charAt(0).toUpperCase();
          return (
            <button
              key={u.id}
              type="button"
              onClick={() => navigate(`/users/${u.id}`)}
              className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-gray-100"
            >
              {u.profile_image_url ? (
                <img
                  src={u.profile_image_url}
                  alt={u.nickname}
                  className="h-11 w-11 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FAECE7] text-base font-medium text-[#D85A30]">
                  {initial}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-gray-900">
                  {u.nickname}
                </div>
                {u.bio && (
                  <div className="truncate text-xs text-gray-400">{u.bio}</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
