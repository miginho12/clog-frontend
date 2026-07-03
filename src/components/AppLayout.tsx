import { useRef } from "react";
import {
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { isAuthenticated } from "../lib/auth";

// 모바일 웹 규격 셸 (토스/무신사 스타일).
// PC/모바일 동일 뷰: 고정 너비(max-w-md) 중앙 컨테이너.
// 상단 = 로고 + 로그인/로그아웃, 하단 = 탭바.

const TABS = [
  { to: "/feed", label: "피드", auth: false, icon: HomeIcon },
  { to: "/me/grade", label: "그레이드", auth: true, icon: ChartIcon },
  { to: "/gyms", label: "암장", auth: true, icon: PinIcon },
  { to: "/profile", label: "프로필", auth: true, icon: UserIcon },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const authed = isAuthenticated();

  // 좌우 스와이프로 탭 이동.
  // 순서: [생성(-1)] 피드(0) → 그레이드(1) → 암장(2) → 프로필(3)
  // 손가락 오른→왼(다음), 왼→오른(이전). 피드에서 이전 = 게시물 생성.
  const SWIPE_ORDER = TABS.map((t) => t.to); // /feed, /me/grade, /gyms, /profile
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  function currentIndex(): number {
    const path = location.pathname;
    const idx = SWIPE_ORDER.findIndex((to) =>
      to === "/feed" ? path === "/feed" : path.startsWith(to),
    );
    return idx;
  }

  function goByDelta(delta: number) {
    const idx = currentIndex();
    if (idx === -1) return; // 탭 화면이 아니면 스와이프 무시
    const target = idx + delta;
    if (target < 0) {
      // 피드에서 이전(왼→오른) → 게시물 생성
      if (idx === 0 && authed) navigate("/feed/new");
      return;
    }
    if (target >= SWIPE_ORDER.length) return; // 마지막 탭 이후 없음
    const to = SWIPE_ORDER[target];
    const tab = TABS[target];
    if (tab.auth && !authed) {
      navigate("/login");
      return;
    }
    navigate(to);
  }

  function onTouchStart(x: number, y: number) {
    touchStart.current = { x, y };
  }
  function onTouchEnd(x: number, y: number) {
    if (!touchStart.current) return;
    const dx = x - touchStart.current.x;
    const dy = y - touchStart.current.y;
    touchStart.current = null;
    // 가로 이동이 세로보다 확실히 크고, 60px 이상일 때만
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0) goByDelta(1); // 오른→왼 = 다음
    else goByDelta(-1); // 왼→오른 = 이전
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 모바일 규격 컨테이너 (PC 에서 가운데 폰 화면) */}
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col bg-gray-50 shadow-sm">
        {/* 상단 헤더 */}
        <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/90 backdrop-blur">
          <div className="grid h-14 grid-cols-3 items-center px-4">
            {/* 좌: 기록 추가 (+) */}
            <div className="flex justify-start">
              {authed ? (
                <button
                  onClick={() => navigate("/feed/new")}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-700 transition hover:bg-gray-100"
                  aria-label="기록하기"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button>
              ) : (
                <button
                  onClick={() => navigate("/login")}
                  className="rounded-lg bg-[#D85A30] px-3 py-1.5 text-sm font-medium text-white transition hover:bg-[#c14f29]"
                >
                  로그인
                </button>
              )}
            </div>

            {/* 중앙: 로고 */}
            <NavLink to="/feed" className="flex items-center justify-center gap-1.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FAECE7] text-base">
                🧗
              </span>
              <span className="text-lg font-medium text-gray-900">Clog</span>
            </NavLink>

            {/* 우: 알림 (준비 중) */}
            <div className="flex justify-end">
              {authed && (
                <button
                  onClick={() => {}}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100"
                  aria-label="알림 (준비 중)"
                  title="알림 (준비 중)"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.7 21a1.9 1.9 0 0 1-3.4 0" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </header>

        {/* 본문 (하단 탭바 높이만큼 패딩) */}
        <main
          className="flex-1 px-4 py-6 pb-24"
          onTouchStart={(e) =>
            onTouchStart(e.touches[0].clientX, e.touches[0].clientY)
          }
          onTouchEnd={(e) =>
            onTouchEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY)
          }
        >
          <Outlet />
        </main>

        {/* 하단 탭바 */}
        <nav className="sticky bottom-0 z-10 border-t border-gray-200 bg-white/95 backdrop-blur">
          <div className="flex items-stretch justify-around">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              if (tab.auth && !authed) {
                return (
                  <button
                    key={tab.to}
                    onClick={() => navigate("/login")}
                    className="flex flex-1 flex-col items-center gap-0.5 py-2 text-gray-400"
                  >
                    <Icon active={false} />
                    <span className="text-[11px]">{tab.label}</span>
                  </button>
                );
              }
              return (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  end={tab.to === "/feed"}
                  className="flex flex-1 flex-col items-center gap-0.5 py-2"
                >
                  {({ isActive }) => (
                    <>
                      <Icon active={isActive} />
                      <span
                        className={
                          isActive
                            ? "text-[11px] font-medium text-[#D85A30]"
                            : "text-[11px] text-gray-400"
                        }
                      >
                        {tab.label}
                      </span>
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}

// ── 탭 아이콘 (active 면 주황 채움) ──

function iconColor(active: boolean) {
  return active ? "#D85A30" : "#9CA3AF";
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={iconColor(active)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V9.5z" />
    </svg>
  );
}

function ChartIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={iconColor(active)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <rect x="7" y="11" width="3" height="6" />
      <rect x="12" y="7" width="3" height="10" />
      <rect x="17" y="13" width="3" height="4" />
    </svg>
  );
}

function PinIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={iconColor(active)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function UserIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={iconColor(active)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  );
}
