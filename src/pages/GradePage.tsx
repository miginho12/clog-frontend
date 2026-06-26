import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getMyGrade,
  listGymGradeSystems,
  ApiError,
  type MeGradeResponse,
  type GymGradeSystem,
} from "../api/client";
import { clearTokens } from "../lib/auth";
import ScoreGauge from "../components/ScoreGauge";

// 점수 게이지 정규화 기준 (difficulty 최대치 ~11 → 10 기준으로 채움 비율)
const SCORE_MAX = 10;

// 트랙별 게이지 색
const VSCALE_COLOR = "#D85A30"; // 주황 (포인트 컬러)
const COLOR_COLOR = "#7C5CD8"; // 보라 계열

export default function GradePage() {
  const navigate = useNavigate();
  const [grade, setGrade] = useState<MeGradeResponse | null>(null);
  const [gyms, setGyms] = useState<GymGradeSystem[]>([]);
  const [baseGym, setBaseGym] = useState<string>(""); // "" = 자동(최다기록)
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 짐 목록 (base_gym 드롭다운 옵션) — 1회 로드
  useEffect(() => {
    listGymGradeSystems()
      .then(setGyms)
      .catch(() => {
        // 짐 목록 실패는 치명적이지 않음 (드롭다운만 비게 됨)
      });
  }, []);

  // 그레이드 조회 (baseGym 변경 시 재조회)
  useEffect(() => {
    // 데이터 페칭 시작 시 로딩 on — 의도된 패턴 (재조회마다 로딩 표시)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    getMyGrade(baseGym || undefined)
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
  }, [baseGym, navigate]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-medium text-gray-900">내 그레이드</h1>

      {error && (
        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {loading && !grade && (
        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center">
          <p className="text-sm text-gray-400">불러오는 중...</p>
        </div>
      )}

      {grade && (
        <div className="grid gap-4 sm:grid-cols-2">
          {/* ── v_scale 카드 ── */}
          <TrackCard
            title="V 스케일"
            subtitle="V0 ~ V17 표준 등급"
            score={grade.v_scale.comprehensive_score}
            ratingLabel={grade.v_scale.top_rating_label}
            countedLogs={grade.v_scale.counted_logs}
            gaugeColor={VSCALE_COLOR}
          />

          {/* ── color 카드 ── */}
          <TrackCard
            title="컬러"
            subtitle={
              grade.color.base_gym
                ? `${grade.color.base_gym} 기준`
                : "짐별 색 난이도"
            }
            score={grade.color.comprehensive_score}
            ratingLabel={grade.color.top_rating_label}
            countedLogs={grade.color.counted_logs}
            gaugeColor={COLOR_COLOR}
            footer={
              <div className="mt-4 border-t border-gray-100 pt-3">
                <label className="mb-1.5 block text-xs text-gray-500">
                  기준짐
                </label>
                <select
                  value={baseGym}
                  onChange={(e) => setBaseGym(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm outline-none focus:border-[#D85A30]"
                >
                  <option value="">자동 (최다 기록 짐)</option>
                  {gyms.map((g) => (
                    <option key={g.id} value={g.gym_name}>
                      {g.gym_name}
                    </option>
                  ))}
                </select>
              </div>
            }
          />
        </div>
      )}
    </div>
  );
}

// ── 트랙 카드 (v_scale / color 공용) ──
function TrackCard({
  title,
  subtitle,
  score,
  ratingLabel,
  countedLogs,
  gaugeColor,
  footer,
}: {
  title: string;
  subtitle: string;
  score: number;
  ratingLabel: string | null;
  countedLogs: number;
  gaugeColor: string;
  footer?: React.ReactNode;
}) {
  const empty = countedLogs === 0;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900">{title}</p>
          <p className="text-xs text-gray-400">{subtitle}</p>
        </div>
        {ratingLabel && (
          <span
            className="rounded-full px-2.5 py-1 text-xs font-medium text-white"
            style={{ backgroundColor: gaugeColor }}
          >
            최고 {ratingLabel}
          </span>
        )}
      </div>

      {empty ? (
        <p className="mt-6 text-center text-sm text-gray-400">
          아직 기록이 없어요
        </p>
      ) : (
        <>
          <div className="mt-5 flex items-end gap-1">
            <span className="text-3xl font-semibold text-gray-900">
              {score.toFixed(1)}
            </span>
            <span className="mb-1 text-sm text-gray-400">/ {SCORE_MAX}</span>
          </div>
          <div className="mt-3">
            <ScoreGauge score={score} max={SCORE_MAX} color={gaugeColor} />
          </div>
          <p className="mt-2 text-xs text-gray-400">
            상위 {countedLogs}개 기록 반영
          </p>
        </>
      )}

      {footer}
    </div>
  );
}
