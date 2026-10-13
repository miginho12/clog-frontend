import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getMyGrade,
  getMyGradeTimeline,
  getMyGradeActivity,
  listGymGradeSystems,
  listGymGradeSystemRepresentatives,
  ApiError,
  type MeGradeResponse,
  type GymGradeSystem,
  type GradeTimelinePoint,
  type DailyActivity,
} from "../api/client";
import { clearTokens } from "../lib/auth";
import GradeTrendChart from "../components/GradeTrendChart";
import ActivityHeatmap from "../components/ActivityHeatmap";
import { colorInfo, colorLabel, colorTextOnWhite } from "../lib/colorMap";

// 점수 단위 (ADR-068): 암장 내 위치(0~1, + 암장 보정치) × 900. 10색 암장 한 단계 = 100점.
const FULL_SCALE = 900;
const V_SCALE_MAX = 17;

// 종합 점수를 기준 암장 색으로 해석 — "서울숲 기준 남색 수준".
// 점수 = (색 위치 + 그 암장 보정치) × 900 이므로 역으로 위치를 구해 가장 가까운 색.
function colorLevel(score: number, system: GymGradeSystem): string {
  const n = system.color_order.length;
  const pos = score / FULL_SCALE - system.difficulty_offset;
  const idx = Math.min(n - 1, Math.max(0, Math.round(pos * (n - 1))));
  return system.color_order[idx];
}

// 암장별 환산 결과 (해당 암장 색 체계로 내 완등 실력을 투영한 값)
interface GymConversion {
  gym: GymGradeSystem;
  ratingLabel: string | null; // 색 코드 (n/N 단계는 ConversionCell 이 계산)
}

