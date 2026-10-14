import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getMyGrade,
  getMyGradeTimeline,
  getMyGradeActivity,
  getMyGymLevels,
  ApiError,
  type MeGradeResponse,
  type GymLevel,
  type MyGymLevels,
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

// 기준 암장 선택은 이 기기에만 저장 (사용자 결정 — 서버 설정 아님)
const BASE_GYM_KEY = "clog_grade_base_gym";
function loadBaseGym(): string | null {
  try {
    return localStorage.getItem(BASE_GYM_KEY);
  } catch {
    return null;
  }
}
function saveBaseGym(name: string | null) {
  try {
    if (name) localStorage.setItem(BASE_GYM_KEY, name);
    else localStorage.removeItem(BASE_GYM_KEY);
  } catch {
    /* 저장 실패(사생활 모드 등)는 무시 — 이번 화면에서만 적용 */
  }
}

// 점수 해석에 필요한 암장 색 체계
type GymScale = Pick<GymLevel, "gym_name" | "color_order" | "difficulty_offset">;

// 종합 점수를 기준 암장 색으로 해석 — "서울숲 기준 남색 수준".
// 점수 = (색 위치 + 그 암장 보정치) × 900 이므로 역으로 위치를 구해 가장 가까운 색.
function colorLevel(score: number, system: GymScale): string {
  const n = system.color_order.length;
  const pos = score / FULL_SCALE - system.difficulty_offset;
  const idx = Math.min(n - 1, Math.max(0, Math.round(pos * (n - 1))));
  return system.color_order[idx];
}

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const [, m, d] = iso.split("-").map(Number);
  return `${m}/${d}`;
}

