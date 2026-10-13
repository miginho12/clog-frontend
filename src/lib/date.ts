// 기기 현지 날짜 YYYY-MM-DD.
// toISOString() 은 UTC 라 한국에서 00~09시에 전날 날짜가 나온다 → 기록 날짜(climbed_at)가
// 하루 밀리고 잔디·하루 점수가 어긋났다. 서버 그레이드의 "오늘"도 KST 기준(ADR-068).
export function localDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