export default function GradePage() {
  const navigate = useNavigate();
  const [grade, setGrade] = useState<MeGradeResponse | null>(null);
  const [gyms, setGyms] = useState<GymGradeSystem[]>([]);
  // 점수 해석용 전체 암장 (기준 암장이 대표 목록에 없을 수 있음)
  const [allGyms, setAllGyms] = useState<GymGradeSystem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeline, setTimeline] = useState<GradeTimelinePoint[]>([]);
  const [weeks, setWeeks] = useState<number>(12); // 추이 조회 기간
  const [activity, setActivity] = useState<DailyActivity[] | null>(null); // 잔디 (최근 26주)
  const [conversions, setConversions] = useState<GymConversion[]>([]);
  const [showScoreInfo, setShowScoreInfo] = useState(false);

  // 암장 간 난이도 환산 탭 대상 짐 목록 (공식 + 브랜드 대표/단독만) — 1회 로드
  useEffect(() => {
    listGymGradeSystemRepresentatives()
      .then(setGyms)
      .catch(() => {
        // 짐 목록 실패는 치명적이지 않음 (드롭다운만 비게 됨)
      });
  }, []);

  useEffect(() => {
    listGymGradeSystems()
      .then(setAllGyms)
      .catch(() => {
        // 실패해도 점수는 표시 (등급 해석 문구만 빠짐)
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
        // 최고 완등 기록이 있으면 환산 대상 — counted_logs 는 '최근 90일 점수 반영 수'라
        // 90일 넘게 쉰 사람의 환산 표가 통째로 사라지지 않게 쓰지 않는다 (ADR-068)
        if (!r || !r.res.color.top_rating_label) continue;
        rows.push({ gym: r.gym, ratingLabel: r.res.color.top_rating_label });
      }
      setConversions(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [gyms]);

  // 꾸준함 잔디 — 26주(182일) 고정
  useEffect(() => {
    getMyGradeActivity(182)
      .then(setActivity)
      .catch(() => {
        // 잔디 실패는 치명적이지 않음 (카드만 안 뜸)
      });
  }, []);

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
    void (async () => {
      setLoading(true);
      setError(null);
      await getMyGrade()
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
    })();
  }, [navigate]);

  return (
    <div className="space-y-3.5">
      {grade && (
        <>
          {/* ── v_scale 히어로 카드 (V 완등 기록 있을 때만 — 90일 넘게 쉬어도 카드는 유지) ── */}
          {grade.v_scale.top_rating_label && (
            <HeroTrackCard
              title="V 스케일 종합 점수"
              score={grade.v_scale.comprehensive_score}
              countedDays={grade.v_scale.counted_days}
              levelText={`V${Math.round((grade.v_scale.comprehensive_score / FULL_SCALE) * V_SCALE_MAX)} 수준`}
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
            countedDays={grade.color.counted_days}
            levelText={(() => {
              const sys = allGyms.find((g) => g.gym_name === grade.color.base_gym);
              if (!sys) return null;
              // 카드 제목에 기준 암장이 이미 있어 색만 표시
              return `${colorLabel(colorLevel(grade.color.comprehensive_score, sys))} 수준`;
            })()}
            ratingLabel={grade.color.top_rating_label}
            gaugeGym={allGyms.find((g) => g.gym_name === grade.color.base_gym) ?? null}
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

      {activity && activity.length > 0 && <ActivityHeatmap data={activity} />}

      {/* 암장 간 난이도 환산 */}
      {grade && conversions.length > 0 && (
        <div className="rounded-card bg-white p-5 shadow-card">
          <div className="text-sm font-bold text-title">
            암장 간 난이도 환산
          </div>
          <div className="mb-3.5 mt-0.5 text-[11px] text-muted">
            최고 완등과 평소 실력(종합 점수)을 각 암장 색으로 환산
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
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {c.ratingLabel && (
                    <ConversionCell kind="최고" code={c.ratingLabel} gym={c.gym} />
                  )}
                  {grade.color.counted_days > 0 && (
                    // 평소 실력 = 종합 점수를 이 암장 보정치 반영해 색으로 (ADR-068)
                    <ConversionCell
                      kind="평소"
                      code={colorLevel(grade.color.comprehensive_score, c.gym)}
                      gym={c.gym}
                    />
                  )}
                </div>
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
  countedDays,
  levelText = null,
  ratingLabel,
  gaugeGym = null,
  countedLogs = 1,
  colorTrack = false,
  nextGradeLabel = null,
  readinessPct = null,
  onInfoClick,
}: {
  title: string;
  score: number;
  countedDays: number;
  levelText?: string | null;
  ratingLabel: string | null;
  gaugeGym?: GymGradeSystem | null; // 색 띠 게이지 기준 암장 (컬러 트랙)
  countedLogs?: number;
  colorTrack?: boolean;
  nextGradeLabel?: string | null;
  readinessPct?: number | null;
  onInfoClick?: () => void;
}) {
  if (countedLogs === 0) {
    // 최고 등급(전체 기간)은 있는데 반영된 날이 없음 = 90일 넘게 쉼
    return (
      <div className="bg-hero-gradient rounded-card-lg p-6 text-white">
        <div className="text-xs font-semibold opacity-85">{title}</div>
        <p className="mt-4 text-sm opacity-80">
          {ratingLabel ? "최근 90일 완등 기록이 없어요" : "아직 기록이 없어요"}
        </p>
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
          {Math.round(score)}
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

      <div className="mt-1 text-[11px] font-semibold opacity-85">
        {levelText ? `${levelText} · ` : ""}최근 운동 {countedDays}일 기준
      </div>

      {gaugeGym && <ScoreGauge score={score} gym={gaugeGym} />}

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

// ── 점수 색 띠 게이지 (ADR-068) ──
// 기준 암장 색을 쉬운→어려운 순으로 같은 폭으로 놓고 내 점수 위치를 표시.
// 색 i 의 점수 = (i/(N-1) + 보정치) × 900 이라 색 사이 간격이 일정하다 → 칸 i 의
// 가운데 = (idx + 0.5)/N 에 맞추면 "정확히 그 색 수준"일 때 그 칸 한가운데.
// 양 끝 색의 점수를 적어 "어디가 고점인지" 보이게 한다.
function ScoreGauge({ score, gym }: { score: number; gym: GymGradeSystem }) {
  const n = gym.color_order.length;
  const first = gym.color_order[0];
  const last = gym.color_order[n - 1];
  const pointsOf = (i: number) => Math.round((i / (n - 1) + gym.difficulty_offset) * FULL_SCALE);
  const idx = Math.min(n - 1, Math.max(0, (score / FULL_SCALE - gym.difficulty_offset) * (n - 1)));
  const markerPct = ((idx + 0.5) / n) * 100;
  return (
    <div className="mt-3" data-testid="score-gauge">
      <div className="relative">
        <div className="flex gap-[2px] rounded-full bg-white/25 p-[3px]">
          {gym.color_order.map((c) => (
            <span
              key={c}
              className="h-2 flex-1 first:rounded-l-full last:rounded-r-full"
              style={{ backgroundColor: colorInfo(c).bg }}
              title={colorLabel(c)}
            />
          ))}
        </div>
        <span
          aria-label={`내 위치 ${Math.round(score)}점`}
          className="absolute -top-[3px] h-5 w-[3px] -translate-x-1/2 rounded-full bg-white shadow-[0_0_0_1.5px_rgba(43,26,102,.85)]"
          style={{ left: `${markerPct}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10.5px] font-semibold opacity-85">
        <span>
          {colorLabel(first)} {pointsOf(0)}
        </span>
        <span>
          {colorLabel(last)} {pointsOf(n - 1)}
        </span>
      </div>
    </div>
  );
}

// ── 환산 표 한 칸: "최고/평소 ● 색 n/N" ──
// 고정폭 grid — 숫자 자릿수(9/9 vs 11/11)가 달라도 점 위치가 행마다 밀리지 않게.
function ConversionCell({ kind, code, gym }: { kind: string; code: string; gym: GymGradeSystem }) {
  const step = gym.color_order.indexOf(code) + 1;
  return (
    <div className="grid grid-cols-[24px_14px_38px_32px] items-center gap-x-2">
      <span className="text-[10.5px] font-semibold text-muted">{kind}</span>
      <span
        className="h-[14px] w-[14px] justify-self-center rounded-full border border-black/8"
        style={{ backgroundColor: colorInfo(code).bg }}
      />
      <span className="truncate text-[13px] font-extrabold" style={{ color: colorTextOnWhite(code) }}>
        {colorLabel(code)}
      </span>
      <span className="text-right text-[10.5px] font-semibold text-hint">
        {step > 0 ? `${step}/${gym.color_order.length}` : ""}
      </span>
    </div>
  );
}

// ── 점수 산정 기준 안내 바텀시트 ──
// 실제 계산식(app/domain/grade/service.py)을 사용자가 이해할 수 있는
// 문장으로 요약 — 정확한 수식보다 "어떤 요인이 점수에 영향을 주는지" 위주.
function ScoreInfoSheet({ onClose }: { onClose: () => void }) {
  const rules: { title: string; desc: string }[] = [
    {
      title: "운동한 날마다 하루 점수를 매겨요",
      desc: "그날 완등한 문제 중 가장 어려운 3개의 평균이 하루 점수예요. 워밍업으로 쉬운 문제를 기록해도 점수가 내려가지 않아요.",
    },
    {
      title: "한 단계 오를 때마다 같은 폭으로 올라요",
      desc: "10색 암장 기준으로 한 단계가 100점이에요(가장 쉬운 색 0점 ~ 가장 어려운 색 900점). 높은 등급에서도 한 단계 오르면 그만큼 바로 반영돼요.",
    },
    {
      title: "암장마다 다른 난이도를 반영해요",
      desc: "같은 '최고 색'이라도 암장마다 실제 난이도가 달라서, 암장별 난이도 보정이 더해져요. 더 어려운 암장의 완등이 더 높게 계산돼요.",
    },
    {
      title: "최근 10번의 운동 중 잘한 7번의 평균이에요",
      desc: "컨디션이 안 좋은 날 3번은 빠지니까, 잘 안 된 날도 마음 편히 기록하세요. 90일이 지난 기록은 점수에서 빠져요.",
    },
    {
      title: "1트 완등은 보너스가 있어요",
      desc: "한 번에 완등하면 +20점이에요. 여러 번 시도해서 깬 문제도 점수가 깎이지 않아요.",
    },
    {
      title: "점수에는 완등만 들어가요",
      desc: "시도(실패) 기록은 점수에 들어가지 않아요. 대신 운동 기록으로 쌓여서 꾸준함(잔디)에 보여요.",
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
