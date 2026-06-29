// 짐 color_order 의 한 글자 색 코드 → 표시용 풀네임 + 실제 CSS 색.
// DB 는 한 글자로 저장(grade_raw / color_order). 표시 레이어에서만 변환 (방법 A).

interface ColorInfo {
  label: string; // 풀네임 (핑 → 핑크)
  bg: string; // 배지 배경 CSS 색
  fg: string; // 글자색 (대비)
}

const DARK = "#1f2937"; // 밝은 배경용 어두운 글자
const LIGHT = "#ffffff"; // 어두운 배경용 흰 글자

const COLOR_MAP: Record<string, ColorInfo> = {
  흰: { label: "흰색", bg: "#F5F5F5", fg: DARK },
  노: { label: "노랑", bg: "#F5C518", fg: DARK },
  주: { label: "주황", bg: "#E8833A", fg: LIGHT },
  초: { label: "초록", bg: "#3FA34D", fg: LIGHT },
  연두: { label: "연두", bg: "#9ACD32", fg: DARK },
  파: { label: "파랑", bg: "#3B82C4", fg: LIGHT },
  빨: { label: "빨강", bg: "#D6433B", fg: LIGHT },
  핑: { label: "핑크", bg: "#E86A9C", fg: LIGHT },
  보: { label: "보라", bg: "#7C5CD8", fg: LIGHT },
  남: { label: "남색", bg: "#3B4C9C", fg: LIGHT },
  회: { label: "회색", bg: "#8A8A8A", fg: LIGHT },
  갈: { label: "갈색", bg: "#8B5A2B", fg: LIGHT },
  검: { label: "검정", bg: "#2B2B2B", fg: LIGHT },
};

// 매핑에 없는 색이면 원본 그대로 + 중립 회색 배지로 폴백
const FALLBACK = (code: string): ColorInfo => ({
  label: code,
  bg: "#9CA3AF",
  fg: LIGHT,
});

export function colorLabel(code: string): string {
  return COLOR_MAP[code]?.label ?? code;
}

export function colorInfo(code: string): ColorInfo {
  return COLOR_MAP[code] ?? FALLBACK(code);
}
