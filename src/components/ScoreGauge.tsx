// 종합점수 게이지 바.
// score(0~max)를 채움 비율로 시각화. 트랙별 색은 color prop으로.

export default function ScoreGauge({
  score,
  max = 10,
  color,
}: {
  score: number;
  max?: number;
  color: string;
}) {
  const pct = Math.max(0, Math.min(100, (score / max) * 100));
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}
