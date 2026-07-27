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

// Provider 와 같은 파일에 두는 흔한 Context 패턴이라 Fast Refresh 최적화만
// 못 받을 뿐 실제 문제는 아님 (풀 리로드로 폴백되는 정도).
// eslint-disable-next-line react-refresh/only-export-components
export function useNavDirection(): NavDirectionContextValue {
  const ctx = useContext(NavDirectionContext);
  if (!ctx) {
    return { getDirection: () => 1, setDirection: () => {} };
  }
  return ctx;
}
