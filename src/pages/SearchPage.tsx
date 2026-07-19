import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  searchUsers,
  listGymGradeSystems,
  getPopularCategories,
  ApiError,
  type UserSearchItem,
  type GymGradeSystem,
  type CategoryCount,
} from "../api/client";
import { colorInfo } from "../lib/colorMap";
import { avatarGradient } from "../lib/avatarGradient";

type Filter = "all" | "gym" | "user" | "tag";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "gym", label: "암장" },
  { key: "user", label: "클라이머" },
  { key: "tag", label: "태그" },
];

// 검색 (/search) — 하단 탭 '검색'.
// 암장 검색 → 그 암장 게시물 피드로, 클라이머 검색 → 프로필로,
// 해시태그 검색 → 그 태그 게시물 피드로 이동.
// 암장/태그는 실데이터(등록된 암장 목록, 태그 사용 집계)를 클라이언트에서
// 부분일치 필터링 — 백엔드에 "부분검색" 엔드포인트가 따로 없어서 이렇게 처리.
export default function SearchPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const [gyms, setGyms] = useState<GymGradeSystem[]>([]);
  const [popularTags, setPopularTags] = useState<CategoryCount[]>([]);
  const [users, setUsers] = useState<UserSearchItem[]>([]);
  const [userLoading, setUserLoading] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);
  const [userSearched, setUserSearched] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const reqId = useRef(0); // 오래된 응답 무시(레이스 방지)

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // 암장 전체 목록 + 인기 태그 — 1회 로드 (브라우징 + 부분일치 검색 소스로 겸용)
  useEffect(() => {
    listGymGradeSystems()
      .then(setGyms)
      .catch(() => {});
    getPopularCategories(30)
      .then(setPopularTags)
      .catch(() => {});
  }, []);

  // 클라이머(유저) 검색만 실제 네트워크 호출 — 디바운스
  useEffect(() => {
    const query = q.trim();
    if (query === "" || query.startsWith("#")) {
      setUsers([]);
      setUserSearched(false);
      setUserError(null);
      setUserLoading(false);
      return;
    }
    setUserLoading(true);
    const myReq = ++reqId.current;
    const timer = window.setTimeout(async () => {
      try {
        const res = await searchUsers(query, 1, 30);
        if (myReq !== reqId.current) return;
        setUsers(res.items);
        setUserError(null);
      } catch (e) {
        if (myReq !== reqId.current) return;
        setUserError(e instanceof ApiError ? e.message : "검색에 실패했습니다.");
        setUsers([]);
      } finally {
        if (myReq === reqId.current) {
          setUserLoading(false);
          setUserSearched(true);
        }
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [q]);

  const query = q.trim();
  const queryNoHash = query.startsWith("#") ? query.slice(1) : query;
  const searching = query !== "";

  const matchedGyms = searching
    ? gyms.filter((g) => g.gym_name.includes(queryNoHash))
    : [];
  const matchedTags = searching
    ? popularTags.filter((t) => t.tag.includes(queryNoHash))
    : [];

  const showGyms = filter === "all" || filter === "gym";
  const showUsers = filter === "all" || filter === "user";
  const showTags = filter === "all" || filter === "tag";

  // 유저 섹션은 로딩/에러/빈결과를 자체 표시하므로 "결과 없음" 판단엔 안 넣는다.
  const hasAnyResults =
    (showGyms && matchedGyms.length > 0) ||
    (showTags && matchedTags.length > 0) ||
    (showUsers && !query.startsWith("#"));

  return (
    <div className="space-y-3.5">
      {/* 검색 입력 */}
      <div className="flex items-center gap-2 rounded-input bg-white px-4 py-[13px] shadow-[0_2px_10px_rgba(90,70,140,.07)] focus-within:ring-1 focus-within:ring-primary">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9C93B5" strokeWidth="2.2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4-4" />
        </svg>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="암장, 클라이머, #해시태그 검색"
          className="w-full bg-transparent text-sm text-body outline-none placeholder:text-muted"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            className="text-muted transition hover:text-secondary"
            aria-label="지우기"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* 필터 칩 */}
      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={
              "rounded-full px-[15px] py-2 text-[12.5px] font-bold transition " +
              (filter === f.key
                ? "bg-primary text-white"
                : "bg-white text-secondary shadow-[0_2px_8px_rgba(90,70,140,.06)]")
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      {searching ? (
        <div className="space-y-3.5">
          {showGyms && matchedGyms.length > 0 && (
            <Section title="암장">
              <div className="flex flex-col gap-2">
                {matchedGyms.map((g) => (
                  <GymRow key={g.id} gym={g} onClick={() => navigate(`/gyms/${encodeURIComponent(g.gym_name)}`)} />
                ))}
              </div>
            </Section>
          )}

          {showTags && matchedTags.length > 0 && (
            <Section title="태그">
              <div className="flex flex-wrap gap-2">
                {matchedTags.map((t) => (
                  <TagChip key={t.tag} tag={t} onClick={() => navigate(`/tags/${encodeURIComponent(t.tag)}`)} />
                ))}
              </div>
            </Section>
          )}

          {showUsers && !query.startsWith("#") && (
            <Section title="클라이머">
              {userLoading && (
                <p className="py-6 text-center text-sm text-muted">검색 중…</p>
              )}
              {userError && (
                <p className="py-6 text-center text-sm text-danger">{userError}</p>
              )}
              {!userLoading && !userError && userSearched && users.length === 0 && (
                <p className="py-6 text-center text-sm text-muted">
                  '{query}' 검색 결과가 없어요.
                </p>
              )}
              <div className="flex flex-col gap-1">
                {users.map((u) => (
                  <UserRow key={u.id} user={u} onClick={() => navigate(`/users/${u.id}`)} />
                ))}
              </div>
            </Section>
          )}

          {!hasAnyResults && (
            <p className="py-8 text-center text-sm text-muted">
              '{query}' 검색 결과가 없어요.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3.5">
          {(filter === "all" || filter === "gym") && gyms.length > 0 && (
            <Section title="등록된 암장">
              <div className="flex flex-col gap-2">
                {gyms.map((g) => (
                  <GymRow key={g.id} gym={g} onClick={() => navigate(`/gyms/${encodeURIComponent(g.gym_name)}`)} />
                ))}
              </div>
            </Section>
          )}

          {(filter === "all" || filter === "tag") && popularTags.length > 0 && (
            <Section title="인기 해시태그">
              <div className="flex flex-wrap gap-2">
                {popularTags.slice(0, 8).map((t) => (
                  <TagChip key={t.tag} tag={t} onClick={() => navigate(`/tags/${encodeURIComponent(t.tag)}`)} />
                ))}
              </div>
            </Section>
          )}

          {filter === "user" && (
            <p className="py-8 text-center text-sm text-muted">
              닉네임을 입력해 클라이머를 찾아보세요.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2.5 text-[13px] font-extrabold text-title">{title}</div>
      {children}
    </div>
  );
}

function GymRow({ gym, onClick }: { gym: GymGradeSystem; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 rounded-[18px] bg-white px-4 py-3.5 text-left shadow-[0_2px_12px_rgba(90,70,140,.06)] transition hover:opacity-90"
    >
      <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-tile bg-primary-tint">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#7C5CD8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold text-title">{gym.gym_name}</div>
        <div className="mt-0.5 text-[11.5px] text-muted">
          컬러 {gym.color_order.length}단계
        </div>
      </div>
      <div className="flex shrink-0 gap-[3px]">
        {gym.color_order.slice(0, 5).map((c, i) => (
          <span
            key={i}
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: colorInfo(c).bg }}
          />
        ))}
      </div>
    </button>
  );
}

function TagChip({ tag, onClick }: { tag: CategoryCount; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full bg-primary-tint px-[13px] py-[7px] text-xs font-bold text-primary transition hover:opacity-80"
    >
      #{tag.tag} <span className="font-semibold text-primary-light">{tag.count}</span>
    </button>
  );
}

function UserRow({ user, onClick }: { user: UserSearchItem; onClick: () => void }) {
  const initial = user.nickname.charAt(0).toUpperCase();
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-segment"
    >
      {user.profile_image_url ? (
        <img
          src={user.profile_image_url}
          alt={user.nickname}
          className="h-11 w-11 shrink-0 rounded-full object-cover"
        />
      ) : (
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base font-bold text-white"
          style={{ background: avatarGradient(user.id) }}
        >
          {initial}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold text-title">{user.nickname}</div>
        {user.bio && (
          <div className="truncate text-xs text-muted">{user.bio}</div>
        )}
      </div>
    </button>
  );
}
