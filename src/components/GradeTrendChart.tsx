import { useState } from "react";
import type { GradeTimelinePoint } from "../api/client";

interface Props {
  data: GradeTimelinePoint[];
  weeks: number;
  onWeeksChange: (weeks: number) => void;
}

// 기간 선택 옵션 (주 단위)
const PERIODS: { label: string; weeks: number }[] = [
  { label: "1개월", weeks: 4 },
  { label: "3개월", weeks: 12 },
  { label: "6개월", weeks: 26 },
  { label: "1년", weeks: 52 },
];

// 그레이드 추이 라인 차트 (인라인 SVG).
// 상호작용: 점을 탭/호버하면 해당 주의 날짜·점수·기록수 표시.
// 절대 지표가 아니라 개인의 상대적 "성장 추이".
export default function GradeTrendChart({ data, weeks, onWeeksChange }: Props) {
  const [active, setActive] = useState<number | null>(null);
  if (data.length === 0) return null;

  const W = 320;
  const H = 150;
  const PAD_L = 24;
  const PAD_R = 10;
  const PAD_TOP = 14;
  const PAD_BOTTOM = 22;

  const scores = data.map((d) => d.score);
  const rawMax = Math.max(...scores, 1);
  const yMax = Math.ceil(rawMax);
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_TOP - PAD_BOTTOM;

  const xAt = (i: number) => PAD_L + (plotW * i) / (data.length - 1 || 1);
  const yAt = (score: number) => PAD_TOP + plotH * (1 - score / yMax);

  const pts = data.map((d, i) => ({ x: xAt(i), y: yAt(d.score), ...d }));

  const linePath = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  const areaPath =
    `M ${pts[0].x.toFixed(1)} ${(H - PAD_BOTTOM).toFixed(1)} ` +
    pts.map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ") +
    ` L ${pts[pts.length - 1].x.toFixed(1)} ${(H - PAD_BOTTOM).toFixed(1)} Z`;

  const peakIdx = scores.indexOf(Math.max(...scores));
  const last = pts[pts.length - 1];
  const yTicks = [0, yMax / 2, yMax];
  const xLabelIdx = [0, Math.floor(data.length / 2), data.length - 1];
  const fmtDate = (iso: string) => {
    const [, m, d] = iso.split("-");
    return `${Number(m)}/${Number(d)}`;
  };

  const shown = active ?? peakIdx;
  const shownPt = pts[shown];

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-900">성장 추이</h3>
      </div>
      <p className="mb-3 text-xs text-gray-400">
        완등 기록 기반 상대적 실력 흐름 (절대 등급 아님)
      </p>

      {/* 기간 선택 세그먼트 */}
      <div className="mb-3 flex gap-1 rounded-xl bg-gray-100 p-1">
        {PERIODS.map((per) => {
          const selected = per.weeks === weeks;
          return (
            <button
              key={per.weeks}
              onClick={() => onWeeksChange(per.weeks)}
              className={
                "flex-1 rounded-lg py-1.5 text-xs font-medium transition " +
                (selected
                  ? "bg-white text-[#D85A30] shadow-sm"
                  : "text-gray-500 hover:text-gray-700")
              }
            >
              {per.label}
            </button>
          );
        })}
      </div>

      <div className="mb-2 flex items-baseline gap-2">
        <span className="text-xs text-gray-400">
          {active === null ? "최고점" : "선택"}
        </span>
        <span className="text-sm font-medium text-gray-700">
          {fmtDate(shownPt.date)}
        </span>
        <span className="text-lg font-semibold text-[#D85A30]">
          {shownPt.score.toFixed(2)}
        </span>
        <span className="text-xs text-gray-400">({shownPt.count}개 반영)</span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none"
        role="img"
        aria-label="그레이드 성장 추이 그래프"
      >
        <defs>
          <linearGradient id="gradeArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#D85A30" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#D85A30" stopOpacity="0" />
          </linearGradient>
        </defs>

        {yTicks.map((t) => {
          const y = yAt(t);
          return (
            <g key={t}>
              <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="#f3f4f6" strokeWidth="1" />
              <text x={PAD_L - 5} y={y + 3} textAnchor="end" fontSize="8" fill="#9ca3af">
                {t.toFixed(t === yMax || t === 0 ? 0 : 1)}
              </text>
            </g>
          );
        })}

        <path d={areaPath} fill="url(#gradeArea)" />
        <path d={linePath} fill="none" stroke="#D85A30" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {pts.map((p, i) => {
          const isActive = i === shown;
          const hasData = p.count > 0;
          return (
            <g key={i}>
              {isActive && hasData && (
                <line x1={p.x} y1={PAD_TOP} x2={p.x} y2={H - PAD_BOTTOM} stroke="#D85A30" strokeWidth="1" strokeDasharray="3 2" opacity="0.4" />
              )}
              <circle cx={p.x} cy={p.y} r={isActive ? 4 : hasData ? 2.5 : 1.5} fill={hasData ? "#D85A30" : "#d1d5db"} />
              <circle cx={p.x} cy={p.y} r="12" fill="transparent" style={{ cursor: "pointer" }}
                onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)} onClick={() => setActive(i)} />
            </g>
          );
        })}

        {xLabelIdx.map((idx) => (
          <text key={idx} x={pts[idx].x} y={H - 6}
            textAnchor={idx === 0 ? "start" : idx === data.length - 1 ? "end" : "middle"}
            fontSize="9" fill="#9ca3af">
            {fmtDate(data[idx].date)}
          </text>
        ))}
      </svg>

      <div className="mt-2 flex items-baseline gap-1.5 border-t border-gray-100 pt-3">
        <span className="text-xs text-gray-500">점수</span>
        <span className="text-base font-semibold text-gray-800">{last.score.toFixed(2)}</span>
      </div>
    </div>
  );
}