export default function GradePage() {
  const navigate = useNavigate();
  const [grade, setGrade] = useState<MeGradeResponse | null>(null);
  const [levels, setLevels] = useState<MyGymLevels | null>(null);
  const [baseGymPick, setBaseGymPick] = useState<string | null>(loadBaseGym);
  const [showBasePicker, setShowBasePicker] = useState(false);
  const [showUnvisited, setShowUnvisited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeline, setTimeline] = useState<GradeTimelinePoint[]>([]);
  const [weeks, setWeeks] = useState<number>(12); // 추이 조회 기간
  const [activity, setActivity] = useState<DailyActivity[] | null>(null); // 잔디 (최근 26주)
  const [showScoreInfo, setShowScoreInfo] = useState(false);

  // 암장별 내 수준 — 가 본 암장 실제 기록 + 안 가 본 공식 암장 추정 (요청 1번)
  useEffect(() => {
    getMyGymLevels()
      .then(setLevels)
      .catch(() => {
        // 실패해도 점수는 표시 (기준 암장 해석·암장별 수준만 빠짐)
      });
  }, []);

  // 클라이밍 기록(잔디) — 26주(182일) 고정
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

  // 그레이드 조회 — 종합점수는 기준 암장과 무관해서 한 번만
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

  // 기준 암장: 이 기기에서 고른 암장(목록에 있을 때만) → 없으면 최근 90일 가장 많이 기록한 암장
  const baseLevel: GymLevel | null = levels
    ? (levels.gyms.find((g) => g.gym_name === baseGymPick) ??
      levels.gyms.find((g) => g.gym_name === levels.default_base_gym) ??
      null)
    : null;
  const pickBaseGym = (name: string | null) => {
    saveBaseGym(name);
    setBaseGymPick(name);
    setShowBasePicker(false);
  };

  const visitedGyms = levels?.gyms.filter((g) => g.visited) ?? [];
  const unvisitedGyms = levels?.gyms.filter((g) => !g.visited && g.estimated_top_label) ?? [];
  const usualScore = grade && grade.color.counted_days > 0 ? grade.color.comprehensive_score : null;

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

          {/* ── color 히어로 카드 — 기준 암장은 제목을 눌러 바꿈 ── */}
          <HeroTrackCard
            title={baseLevel ? `${baseLevel.gym_name} 기준 종합 점수` : "내 종합 점수"}
            onTitleClick={levels && levels.gyms.length > 0 ? () => setShowBasePicker(true) : undefined}
            score={grade.color.comprehensive_score}
            countedDays={grade.color.counted_days}
            levelText={
              // 카드 제목에 기준 암장이 이미 있어 색만 표시
              baseLevel ? `${colorLabel(colorLevel(grade.color.comprehensive_score, baseLevel))} 수준` : null
            }
            // 가 본 암장 = 그 암장 실제 최고 완등, 안 가 본 암장 = 보정치 기반 추정
            ratingLabel={
              baseLevel
                ? (baseLevel.visited ? baseLevel.top_label : baseLevel.estimated_top_label)
                : grade.color.top_rating_label
            }
            ratingEstimated={!!baseLevel && !baseLevel.visited}
            gaugeGym={baseLevel}
            countedLogs={grade.color.counted_logs}
            nextGradeLabel={baseLevel ? baseLevel.next_grade_label : grade.color.next_grade_label}
            readinessPct={baseLevel ? baseLevel.readiness_pct : grade.color.readiness_pct}
            colorTrack
            onInfoClick={() => setShowScoreInfo(true)}
          />
        </>
      )}

      {showScoreInfo && (
        <ScoreInfoSheet onClose={() => setShowScoreInfo(false)} />
      )}

      {showBasePicker && levels && (
        <BaseGymSheet
          levels={levels}
          current={baseLevel?.gym_name ?? null}
          picked={levels.gyms.some((g) => g.gym_name === baseGymPick)}
          onPick={pickBaseGym}
          onClose={() => setShowBasePicker(false)}
        />
      )}

      {timeline.length > 0 && (
        <GradeTrendChart
          data={timeline}
          weeks={weeks}
          onWeeksChange={setWeeks}
        />
      )}

      {activity && activity.length > 0 && <ActivityHeatmap data={activity} />}

      {/* 암장별 내 수준 — 가 본 암장은 실제 기록, 안 가 본 암장은 보정치 기반 추정 */}
      {grade && (visitedGyms.length > 0 || unvisitedGyms.length > 0) && (
        <div className="rounded-card bg-white p-5 shadow-card" data-testid="gym-levels">
          <div className="text-sm font-bold text-title">암장별 내 수준</div>
          <div className="mb-3.5 mt-0.5 text-[11px] text-muted">
            최고 = 그 암장에서 실제로 완등한 색 · 평소 = 종합 점수를 그 암장 색으로
          </div>
          <div className="flex flex-col gap-2.5">
            {visitedGyms.map((g) => (
              <GymLevelRow key={g.gym_name} gym={g} top={g.top_label} usualScore={usualScore} />
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

          {unvisitedGyms.length > 0 && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setShowUnvisited((v) => !v)}
                aria-expanded={showUnvisited}
                className="flex w-full items-center justify-between rounded-xl px-1 py-1.5 text-[12px] font-semibold text-secondary"
              >
                <span>안 가 본 암장 {unvisitedGyms.length}곳 · 추정</span>
                <span className="text-hint">{showUnvisited ? "접기 ▴" : "보기 ▾"}</span>
              </button>
              {showUnvisited && (
                <>
                  <p className="mb-2 mt-1 px-1 text-[10.5px] leading-[1.5] text-hint">
                    다른 암장 완등을 암장별 난이도 보정치로 옮겨 본 값이에요. 실제 기록이 아니라
                    참고용이에요.
                  </p>
                  <div className="flex flex-col gap-2.5 opacity-75">
                    {unvisitedGyms.map((g) => (
                      <GymLevelRow
                        key={g.gym_name}
                        gym={g}
                        top={g.estimated_top_label}
                        usualScore={usualScore}
                        estimated
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
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

// ── 암장별 내 수준 한 줄 ──
function GymLevelRow({
  gym,
  top,
  usualScore,
  estimated = false,
}: {
  gym: GymLevel;
  top: string | null;
  usualScore: number | null;
  estimated?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-input px-3.5 py-3" data-testid="gym-level-row">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-bold text-title">{gym.gym_name}</span>
          {estimated && (
            <span className="shrink-0 rounded-full bg-black/6 px-1.5 py-[1px] text-[9.5px] font-bold text-muted">
              추정
            </span>
          )}
        </div>
        <div className="mt-0.5 text-[10.5px] text-muted">
          {estimated
            ? `컬러 ${gym.color_order.length}단계`
            : `기록 ${gym.record_count}개 · 최근 ${fmtDate(gym.last_climbed_at)}`}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {top && <ConversionCell kind="최고" code={top} gym={gym} />}
        {usualScore !== null && (
          // 평소 실력 = 종합 점수를 이 암장 보정치 반영해 색으로 (ADR-068)
          <ConversionCell kind="평소" code={colorLevel(usualScore, gym)} gym={gym} />
        )}
      </div>
    </div>
  );
}

// ── 기준 암장 선택 바텀시트 (이 기기에만 저장) ──
function BaseGymSheet({
  levels,
  current,
  picked,
  onPick,
  onClose,
}: {
  levels: MyGymLevels;
  current: string | null;
  picked: boolean; // 사용자가 직접 고른 상태인지 (아니면 자동)
  onPick: (name: string | null) => void;
  onClose: () => void;
}) {
  const visited = levels.gyms.filter((g) => g.visited);
  const unvisited = levels.gyms.filter((g) => !g.visited);
  const row = (g: GymLevel) => {
    const label = g.visited ? g.top_label : g.estimated_top_label;
    const selected = g.gym_name === current && picked;
    return (
      <button
        key={g.gym_name}
        type="button"
        onClick={() => onPick(g.gym_name)}
        className={`flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left ${selected ? "bg-primary-tint" : "bg-input"}`}
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-bold text-title">{g.gym_name}</div>
          <div className="mt-0.5 text-[10.5px] text-muted">
            {g.visited
              ? `기록 ${g.record_count}개${g.recent_count > 0 ? ` · 최근 90일 ${g.recent_count}개` : ""}`
              : "안 가 봄 · 추정"}
          </div>
        </div>
        {label && (
          <span className="shrink-0 text-[12px] font-extrabold" style={{ color: colorTextOnWhite(label) }}>
            {g.visited ? "최고 " : "추정 "}
            {colorLabel(label)}
          </span>
        )}
        {selected && <span className="shrink-0 text-[13px] font-bold text-primary">✓</span>}
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div onClick={onClose} className="absolute inset-0 bg-black/40" aria-hidden />
      <div
        className="relative flex max-h-[80vh] w-full max-w-md flex-col rounded-t-sheet bg-white"
        role="dialog"
        aria-label="기준 암장 선택"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-4">
          <span className="text-[15px] font-extrabold text-title">기준 암장</span>
          <button onClick={onClose} className="flex h-6 w-6 items-center justify-center text-hint" aria-label="닫기">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="mb-3 text-[11px] leading-[1.6] text-muted">
            점수를 어느 암장 색으로 읽을지 정해요. 점수 자체는 바뀌지 않아요. 이 기기에만 저장돼요.
          </p>
          {levels.default_base_gym && (
            <button
              type="button"
              onClick={() => onPick(null)}
              className={`mb-4 flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left ${picked ? "bg-input" : "bg-primary-tint"}`}
            >
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-bold text-title">자동</div>
                <div className="mt-0.5 text-[10.5px] text-muted">
                  최근 90일 가장 많이 기록한 암장 · 지금은 {levels.default_base_gym}
                </div>
              </div>
              {!picked && <span className="shrink-0 text-[13px] font-bold text-primary">✓</span>}
            </button>
          )}
          {visited.length > 0 && (
            <>
              <p className="mb-2 text-[11px] font-bold text-secondary">가 본 암장</p>
              <div className="mb-4 flex flex-col gap-2">{visited.map(row)}</div>
            </>
          )}
          {unvisited.length > 0 && (
            <>
              <p className="mb-2 text-[11px] font-bold text-secondary">안 가 본 암장</p>
              <div className="flex flex-col gap-2 opacity-80">{unvisited.map(row)}</div>
            </>
          )}
        </div>
      </div>
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
  onTitleClick,
  ratingLabel,
  ratingEstimated = false,
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
  onTitleClick?: () => void; // 있으면 제목을 눌러 기준 암장 변경
  ratingLabel: string | null;
  ratingEstimated?: boolean; // 기준 암장을 안 가 봐 최고 색이 추정값
  gaugeGym?: GymScale | null; // 색 띠 게이지 기준 암장 (컬러 트랙)
  countedLogs?: number;
  colorTrack?: boolean;
  nextGradeLabel?: string | null;
  readinessPct?: number | null;
  onInfoClick?: () => void;
}) {
  const titleEl = onTitleClick ? (
    <button
      type="button"
      onClick={onTitleClick}
      aria-label={`${title} — 기준 암장 바꾸기`}
      className="flex items-center gap-1 text-xs font-semibold opacity-85 transition hover:opacity-100"
    >
      {title}
      <span aria-hidden className="text-[10px]">▾</span>
    </button>
  ) : (
    <span className="text-xs font-semibold opacity-85">{title}</span>
  );

  if (countedLogs === 0) {
    // 최고 등급(전체 기간)은 있는데 반영된 날이 없음 = 90일 넘게 쉼
    return (
      <div className="bg-hero-gradient rounded-card-lg p-6 text-white">
        {titleEl}
        <p className="mt-4 text-sm opacity-80">
          {ratingLabel ? "최근 90일 완등 기록이 없어요" : "아직 기록이 없어요"}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-hero-gradient rounded-card-lg p-6 text-white">
      <div className="flex items-center gap-1.5">
        {titleEl}
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
              {ratingEstimated ? "추정 최고" : "최고"} {colorLabel(ratingLabel)}
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
function ScoreGauge({ score, gym }: { score: number; gym: GymScale }) {
  const n = gym.color_order.length;
  const first = gym.color_order[0];
  const last = gym.color_order[n - 1];
  // 점수는 0 아래로 내려가지 않는다(서버 score_ratio 가 0 에서 자름) — 보정치가 음수인 암장의 아래 색
  const pointsOf = (i: number) => Math.max(0, Math.round((i / (n - 1) + gym.difficulty_offset) * FULL_SCALE));
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
function ConversionCell({ kind, code, gym }: { kind: string; code: string; gym: GymScale }) {
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
      desc: "시도(실패) 기록은 점수에 들어가지 않아요. 대신 클라이밍 기록(잔디)에 쌓여요.",
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
