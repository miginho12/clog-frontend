import { useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  NavLink,
  useLocation,
  useNavigate,
  useOutlet,
} from "react-router-dom";
import { isAuthenticated } from "../lib/auth";
import { useNavDirection } from "../lib/navDirection";

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
  const outlet = useOutlet();
  const { getDirection, setDirection } = useNavDirection();
  const authed = isAuthenticated();

  // 좌우 스와이프로 탭 이동.
  // 순서: [생성(-1)] 피드(0) → 그레이드(1) → 암장(2) → 프로필(3)
  // 손가락 오른→왼(다음), 왼→오른(이전). 피드에서 이전 = 게시물 생성.
  const SWIPE_ORDER = TABS.map((t) => t.to); // /feed, /me/grade, /gyms, /profile
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  function currentIndex(): number {
    const path = location.pathname;
    // /users/:id (내 프로필로 리다이렉트된 경로, /posts 제외)은 프로필 탭으로 간주
    if (/^\/users\/[^/]+$/.test(path)) {
      return SWIPE_ORDER.indexOf("/profile");
    }
    const idx = SWIPE_ORDER.findIndex((to) =>
      to === "/feed" ? path === "/feed" : path.startsWith(to),
    );
    return idx;
  }

  // 애니메이션 key: 리다이렉트로 세부 경로가 바뀌어도 "같은 화면"이면 동일 key.
  // (/profile → /users/:id 리다이렉트 시 이중 애니메이션 방지)
  function screenKey(): string {
    const path = location.pathname;
    if (path === "/feed/new") return "feed-new";
    // 필터 피드(사용자 게시물)는 별개 화면
    if (/^\/users\/[^/]+\/posts/.test(path)) return "user-posts";
    // 내 프로필(/profile 또는 /users/:id)은 하나의 화면으로
    if (path === "/profile" || /^\/users\/[^/]+$/.test(path)) {
      return "profile";
    }
    const idx = currentIndex();
    if (idx !== -1) return "tab-" + idx;
    return path;
  }

  function goByDelta(delta: number) {
    setDirection(delta); // 애니메이션 방향
    // 게시물 생성 페이지에서 다음(오른→왼) 스와이프 → 피드 복귀
    if (location.pathname === "/feed/new") {
      if (delta > 0) navigate("/feed");
      return;
    }
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

  // 하단 탭바 클릭 시에도 방향 계산 (탭 순서 기준)
  function onTabClick(targetTo: string) {
    const from = currentIndex();
    const to = SWIPE_ORDER.indexOf(targetTo);
    if (from !== -1 && to !== -1) {
      setDirection(to > from ? 1 : -1);
    }
  }

  function onTouchStart(x: number, y: number) {
    touchStart.current = { x, y };
  }
  function onTouchEnd(x: number, y: number) {
    if (!touchStart.current) return;
    const dx = x - touchStart.current.x;
    const dy = y - touchStart.current.y;
    touchStart.current = null;
    // 바텀시트 등 모달이 열려있으면(body 스크롤 잠금) 탭 스와이프 무시
    if (document.body.style.overflow === "hidden") return;
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
          className="relative flex-1 overflow-x-hidden"
          onTouchStart={(e) =>
            onTouchStart(e.touches[0].clientX, e.touches[0].clientY)
          }
          onTouchEnd={(e) =>
            onTouchEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY)
          }
        >
          <AnimatePresence initial={false} mode="popLayout" custom={getDirection()}>
            <motion.div
              key={screenKey()}
              custom={getDirection()}
              variants={{
                enter: (dir: number) => ({
                  x: dir > 0 ? "100%" : "-100%",
                }),
                center: { x: 0 },
                exit: (dir: number) => ({
                  x: dir > 0 ? "-100%" : "100%",
                }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="min-h-full px-4 py-6 pb-24"
            >
              {outlet}
            </motion.div>
          </AnimatePresence>
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
                  onClick={() => onTabClick(tab.to)}
                  className="flex flex-1 flex-col items-center gap-0.5 py-2"
                >
                  {({ isActive }) => {
                    // 프로필은 /users/:id 로 리다이렉트되므로 currentIndex 로 보정
                    const active =
                      isActive ||
                      (tab.to === "/profile" &&
                        SWIPE_ORDER[currentIndex()] === "/profile");
                    return (
                      <>
                        <Icon active={active} />
                        <span
                          className={
                            active
                              ? "text-[11px] font-medium text-[#D85A30]"
                              : "text-[11px] text-gray-400"
                          }
                        >
                          {tab.label}
                        </span>
                      </>
                    );
                  }}
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
