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
// 막대 그래프도 검토했으나, 매주 꾸준히 오르내리는 값이 아니라 듬성듬성 기록되는
// 데이터라 막대보다 추이선이 자연스럽다는 판단으로 원래 라인 차트 유지 (색만 교체).
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
    <div className="rounded-card bg-white p-5 shadow-card">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-bold text-title">성장 추이</h3>
      </div>
      <p className="mb-3 text-xs text-muted">
        완등 기록 기반 상대적 실력 흐름 (절대 등급 아님)
      </p>

      {/* 기간 선택 세그먼트 */}
      <div className="mb-3 flex gap-1 rounded-[10px] bg-segment p-[3px]">
        {PERIODS.map((per) => {
          const selected = per.weeks === weeks;
          return (
            <button
              key={per.weeks}
              onClick={() => onWeeksChange(per.weeks)}
              className={
                "flex-1 rounded-lg py-[5px] text-[11px] font-bold transition " +
                (selected
                  ? "bg-white text-title shadow-[0_1px_4px_rgba(90,70,140,.12)]"
                  : "text-muted hover:text-secondary")
              }
            >
              {per.label}
            </button>
          );
        })}
      </div>

      <div className="mb-2 flex items-baseline gap-2">
        <span className="text-xs text-muted">
          {active === null ? "최고점" : "선택"}
        </span>
        <span className="text-sm font-medium text-secondary">
          {fmtDate(shownPt.date)}
        </span>
        <span className="text-lg font-bold text-primary">
          {shownPt.score.toFixed(2)}
        </span>
        <span className="text-xs text-muted">({shownPt.count}개 반영)</span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none"
        role="img"
        aria-label="그레이드 성장 추이 그래프"
      >
        <defs>
          <linearGradient id="gradeArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7C5CD8" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#7C5CD8" stopOpacity="0" />
          </linearGradient>
        </defs>

        {yTicks.map((t) => {
          const y = yAt(t);
          return (
            <g key={t}>
              <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="#EBE7F4" strokeWidth="1" />
              <text x={PAD_L - 5} y={y + 3} textAnchor="end" fontSize="8" fill="#9C93B5">
                {t.toFixed(t === yMax || t === 0 ? 0 : 1)}
              </text>
            </g>
          );
        })}

        <path d={areaPath} fill="url(#gradeArea)" />
        <path d={linePath} fill="none" stroke="#7C5CD8" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {pts.map((p, i) => {
          const isActive = i === shown;
          const hasData = p.count > 0;
          return (
            <g key={i}>
              {isActive && hasData && (
                <line x1={p.x} y1={PAD_TOP} x2={p.x} y2={H - PAD_BOTTOM} stroke="#7C5CD8" strokeWidth="1" strokeDasharray="3 2" opacity="0.4" />
              )}
              <circle cx={p.x} cy={p.y} r={isActive ? 4 : hasData ? 2.5 : 1.5} fill={hasData ? "#7C5CD8" : "#D9D3E8"} />
              <circle cx={p.x} cy={p.y} r="12" fill="transparent" style={{ cursor: "pointer" }}
                onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)} onClick={() => setActive(i)} />
            </g>
          );
        })}

        {xLabelIdx.map((idx) => (
          <text key={idx} x={pts[idx].x} y={H - 6}
            textAnchor={idx === 0 ? "start" : idx === data.length - 1 ? "end" : "middle"}
            fontSize="9" fill="#9C93B5">
            {fmtDate(data[idx].date)}
          </text>
        ))}
      </svg>

      <div className="mt-2 flex items-baseline gap-1.5 border-t border-line pt-3">
        <span className="text-xs text-secondary">점수</span>
        <span className="text-base font-bold text-title">{last.score.toFixed(2)}</span>
      </div>
    </div>
  );
}
