// 디자인 시안의 스프링 이징 곡선 (framer-motion 은 CSS 변수를 못 읽으므로 JS 배열로 별도 정의).
// index.css 의 --ease-* 값과 반드시 동일하게 유지할 것.

export const EASE_SPRING = [0.22, 1.15, 0.36, 1] as const; // 화면/시트 전환(오버슈트 — 위치 이동용)
export const EASE_SPRING_BOUNCE = [0.2, 2.2, 0.4, 1] as const; // 하트, 난이도 선택 등 강조 튐
export const EASE_PILL = [0.22, 1.3, 0.36, 1] as const; // 탭바 알약 인디케이터
// 오버슈트 없는 단조 감속 곡선 — opacity/scale처럼 방향 반전(튕김)이 어색하게
// 보이는 값에 사용 (EASE_SPRING을 그대로 쓰면 살짝 튀었다 돌아오며 멈칫해 보임).
export const EASE_SMOOTH = [0.22, 1, 0.36, 1] as const;

export const TRANSITION_SHEET = { duration: 0.5, ease: EASE_SPRING };
export const TRANSITION_TAB = { duration: 0.55, ease: EASE_SPRING };
// 탭(형제 화면) 전환보다 살짝 빠르게 — 드릴다운(부모→자식 push/pop) 화면 전용
export const TRANSITION_PUSH = { duration: 0.35, ease: EASE_SMOOTH };
export const TRANSITION_PILL = { duration: 0.45, ease: EASE_PILL };
export const TRANSITION_BOUNCE = { duration: 0.35, ease: EASE_SPRING_BOUNCE };
export const TRANSITION_CHART = { duration: 0.45, ease: [0.22, 1, 0.36, 1] } as const;
