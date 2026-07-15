import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getGymRanking, type GymRankingEntry } from "../api/client";
import { colorInfo, colorLabel } from "../lib/colorMap";

// 암장 랭킹 패널 — 전체(누적) / 월별 / 주별(ISO) 세 기간을 토글하고,
// 월·주 모드에서는 이전/다음으로 다른 기간을 넘겨볼 수 있다.
// FeedPage(/gyms/:gymName)에서 "랭킹" 토글 시 렌더.

type Period = "all" | "month" | "week";

function mondayOf(d: Date): Date {
  const r = new Date(d);
  const day = (r.getDay() + 6) % 7; // 월요일=0
  r.setDate(r.getDate() - day);
  r.setHours(0, 0, 0, 0);
  return r;
}

// ISO 8601 주차 계산 (그 주의 목요일이 속한 연도 기준)
function isoWeekOf(d: Date): { year: number; week: number } {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - dayNum + 3); // 이 주의 목요일로 이동
  const firstThursday = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week =
    1 + Math.round((t.getTime() - firstThursday.getTime()) / (7 * 86400000));
  return { year: t.getUTCFullYear(), week };
}

// "7월 3주차" — 그 주 월요일이 속한 달 기준, 주차는 월요일 날짜/7 올림.
// 주가 월 경계에 걸치는 경우는 월요일 쪽 달로 표시(휴리스틱, 큰 문제 없음).
function weekLabel(anchor: Date): string {
  const mon = mondayOf(anchor);
  const weekOfMonth = Math.ceil(mon.getDate() / 7);
  return `${mon.getMonth() + 1}월 ${weekOfMonth}주차`;
}

function monthLabel(anchor: Date): string {
  return `${anchor.getFullYear()}년 ${anchor.getMonth() + 1}월`;
}

const PERIOD_TABS: { value: Period; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "month", label: "월별" },
  { value: "week", label: "주별" },
];

export default function GymRankingPanel({ gymName }: { gymName: string }) {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>("all");
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [entries, setEntries] = useState<GymRankingEntry[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params =
      period === "month"
        ? {
            period: "month" as const,
            year: anchor.getFullYear(),
            month: anchor.getMonth() + 1,
          }
        : period === "week"
          ? { period: "week" as const, ...isoWeekOf(anchor) }
          : { period: "all" as const };

    getGymRanking(gymName, params)
      .then((res) => {
        if (!cancelled) setEntries(res.entries);
      })
      .catch(() => {
        if (!cancelled) setEntries([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [gymName, period, anchor]);

  function switchPeriod(p: Period) {
    setPeriod(p);
    setAnchor(new Date());
  }

  function shiftMonth(delta: number) {
    setAnchor((prev) => {
      const next = new Date(prev);
      next.setMonth(next.getMonth() + delta);
      return next;
    });
  }

  function shiftWeek(delta: number) {
    setAnchor((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + delta * 7);
      return next;
    });
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-medium text-gray-700">{gymName} 랭킹</h2>

      <div className="mb-3 flex items-center gap-1.5">
        {PERIOD_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => switchPeriod(tab.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              period === tab.value
                ? "bg-[#D85A30] text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {period !== "all" && (
        <div className="mb-3 flex items-center justify-center gap-4">
          <button
            onClick={() => (period === "month" ? shiftMonth(-1) : shiftWeek(-1))}
            aria-label="이전 기간"
            className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100"
          >
            ‹
          </button>
          <span className="min-w-[7rem] text-center text-sm font-medium text-gray-700">
            {period === "month" ? monthLabel(anchor) : weekLabel(anchor)}
          </span>
          <button
            onClick={() => (period === "month" ? shiftMonth(1) : shiftWeek(1))}
            aria-label="다음 기간"
            className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100"
          >
            ›
          </button>
        </div>
      )}

      {loading && (
        <p className="py-6 text-center text-sm text-gray-400">불러오는 중...</p>
      )}
      {!loading && entries && entries.length === 0 && (
        <p className="py-6 text-center text-sm text-gray-400">
          이 기간엔 완등 기록이 없어요.
        </p>
      )}
      {!loading && entries && entries.length > 0 && (
        <div className="space-y-2">
          {entries.map((entry) => {
            const ci = colorInfo(entry.top_color_label);
            return (
              <button
                key={entry.user.id}
                onClick={() => navigate(`/users/${entry.user.id}`)}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-gray-50"
              >
                <span className="w-5 shrink-0 text-center text-sm font-semibold text-gray-400">
                  {entry.rank}
                </span>
                {entry.user.profile_image_url ? (
                  <img
                    src={entry.user.profile_image_url}
                    alt={entry.user.nickname}
                    className="h-8 w-8 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs text-gray-500">
                    {entry.user.nickname.slice(0, 1)}
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate text-sm text-gray-800">
                  {entry.user.nickname}
                </span>
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
                  style={{ backgroundColor: ci.bg, color: ci.fg }}
                >
                  {colorLabel(entry.top_color_label)}
                </span>
                <span className="w-12 shrink-0 text-right text-sm font-semibold text-gray-900">
                  {entry.score.toFixed(1)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
