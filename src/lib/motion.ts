// 디자인 시안의 스프링 이징 곡선 (framer-motion 은 CSS 변수를 못 읽으므로 JS 배열로 별도 정의).
// index.css 의 --ease-* 값과 반드시 동일하게 유지할 것.

export const EASE_SPRING = [0.22, 1.15, 0.36, 1] as const; // 화면/시트 전환
export const EASE_SPRING_BOUNCE = [0.2, 2.2, 0.4, 1] as const; // 하트, 난이도 선택 등 강조 튐
export const EASE_PILL = [0.22, 1.3, 0.36, 1] as const; // 탭바 알약 인디케이터

export const TRANSITION_SHEET = { duration: 0.5, ease: EASE_SPRING };
export const TRANSITION_TAB = { duration: 0.55, ease: EASE_SPRING };
export const TRANSITION_PILL = { duration: 0.45, ease: EASE_PILL };
export const TRANSITION_BOUNCE = { duration: 0.35, ease: EASE_SPRING_BOUNCE };
export const TRANSITION_CHART = { duration: 0.45, ease: [0.22, 1, 0.36, 1] } as const;
