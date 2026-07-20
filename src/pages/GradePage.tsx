import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getMyGrade,
  getMyGradeTimeline,
  listGymGradeSystems,
  ApiError,
  type MeGradeResponse,
  type GymGradeSystem,
  type GradeTimelinePoint,
} from "../api/client";
import { clearTokens } from "../lib/auth";
import GradeTrendChart from "../components/GradeTrendChart";
import { colorInfo, colorLabel, colorTextOnWhite } from "../lib/colorMap";

// 암장별 환산 결과 (해당 암장 색 체계로 내 완등 실력을 투영한 값)
interface GymConversion {
  gym: GymGradeSystem;
  ratingLabel: string | null; // 색 코드
  step: number | null; // color_order 상 몇 번째 단계인지 (1-base)
}

export default function GradePage() {
  const navigate = useNavigate();
  const [grade, setGrade] = useState<MeGradeResponse | null>(null);
  const [gyms, setGyms] = useState<GymGradeSystem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeline, setTimeline] = useState<GradeTimelinePoint[]>([]);
  const [weeks, setWeeks] = useState<number>(12); // 추이 조회 기간
  const [conversions, setConversions] = useState<GymConversion[]>([]);
  const [showScoreInfo, setShowScoreInfo] = useState(false);

  // 짐 목록 (base_gym 드롭다운 옵션) — 1회 로드
  useEffect(() => {
    listGymGradeSystems()
      .then(setGyms)
      .catch(() => {
        // 짐 목록 실패는 치명적이지 않음 (드롭다운만 비게 됨)
      });
  }, []);

  // 암장 간 난이도 환산: 각 암장을 기준짐으로 넣어 실제 백엔드 환산 로직을 재사용.
  // 암장 수만큼 병렬 요청이 나가는데, StrictMode 이중 실행 + 동시 그레이드 요청이
  // 겹치면 DB 커넥션 풀 경합으로 일부가 실패할 수 있어 1회 재시도를 둔다.
  useEffect(() => {
    if (gyms.length === 0) return;
    let cancelled = false;

    async function fetchWithRetry(gym: GymGradeSystem) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await getMyGrade(gym.gym_name);
          return { gym, res };
        } catch {
          if (attempt === 0) await new Promise((r) => setTimeout(r, 300));
        }
      }
      return null;
    }

    Promise.all(gyms.map(fetchWithRetry)).then((results) => {
      if (cancelled) return;
      const rows: GymConversion[] = [];
      for (const r of results) {
        if (!r || r.res.color.counted_logs === 0) continue;
        const label = r.res.color.top_rating_label;
        const step = label ? r.gym.color_order.indexOf(label) + 1 : null;
        rows.push({ gym: r.gym, ratingLabel: label, step: step || null });
      }
      setConversions(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [gyms]);

  // 성장 추이 (주별 종합 점수) — 기간(weeks) 변경 시 재조회
  useEffect(() => {
    getMyGradeTimeline(weeks)
      .then(setTimeline)
      .catch(() => {
        // 추이 실패는 치명적이지 않음 (차트만 안 뜸)
      });
  }, [weeks]);

  // 그레이드 조회 (기준짐은 항상 자동 = 최다 기록 짐)
  useEffect(() => {
    setLoading(true);
    setError(null);
    getMyGrade()
      .then(setGrade)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          clearTokens();
          navigate("/login");
        } else {
          setError("그레이드를 불러오지 못했습니다");
        }
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  return (
    <div className="space-y-3.5">
      {grade && (
        <>
          {/* ── v_scale 히어로 카드 (기록 있을 때만) ── */}
          {grade.v_scale.counted_logs > 0 && (
            <HeroTrackCard
              title="V 스케일 종합 점수"
              score={grade.v_scale.comprehensive_score}
              ratingLabel={grade.v_scale.top_rating_label}
              nextGradeLabel={grade.v_scale.next_grade_label}
              readinessPct={grade.v_scale.readiness_pct}
              onInfoClick={() => setShowScoreInfo(true)}
            />
          )}

          {/* ── color 히어로 카드 ── */}
          <HeroTrackCard
            title={
              grade.color.base_gym
                ? `${grade.color.base_gym} 기준 종합 점수`
                : "내 종합 점수"
            }
            score={grade.color.comprehensive_score}
            ratingLabel={grade.color.top_rating_label}
            countedLogs={grade.color.counted_logs}
            nextGradeLabel={grade.color.next_grade_label}
            readinessPct={grade.color.readiness_pct}
            colorTrack
            onInfoClick={() => setShowScoreInfo(true)}
          />
        </>
      )}

      {showScoreInfo && (
        <ScoreInfoSheet onClose={() => setShowScoreInfo(false)} />
      )}

      {timeline.length > 0 && (
        <GradeTrendChart
          data={timeline}
          weeks={weeks}
          onWeeksChange={setWeeks}
        />
      )}

      {/* 암장 간 난이도 환산 */}
      {grade && conversions.length > 0 && (
        <div className="rounded-card bg-white p-5 shadow-card">
          <div className="text-sm font-bold text-title">
            암장 간 난이도 환산
          </div>
          <div className="mb-3.5 mt-0.5 text-[11px] text-muted">
            내 점수 {grade.color.comprehensive_score.toFixed(1)} 기준, 각
            암장에서 도전할 만한 난이도
          </div>
          <div className="flex flex-col gap-2.5">
            {conversions.map((c) => (
              <div
                key={c.gym.id}
                className="flex items-center gap-3 rounded-2xl bg-input px-3.5 py-3"
              >
                <div className="flex-1">
                  <div className="text-[13px] font-bold text-title">
                    {c.gym.gym_name}
                  </div>
                  <div className="mt-0.5 text-[10.5px] text-muted">
                    컬러 {c.gym.color_order.length}단계
                  </div>
                </div>
                {c.ratingLabel && (
                  // 고정폭 grid — 숫자 자릿수(9/9 vs 11/11)가 달라도 점 위치가
                  // 행마다 밀리지 않도록 컬럼 폭을 고정한다.
                  <div className="grid shrink-0 grid-cols-[14px_38px_32px] items-center gap-x-2">
                    <span
                      className="h-[14px] w-[14px] justify-self-center rounded-full border border-black/8"
                      style={{ backgroundColor: colorInfo(c.ratingLabel).bg }}
                    />
                    <span
                      className="truncate text-[13px] font-extrabold"
                      style={{ color: colorTextOnWhite(c.ratingLabel) }}
                    >
                      {colorLabel(c.ratingLabel)}
                    </span>
                    {c.step && (
                      <span className="text-right text-[10.5px] font-semibold text-hint">
                        {c.step}/{c.gym.color_order.length}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
            {grade.v_scale.counted_logs > 0 &&
              grade.v_scale.top_rating_label && (
                <div className="flex items-center gap-3 rounded-2xl bg-primary-tint px-3.5 py-3">
                  <div className="flex-1">
                    <div className="text-[13px] font-bold text-title">
                      자연 암반
                    </div>
                    <div className="mt-0.5 text-[10.5px] text-muted">
                      V-Scale
                    </div>
                  </div>
                  <span className="text-[13px] font-extrabold text-primary">
                    {grade.v_scale.top_rating_label}
                  </span>
                </div>
              )}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-card border border-line bg-white px-6 py-16 text-center">
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      {loading && !grade && (
        <div className="rounded-card border border-line bg-white px-6 py-16 text-center">
          <p className="text-sm text-muted">불러오는 중...</p>
        </div>
      )}
    </div>
  );
}

// ── 히어로 점수 카드 (v_scale / color 공용) ──
// 시안(#3a 홈 그레이드 탭)의 "내 종합 점수" 카드: 보라→코랄 그라디언트, 44px/800 점수,
// 반투명(또는 색상) 알약 등급 배지, 다음 등급까지 진행률 바.
function HeroTrackCard({
  title,
  score,
  ratingLabel,
  countedLogs = 1,
  colorTrack = false,
  nextGradeLabel = null,
  readinessPct = null,
  onInfoClick,
}: {
  title: string;
  score: number;
  ratingLabel: string | null;
  countedLogs?: number;
  colorTrack?: boolean;
  nextGradeLabel?: string | null;
  readinessPct?: number | null;
  onInfoClick?: () => void;
}) {
  if (countedLogs === 0) {
    return (
      <div className="bg-hero-gradient rounded-card-lg p-6 text-white">
        <div className="text-xs font-semibold opacity-85">{title}</div>
        <p className="mt-4 text-sm opacity-80">아직 기록이 없어요</p>
      </div>
    );
  }

  return (
    <div className="bg-hero-gradient rounded-card-lg p-6 text-white">
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-semibold opacity-85">{title}</span>
        {onInfoClick && (
          <button
            type="button"
            onClick={onInfoClick}
            aria-label="점수는 어떻게 계산되나요?"
            className="flex h-4 w-4 items-center justify-center rounded-full bg-white/25 text-[10px] font-bold leading-none opacity-85 transition hover:opacity-100"
          >
            ?
          </button>
        )}
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="text-[44px] font-extrabold tracking-[-1px]">
          {score.toFixed(1)}
        </span>
        {ratingLabel &&
          (colorTrack ? (
            <span
              className="shrink-0 rounded-full px-2.5 py-1 text-xs font-bold"
              style={{
                backgroundColor: colorInfo(ratingLabel).bg,
                color: colorInfo(ratingLabel).fg,
              }}
            >
              최고 {colorLabel(ratingLabel)}
            </span>
          ) : (
            <span className="shrink-0 rounded-full bg-white/22 px-2.5 py-1 text-xs font-bold">
              최고 {ratingLabel}
            </span>
          ))}
      </div>

      {nextGradeLabel && readinessPct !== null && (
        <div className="mt-4">
          <div className="text-xs font-semibold opacity-90">
            {colorTrack ? colorLabel(nextGradeLabel) : nextGradeLabel}
            {readinessPct >= 100
              ? "에 도전할 때예요!"
              : `까지 ${Math.round(readinessPct)}%`}
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/25">
            <div
              className="h-full rounded-full bg-white transition-all"
              style={{ width: `${Math.min(100, readinessPct)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── 점수 산정 기준 안내 바텀시트 ──
// 실제 계산식(app/domain/grade/service.py)을 사용자가 이해할 수 있는
// 문장으로 요약 — 정확한 수식보다 "어떤 요인이 점수에 영향을 주는지" 위주.
function ScoreInfoSheet({ onClose }: { onClose: () => void }) {
  const rules: { title: string; desc: string }[] = [
    {
      title: "난이도가 클수록 점수가 크게 올라요",
      desc: "등급이 한 단계 오를 때마다 점수 비중이 훨씬 커져요. 쉬운 문제를 여러 개 푸는 것보다 어려운 문제 하나를 완등하는 게 점수에 더 크게 반영돼요.",
    },
    {
      title: "완등이 시도보다 훨씬 유리해요",
      desc: "완등 기록이 가장 크게 반영되고, 시도(실패) 기록은 완등의 30% 정도로만 반영돼요. 그래도 시도 기록을 남기는 게 손해는 아니에요.",
    },
    {
      title: "최근 기록일수록 유리해요",
      desc: "완등한 지 60일이 지날 때마다 그 기록의 반영 비중이 절반씩 서서히 줄어들어요. 꾸준히 최근 기록을 쌓는 게 중요해요.",
    },
    {
      title: "적은 시도로 깰수록 조금 더 유리해요",
      desc: "시도 횟수가 늘어난다고 점수가 크게 깎이진 않아요. 영향이 완만해서, 여러 번 시도해서 깼다고 크게 불리하지 않아요.",
    },
    {
      title: "상위 기록 위주로 합산돼요",
      desc: "모든 기록을 다 더하는 게 아니라 상위 기록들 위주로 합산돼요. 기록 개수보다 기록의 '질'이 중요해요.",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
        aria-hidden
      />
      <div className="relative flex max-h-[80vh] w-full max-w-md flex-col rounded-t-sheet bg-white">
        <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-4">
          <span className="text-[15px] font-extrabold text-title">
            점수는 어떻게 계산되나요?
          </span>
          <button
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center text-hint"
            aria-label="닫기"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="flex flex-col gap-4">
            {rules.map((r) => (
              <div key={r.title} className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-tint text-[11px] font-bold text-primary">
                  ✓
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-title">{r.title}</p>
                  <p className="mt-0.5 text-xs leading-[1.6] text-secondary">
                    {r.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-2xl bg-input p-4">
            <p className="text-xs font-bold text-title">다음 등급까지 진행률은요?</p>
            <p className="mt-1 text-xs leading-[1.6] text-muted">
              점수와는 다른 지표예요. 최고 등급을 얼마나 안정적으로 완등해왔는지를
              보여주는데, 이것도 시간이 지나면 서서히 줄어들어요 — 오래전에 한 번
              깬 걸로 "지금도 준비됐다"고 보진 않아요.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
