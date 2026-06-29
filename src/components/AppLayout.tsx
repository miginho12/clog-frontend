import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { clearTokens, isAuthenticated } from "../lib/auth";

// 인증된 영역의 공통 셸: 상단 헤더(로고 + 네비 + 로그아웃) + 본문 Outlet.
// 각 페이지는 이 레이아웃의 자식 라우트로 렌더된다.

const NAV = [
  { to: "/feed", label: "피드", auth: false },
  { to: "/me/grade", label: "내 그레이드", auth: true },
  { to: "/gyms", label: "암장", auth: true },
  { to: "/profile", label: "프로필", auth: true },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const authed = isAuthenticated();

  function handleLogout() {
    clearTokens();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          {/* 로고 */}
          <NavLink to="/feed" className="flex items-center gap-1.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FAECE7] text-base">
              🧗
            </span>
            <span className="text-lg font-medium text-gray-900">Clog</span>
          </NavLink>

          {/* 네비 */}
          <nav className="flex items-center gap-1">
            {NAV.map((item) =>
              item.auth && !authed ? (
                <button
                  key={item.to}
                  onClick={() => navigate("/login")}
                  className="rounded-lg px-3 py-1.5 text-sm text-gray-400 transition hover:bg-gray-100 hover:text-gray-900"
                >
                  {item.label}
                </button>
              ) : (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/feed"}
                  className={({ isActive }) =>
                    [
                      "rounded-lg px-3 py-1.5 text-sm transition",
                      isActive
                        ? "bg-[#FAECE7] font-medium text-[#D85A30]"
                        : "text-gray-500 hover:bg-gray-100 hover:text-gray-900",
                    ].join(" ")
                  }
                >
                  {item.label}
                </NavLink>
              ),
            )}
          </nav>

          {/* 로그인 / 로그아웃 */}
          {authed ? (
            <button
              onClick={handleLogout}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 transition hover:bg-gray-50"
            >
              로그아웃
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
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
