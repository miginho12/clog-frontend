import type { GradeTimelinePoint } from "../api/client";

interface Props {
  data: GradeTimelinePoint[];
}

// 그레이드 추이 라인 차트 (인라인 SVG, 라이브러리 없음).
// 절대 지표가 아니라 "성장 추이" — 개인의 상대적 변화를 보여준다.
export default function GradeTrendChart({ data }: Props) {
  if (data.length === 0) return null;

  const W = 320;
  const H = 120;
  const PAD_X = 8;
  const PAD_TOP = 12;
  const PAD_BOTTOM = 18;

  const scores = data.map((d) => d.score);
  const maxScore = Math.max(...scores, 1);
  const plotW = W - PAD_X * 2;
  const plotH = H - PAD_TOP - PAD_BOTTOM;

  const pts = data.map((d, i) => {
    const x = PAD_X + (plotW * i) / (data.length - 1 || 1);
    const y = PAD_TOP + plotH * (1 - d.score / maxScore);
    return { x, y, ...d };
  });

  const linePath = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  const areaPath =
    `M ${pts[0].x.toFixed(1)} ${(H - PAD_BOTTOM).toFixed(1)} ` +
    pts.map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ") +
    ` L ${pts[pts.length - 1].x.toFixed(1)} ${(H - PAD_BOTTOM).toFixed(1)} Z`;

  const last = pts[pts.length - 1];

  const labelIdx = [0, Math.floor(data.length / 2), data.length - 1];
  const fmt = (iso: string) => {
    const [, m, d] = iso.split("-");
    return `${Number(m)}/${Number(d)}`;
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="mb-1 flex items-baseline justify-between">
        <h3 className="text-sm font-medium text-gray-900">성장 추이</h3>
        <span className="text-xs text-gray-400">최근 {data.length}주</span>
      </div>
      <p className="mb-3 text-xs text-gray-400">
        완등 기록 기반 상대적 실력 흐름 (절대 등급 아님)
      </p>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label="그레이드 성장 추이 그래프"
      >
        <defs>
          <linearGradient id="gradeArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#D85A30" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#D85A30" stopOpacity="0" />
          </linearGradient>
        </defs>

        <path d={areaPath} fill="url(#gradeArea)" />
        <path
          d={linePath}
          fill="none"
          stroke="#D85A30"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx={last.x} cy={last.y} r="3.5" fill="#D85A30" />
        <circle cx={last.x} cy={last.y} r="6" fill="#D85A30" fillOpacity="0.2" />

        {labelIdx.map((idx) => (
          <text
            key={idx}
            x={pts[idx].x}
            y={H - 4}
            textAnchor={idx === 0 ? "start" : idx === data.length - 1 ? "end" : "middle"}
            fontSize="9"
            fill="#9ca3af"
          >
            {fmt(data[idx].date)}
          </text>
        ))}
      </svg>

      <div className="mt-3 flex items-baseline gap-1.5 border-t border-gray-100 pt-3">
        <span className="text-xs text-gray-500">현재 지수</span>
        <span className="text-lg font-semibold text-[#D85A30]">
          {last.score.toFixed(2)}
        </span>
        <span className="text-xs text-gray-400">({last.count}개 기록 반영)</span>
      </div>
    </div>
  );
}
