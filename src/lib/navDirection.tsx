import { createContext, useContext, useRef } from "react";

// 페이지 전환 방향 공유.
// 스와이프/네비에서 방향을 set(1=다음/오른→왼, -1=이전/왼→오른)하고,
// 전환 애니메이션(AnimatePresence)이 그 방향으로 슬라이드한다.

type NavDirectionContextValue = {
  getDirection: () => number;
  setDirection: (d: number) => void;
};

const NavDirectionContext = createContext<NavDirectionContextValue | null>(null);

export function NavDirectionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const dirRef = useRef(1);
  const value: NavDirectionContextValue = {
    getDirection: () => dirRef.current,
    setDirection: (d: number) => {
      dirRef.current = d;
    },
  };
  return (
    <NavDirectionContext.Provider value={value}>
      {children}
    </NavDirectionContext.Provider>
  );
}

export function useNavDirection(): NavDirectionContextValue {
  const ctx = useContext(NavDirectionContext);
  if (!ctx) {
    return { getDirection: () => 1, setDirection: () => {} };
  }
  return ctx;
}
