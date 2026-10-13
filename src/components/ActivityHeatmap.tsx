import { useMemo, useState } from "react";
import type { DailyActivity } from "../api/client";
import { localDateString } from "../lib/date";

interface Props {
  data: DailyActivity[]; // 기록이 있는 날만 (GET /me/grade/activity)
  weeks?: number;
}

// 꾸준함 잔디 (GitHub contribution 그래프 방식, ADR-068).
// 칸 색 = 그날 기록 수(운동량) — 점수는 성장 추이 차트가 맡고, 여기는 "얼마나 꾸준히" 만.
// 순차 팔레트: 단일 보라 4단계, 밝은 끝이 흰 배경 대비 2:1 이상 (dataviz 검증 통과).
// 기록 없는 날은 램프와 별개의 바탕색 — "0" 이 아니라 "없음".
const EMPTY = "#f1eff6";
const LEVELS = ["#bba4ef", "#9b7de6", "#7c5cd8", "#4f30a8"];
const LEVEL_LABELS = ["1~2개", "3~5개", "6~9개", "10개 이상"];

function level(total: number): number {
  if (total <= 0) return -1;
  if (total <= 2) return 0;
  if (total <= 5) return 1;
  if (total <= 9) return 2;
  return 3;
}

const WEEKDAYS = "월화수목금토일";
const CELL = 12; // viewBox 단위 (칸 10 + 간격 2)
const GAP = 2;
const LEFT = 16; // 요일 라벨
const TOP = 14; // 월 라벨

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function fmtLong(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const wd = "일월화수목금토"[new Date(y, m - 1, d).getDay()];
  return `${m}월 ${d}일 (${wd})`;
}

export default function ActivityHeatmap({ data, weeks = 26 }: Props) {
  const byDate = useMemo(() => new Map(data.map((a) => [a.date, a])), [data]);
  const todayIso = localDateString();

  // 열 = 주(월요일 시작), 마지막 열 = 이번 주. 미래 칸은 그리지 않는다.
  const { columns, monthLabels } = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const mondayOffset = (today.getDay() + 6) % 7; // 월=0 … 일=6
    const firstMonday = addDays(today, -mondayOffset - (weeks - 1) * 7);
    const cols: { iso: string; future: boolean }[][] = [];
    const labels: { col: number; text: string }[] = [];
    for (let w = 0; w < weeks; w++) {
      const col: { iso: string; future: boolean }[] = [];
      for (let d = 0; d < 7; d++) {
        const day = addDays(firstMonday, w * 7 + d);
        col.push({ iso: localDateString(day), future: day > today });
        // 그 주에 1일이 있으면 월 라벨 (첫 열은 항상)
        if ((d === 0 && w === 0) || day.getDate() === 1) {
          if (!labels.some((l) => l.col === w)) labels.push({ col: w, text: `${day.getMonth() + 1}월` });
        }
      }
      cols.push(col);
    }
    // 라벨이 3열(약 24px)보다 가까우면 글자가 겹친다 → 앞 라벨(보통 첫 열의 시작 월)을 뺀다
    const spaced = labels.filter((l, idx) => idx === labels.length - 1 || labels[idx + 1].col - l.col >= 3);
    return { columns: cols, monthLabels: spaced };
  }, [weeks]);

  // 요약: 운동일 수 + 연속 주 (이번 주가 비어 있으면 지난주부터 센다 — 주 중반에 끊긴 것처럼 보이지 않게)
  const activeDays = data.filter((a) => a.total > 0).length;
  const weekActive = columns.map((col) => col.some((c) => (byDate.get(c.iso)?.total ?? 0) > 0));
  let streak = 0;
  let i = weekActive.length - 1;
  if (!weekActive[i]) i -= 1;
  for (; i >= 0 && weekActive[i]; i--) streak++;

  // 선택 칸: 기본은 가장 최근 운동일 (없으면 오늘)
  const lastActive = [...data].reverse().find((a) => a.total > 0)?.date ?? todayIso;
  const [selected, setSelected] = useState<string | null>(null);
  const shown = selected ?? lastActive;
  const shownData = byDate.get(shown);

  const W = LEFT + weeks * CELL;
  const H = TOP + 7 * CELL;

  return (
    <div className="rounded-card bg-white p-5 shadow-card">
      <h3 className="text-sm font-bold text-title">꾸준함</h3>
      <p className="mb-3 mt-0.5 text-xs text-muted">
        최근 {Math.round(weeks / 4.345)}개월 운동 <span className="font-bold text-title">{activeDays}일</span>
        {streak > 0 && (
          <>
            {" · "}
            <span className="font-bold text-title">{streak}주 연속</span>
          </>
        )}
      </p>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`최근 ${weeks}주 운동 기록 잔디: 운동 ${activeDays}일, ${streak}주 연속`}
        onMouseLeave={() => setSelected(null)}
      >
        {monthLabels.map((m) => (
          <text key={m.col} x={LEFT + m.col * CELL} y={9} fontSize="8" fill="#9C93B5">
            {m.text}
          </text>
        ))}
        {[0, 2, 4].map((d) => (
          <text key={d} x={0} y={TOP + d * CELL + 8} fontSize="7.5" fill="#9C93B5">
            {WEEKDAYS[d]}
          </text>
        ))}
        {columns.map((col, w) =>
          col.map((c, d) => {
            if (c.future) return null;
            const a = byDate.get(c.iso);
            const lv = level(a?.total ?? 0);
            const isSel = c.iso === shown;
            return (
              <rect
                key={c.iso}
                data-date={c.iso}
                x={LEFT + w * CELL}
                y={TOP + d * CELL}
                width={CELL - GAP}
                height={CELL - GAP}
                rx={2}
                fill={lv < 0 ? EMPTY : LEVELS[lv]}
                stroke={isSel ? "#2b1a66" : "none"}
                strokeWidth={isSel ? 1.4 : 0}
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setSelected(c.iso)}
                onClick={() => setSelected(c.iso)}
              >
                <title>{`${fmtLong(c.iso)} · ${a ? `기록 ${a.total}개` : "기록 없음"}`}</title>
              </rect>
            );
          }),
        )}
      </svg>

      {/* 선택한 날 상세 — 값은 텍스트 토큰, 색 칸은 옆에서 정체성만 */}
      <div className="mt-2 flex min-h-[20px] items-center gap-1.5 text-xs" data-testid="heatmap-detail">
        <span className="font-semibold text-secondary">{fmtLong(shown)}</span>
        {shownData ? (
          <span className="text-muted">
            · 기록 <span className="font-bold text-title">{shownData.total}</span> · 완등{" "}
            <span className="font-bold text-title">{shownData.success}</span>
            {shownData.day_score !== null && (
              <>
                {" "}· 하루 점수 <span className="font-bold text-title">{Math.round(shownData.day_score)}</span>
              </>
            )}
          </span>
        ) : (
          <span className="text-muted">· 기록 없음</span>
        )}
      </div>

      {/* 범례 */}
      <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-muted">
        <span className="mr-0.5">적음</span>
        <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: EMPTY }} title="기록 없음" />
        {LEVELS.map((c, idx) => (
          <span key={c} className="h-2.5 w-2.5 rounded-[2px]" style={{ background: c }} title={LEVEL_LABELS[idx]} />
        ))}
        <span className="ml-0.5">많음</span>
      </div>
    </div>
  );
}
