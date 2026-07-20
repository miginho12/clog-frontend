import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { colorInfo, colorLabel } from "../lib/colorMap";
import { useUpload } from "../lib/upload";
import {
  createClimbingLog,
  updateClimbingLog,
  getClimbingLog,
  getSuggestedCategories,
  listGymGradeSystems,
  ApiError,
  type ClimbingLog,
  type GradeSystemType,
  type VisibilityType,
  type GymGradeSystem,
} from "../api/client";

const MAX_VIDEO_SECONDS = 60; // 영상 1분 제한
const V_GRADES = Array.from({ length: 18 }, (_, i) => `V${i}`); // V0~V17 (실데이터 전체 범위)

const today = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD

function formatDateHeader(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  const wd = "일월화수목금토"[new Date(iso + "T00:00:00").getDay()];
  return `${m}월 ${d}일 (${wd})`;
}

export default function FeedNewPage() {
  const navigate = useNavigate();
  const { startUpload } = useUpload();
  const { id: editId } = useParams<{ id: string }>();
  const location = useLocation();
  const isEdit = Boolean(editId);
  // 피드에서 넘긴 log (있으면 prefill 즉시, 없으면 단건 GET 폴백)
  const passedLog = (location.state as { log?: ClimbingLog } | null)?.log;
  // 암장 피드(/gyms/:gymName)의 "첫 기록 남기기"에서 넘어온 경우 그 암장으로 prefill.
  const presetGymName = (location.state as { gymName?: string } | null)
    ?.gymName;

  // 시안 기본값은 컬러 그레이드(실내 암장이 더 흔한 케이스) — 신규 작성만.
  // 수정 모드는 기존 값으로 뒤에서 덮어씀.
  const [gradeSystem, setGradeSystem] = useState<GradeSystemType>("color");
  const [gradeRaw, setGradeRaw] = useState(""); // v_scale 선택값
  const [gymName, setGymName] = useState(presetGymName ?? ""); // v_scale 자유 입력 / color 드롭다운 선택
  const [colorValue, setColorValue] = useState(""); // color 색 선택값
  const [isSuccess, setIsSuccess] = useState(true);
  const [attempts, setAttempts] = useState(1);
  const [climbedAt, setClimbedAt] = useState(today());
  const [categories, setCategories] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [visibility, setVisibility] = useState<VisibilityType>("public");

  const [suggested, setSuggested] = useState<string[]>([]);
  const [gyms, setGyms] = useState<GymGradeSystem[]>([]);
  const [gymPickerOpen, setGymPickerOpen] = useState(false);
  const [gymQuery, setGymQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 미디어 업로드 상태
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<string | null>(null); // "image" | "video"
  const [mediaPreview, setMediaPreview] = useState<string | null>(null); // 로컬 미리보기 objectURL
  const [mediaFile, setMediaFile] = useState<File | null>(null); // 선택 파일 (제출 시 백그라운드 업로드)

  useEffect(() => {
    getSuggestedCategories().then(setSuggested).catch(() => {});
    listGymGradeSystems().then(setGyms).catch(() => {});
  }, []);

  // 수정 모드: 기존 값으로 폼 채우기 (state 우선, 없으면 단건 GET)
  useEffect(() => {
    if (!isEdit || !editId) return;
    const apply = (log: ClimbingLog) => {
      setGradeSystem(log.grade_system as GradeSystemType);
      if (log.grade_system === "v_scale") {
        setGradeRaw(log.grade_raw);
        setGymName(log.gym_name ?? "");
      } else {
        setGymName(log.gym_name ?? "");
        setColorValue(log.grade_raw);
      }
      setIsSuccess(log.is_success);
      setAttempts(log.attempts);
      setClimbedAt(log.climbed_at);
      setCategories(log.categories);
      setComment(log.comment ?? "");
      setVisibility(log.visibility as VisibilityType);
      if (log.media_url) {
        setMediaUrl(log.media_url);
        setMediaType(log.media_type);
      }
    };
    if (passedLog) {
      apply(passedLog);
    } else {
      getClimbingLog(editId).then(apply).catch(() => {
        setError("기록을 불러올 수 없습니다");
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, editId]);

  // 체계 전환 시 그레이드/짐 관련 입력 초기화 (표기 섞임 방지)
  function switchSystem(sys: GradeSystemType) {
    setGradeSystem(sys);
    setGradeRaw("");
    setGymName("");
    setColorValue("");
    setError(null);
  }

  function toggleCategory(tag: string) {
    setCategories((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  // 영상 길이 검증 (1분 초과 거부)
  function checkVideoDuration(file: File): Promise<number> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        resolve(video.duration);
      };
      video.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("영상 정보를 읽을 수 없습니다"));
      };
      video.src = url;
    });
  }

  // 파일 선택 → 검증 → presign → PUT 업로드
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // 같은 파일 재선택 허용
    if (!file) return;

    setError(null);
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    if (!isVideo && !isImage) {
      setError("이미지 또는 영상 파일만 업로드할 수 있습니다");
      return;
    }

    // 영상이면 길이 검증
    if (isVideo) {
      try {
        const duration = await checkVideoDuration(file);
        if (duration > MAX_VIDEO_SECONDS) {
          setError(`영상은 ${MAX_VIDEO_SECONDS}초 이하만 업로드할 수 있어요 (선택: ${Math.round(duration)}초)`);
          return;
        }
      } catch {
        setError("영상 길이를 확인할 수 없습니다");
        return;
      }
    }

    // 즉시 업로드하지 않고 파일만 보관 → 제출 시 백그라운드 업로드.
    // (원본 업로드가 사용자를 붙잡지 않게 하기 위함)
    setMediaFile(file);
    setMediaType(isVideo ? "video" : "image");
    // 로컬 미리보기 (이미지만)
    if (isImage) setMediaPreview(URL.createObjectURL(file));
    else setMediaPreview(null);
  }

  function removeMedia() {
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaUrl(null);
    setMediaType(null);
    setMediaPreview(null);
  }

  // 선택된 짐의 color_order (color 색 그리드용)
  const selectedGym = gyms.find((g) => g.gym_name === gymName);
  const filteredGyms = useMemo(
    () =>
      gymQuery.trim()
        ? gyms.filter((g) => g.gym_name.includes(gymQuery.trim()))
        : gyms,
    [gyms, gymQuery],
  );

  // 저장 버튼 동적 색상/라벨 — 컬러 모드는 선택한 색 hex, V-Scale은 브랜드 보라
  const saveColor =
    gradeSystem === "color" && colorValue ? colorInfo(colorValue).bg : "#7C5CD8";
  const saveGradeLabel =
    gradeSystem === "color"
      ? colorValue
        ? colorLabel(colorValue)
        : "그레이드"
      : gradeRaw || "그레이드";

  async function handleSubmit() {
    // 그레이드 체계별 grade_raw 결정 + 검증
    let finalGradeRaw: string;
    if (gradeSystem === "v_scale") {
      if (!gradeRaw) {
        setError("그레이드를 선택해주세요");
        return;
      }
      finalGradeRaw = gradeRaw;
    } else {
      if (!gymName) {
        setError("암장을 선택해주세요");
        return;
      }
      if (!colorValue) {
        setError("색을 선택해주세요");
        return;
      }
      finalGradeRaw = colorValue;
    }

    const basePayload = {
      grade_raw: finalGradeRaw,
      grade_system: gradeSystem,
      gym_name: gymName.trim() || null,
      is_success: isSuccess,
      attempts,
      climbed_at: climbedAt || null,
      categories,
      comment: comment.trim() || null,
      visibility,
    };

    // 신규 작성 + 새 파일 선택 → 백그라운드 업로드에 위임하고 즉시 피드로.
    // 원본 업로드/게시가 전역 Provider 에서 진행되어 사용자는 자유롭게 이동.
    if (!isEdit && mediaFile) {
      startUpload(mediaFile, {
        ...basePayload,
        media_url: null, // Provider 가 업로드 후 채움
        media_type: mediaType,
      });
      navigate("/feed");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        ...basePayload,
        media_url: mediaUrl,
        media_type: mediaType,
      };
      if (isEdit && editId) {
        await updateClimbingLog(editId, payload);
      } else {
        await createClimbingLog(payload);
      }
      navigate("/feed");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message || "기록 저장에 실패했습니다"
          : "기록 저장에 실패했습니다",
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-full rounded-t-sheet bg-white">
      {/* 드래그 핸들 + 헤더 */}
      <div className="flex-none px-[22px] pt-3">
        <div className="mx-auto mb-3.5 h-[5px] w-10 rounded-full bg-line" />
        <div className="flex items-baseline justify-between">
          <span className="text-[18px] font-extrabold text-title">
            {isEdit ? "기록 수정" : "오늘의 기록"}
          </span>
          <input
            type="date"
            value={climbedAt}
            onChange={(e) => setClimbedAt(e.target.value)}
            className="cursor-pointer bg-transparent text-xs text-muted outline-none [color-scheme:light]"
            style={{ textAlign: "right" }}
          />
        </div>
        <span className="text-xs text-hint">{formatDateHeader(climbedAt)}</span>
      </div>

      {/* 본문 */}
      <div className="space-y-[18px] px-[22px] pb-2 pt-3">
        {/* 난이도 기준 */}
        <Field label="난이도 기준">
          <div className="flex rounded-input bg-segment p-1">
            {(["color", "v_scale"] as const).map((sys) => (
              <button
                key={sys}
                type="button"
                onClick={() => switchSystem(sys)}
                className={
                  "flex-1 rounded-[11px] py-[9px] text-[12.5px] font-bold transition " +
                  (gradeSystem === sys
                    ? "bg-white text-title shadow-[0_1px_4px_rgba(90,70,140,.15)]"
                    : "text-muted")
                }
              >
                {sys === "color" ? "컬러 그레이드" : "V-Scale"}
              </button>
            ))}
          </div>
        </Field>

        {gradeSystem === "v_scale" ? (
          <Field label="자연 암반 이름">
            <div className="flex items-center gap-2 rounded-input border border-line bg-input px-3.5 py-3">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7C5CD8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
              </svg>
              <input
                value={gymName}
                onChange={(e) => setGymName(e.target.value)}
                placeholder="예: 불암산 슬랩 바위, 관악산 A볼더"
                className="flex-1 bg-transparent text-[13.5px] font-semibold text-title outline-none placeholder:font-normal placeholder:text-muted"
              />
            </div>
            <p className="mt-1.5 text-[11px] text-hint">
              암반 이름은 클라이머가 직접 기록해요 — 암장 색체계와 환산되지 않아요.
            </p>
          </Field>
        ) : (
          <Field label="클라이밍 짐">
            <div className="relative z-10">
              <button
                type="button"
                onClick={() => setGymPickerOpen((v) => !v)}
                className="flex w-full items-center justify-between rounded-input border border-line bg-input px-3.5 py-3"
              >
                <span className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7C5CD8" strokeWidth="2" strokeLinecap="round">
                    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <span className="text-[13.5px] font-bold text-title">
                    {gymName || "암장을 선택하세요"}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  {selectedGym && (
                    <span className="text-[11px] text-muted">
                      컬러 {selectedGym.color_order.length}단계
                    </span>
                  )}
                  <svg
                    width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9C93B5" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
                    style={{ transform: gymPickerOpen ? "rotate(180deg)" : "none", transition: "transform .3s" }}
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </span>
              </button>

              {gymPickerOpen && (
                <>
                  {/* 바깥 클릭하면 닫히는 투명 백드롭 */}
                  <button
                    type="button"
                    aria-label="닫기"
                    onClick={() => setGymPickerOpen(false)}
                    className="fixed inset-0 z-10 cursor-default"
                  />
                  <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 rounded-2xl bg-white p-1.5 shadow-[0_16px_40px_rgba(90,70,140,.22)]">
                  <div className="mb-1 flex items-center gap-2 rounded-xl bg-input px-3 py-2">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9C93B5" strokeWidth="2.4" strokeLinecap="round">
                      <circle cx="11" cy="11" r="7" />
                      <path d="m21 21-4-4" />
                    </svg>
                    <input
                      autoFocus
                      value={gymQuery}
                      onChange={(e) => setGymQuery(e.target.value)}
                      placeholder="등록된 암장 검색…"
                      className="flex-1 bg-transparent text-xs text-body outline-none placeholder:text-muted"
                    />
                  </div>
                  <div className="max-h-52 overflow-y-auto">
                    {filteredGyms.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => {
                          setGymName(g.gym_name);
                          setColorValue("");
                          setGymPickerOpen(false);
                          setGymQuery("");
                        }}
                        className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition hover:bg-input"
                      >
                        <span
                          className={
                            "text-[13px] text-title " +
                            (g.gym_name === gymName ? "font-extrabold" : "font-semibold")
                          }
                        >
                          {g.gym_name}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="text-[11px] text-muted">
                            컬러 {g.color_order.length}단계
                          </span>
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{
                              background: g.gym_name === gymName ? "#7C5CD8" : "transparent",
                            }}
                          />
                        </span>
                      </button>
                    ))}
                    {filteredGyms.length === 0 && (
                      <p className="px-3 py-4 text-center text-xs text-muted">
                        일치하는 암장이 없어요.
                      </p>
                    )}
                  </div>
                  </div>
                </>
              )}
            </div>
            {gyms.length === 0 && (
              <p className="mt-1.5 text-[11px] text-hint">
                등록된 암장이 없어요. 암장 색체계를 먼저 등록해야 합니다.
              </p>
            )}
          </Field>
        )}

        {/* 난이도 (색 그리드 / V칩) */}
        <Field
          label="난이도"
          trailing={
            gradeSystem === "color" && colorValue ? (
              <span className="text-xs font-extrabold" style={{ color: colorInfo(colorValue).bg }}>
                {colorLabel(colorValue)}
              </span>
            ) : gradeSystem === "v_scale" && gradeRaw ? (
              <span className="text-xs font-extrabold text-primary">{gradeRaw}</span>
            ) : null
          }
        >
          {gradeSystem === "color" ? (
            selectedGym ? (
              <div className="flex flex-wrap gap-3">
                {selectedGym.color_order.map((c) => {
                  const active = c === colorValue;
                  const ci = colorInfo(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColorValue(c)}
                      className="h-9 w-9 rounded-full transition"
                      style={{
                        backgroundColor: ci.bg,
                        border: ci.bg === "#F5F5F5" ? "1px solid #D9D3E8" : "none",
                        transform: active ? "scale(1.22)" : "scale(1)",
                        boxShadow: active ? `0 0 0 3px #fff, 0 0 0 5px ${ci.bg}` : "none",
                        transition: "transform .3s cubic-bezier(.2,2,.4,1), box-shadow .3s",
                      }}
                      aria-label={colorLabel(c)}
                    />
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted">암장을 먼저 선택하세요.</p>
            )
          ) : (
            <div className="flex flex-wrap gap-2">
              {V_GRADES.map((v) => {
                const active = v === gradeRaw;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setGradeRaw(v)}
                    className={
                      "rounded-xl px-[15px] py-[9px] text-[13px] font-extrabold transition " +
                      (active
                        ? "bg-primary text-white shadow-[0_4px_12px_rgba(124,92,216,.3)]"
                        : "bg-input text-secondary")
                    }
                  >
                    {v}
                  </button>
                );
              })}
            </div>
          )}
        </Field>

        {/* 등반 유형 해시태그 */}
        <Field label="등반 유형 해시태그">
          <div className="flex flex-wrap gap-2">
            {suggested.map((tag) => {
              const active = categories.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleCategory(tag)}
                  className={
                    "rounded-full px-[13px] py-[7px] text-xs font-bold transition " +
                    (active
                      ? "border border-[#C9B8F0] bg-primary-tint text-primary"
                      : "border border-transparent bg-input text-muted")
                  }
                >
                  #{tag}
                </button>
              );
            })}
          </div>
        </Field>

        {/* 결과 + 시도 횟수 */}
        <div className="flex gap-3.5">
          <Field label="결과" className="flex-1">
            <div className="flex rounded-input bg-segment p-1">
              {([true, false] as const).map((v) => (
                <button
                  key={String(v)}
                  type="button"
                  onClick={() => setIsSuccess(v)}
                  className={
                    "flex-1 rounded-[11px] py-[9px] text-[13px] font-bold transition " +
                    (isSuccess === v
                      ? "bg-white text-title shadow-[0_1px_4px_rgba(90,70,140,.15)]"
                      : "text-muted")
                  }
                >
                  {v ? "완등" : "도전"}
                </button>
              ))}
            </div>
          </Field>
          <Field label="시도 횟수">
            <div className="flex items-center gap-3 rounded-input bg-segment px-2 py-1">
              <button
                type="button"
                onClick={() => setAttempts((n) => Math.max(1, n - 1))}
                className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-white text-base font-bold text-title shadow-[0_1px_4px_rgba(90,70,140,.12)]"
              >
                −
              </button>
              <span className="min-w-[18px] text-center text-[15px] font-extrabold text-title">
                {attempts}
              </span>
              <button
                type="button"
                onClick={() => setAttempts((n) => Math.min(9999, n + 1))}
                className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-white text-base font-bold text-title shadow-[0_1px_4px_rgba(90,70,140,.12)]"
              >
                +
              </button>
            </div>
          </Field>
        </div>

        {/* 미디어 (이미지/영상) */}
        <Field label="사진 / 영상 (영상은 최대 60초)">
          {mediaUrl || mediaPreview ? (
            <div className="relative">
              {mediaType === "video" ? (
                <video
                  src={mediaUrl ?? undefined}
                  controls
                  className="w-full rounded-2xl bg-black"
                />
              ) : (
                <img
                  src={mediaPreview ?? mediaUrl ?? undefined}
                  alt="첨부 미디어"
                  className="max-h-64 w-full rounded-2xl object-cover"
                />
              )}
              <button
                type="button"
                onClick={removeMedia}
                className="absolute right-2 top-2 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white hover:bg-black/80"
              >
                삭제
              </button>
            </div>
          ) : (
            <label className="flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed border-[#D9D3E8] py-[22px] transition hover:opacity-80">
              <span className="flex h-10 w-10 items-center justify-center rounded-tile bg-primary-tint">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7C5CD8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m22 8-6 4 6 4V8Z" />
                  <rect x="2" y="6" width="14" height="12" rx="2" />
                </svg>
              </span>
              <span className="text-[12.5px] font-semibold text-secondary">사진/영상 업로드</span>
              <span className="text-[11px] text-muted">최대 60초 영상</span>
              <input
                type="file"
                accept="image/*,video/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
          )}
        </Field>

        {/* 메모 */}
        <Field label="메모">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="베타, 무브, 컨디션 등을 남겨보세요…"
            className="w-full resize-none rounded-2xl bg-input p-3.5 text-[13px] text-body outline-none placeholder:text-muted"
          />
        </Field>

        {/* 공개 범위 */}
        <Field label="공개 범위">
          <div className="flex rounded-input bg-segment p-1">
            {(["public", "private"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVisibility(v)}
                className={
                  "flex-1 rounded-[11px] py-[9px] text-[12.5px] font-bold transition " +
                  (visibility === v
                    ? "bg-white text-title shadow-[0_1px_4px_rgba(90,70,140,.15)]"
                    : "text-muted")
                }
              >
                {v === "public" ? "전체 공개" : "비공개"}
              </button>
            ))}
          </div>
        </Field>

        {error && <p className="text-sm text-danger">{error}</p>}
      </div>

      {/* 저장 버튼 — 하단 탭바(플로팅)와 안 겹치게 폼 마지막 요소로, 여유 패딩 */}
      <div className="border-t border-segment px-[22px] pb-28 pt-3">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full rounded-2xl py-[15px] text-[15px] font-extrabold text-white transition disabled:opacity-50"
          style={{ backgroundColor: saveColor }}
        >
          {submitting
            ? "저장 중..."
            : `${saveGradeLabel} ${isSuccess ? "완등" : "도전"} 기록 저장`}
        </button>
        <button
          onClick={() => navigate("/feed")}
          className="mt-2 w-full py-1 text-center text-xs text-muted"
        >
          취소
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  trailing,
  className,
  children,
}: {
  label: string;
  trailing?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <div className="mb-2 flex items-baseline justify-between">
        <label className="text-xs font-bold text-muted">{label}</label>
        {trailing}
      </div>
      {children}
    </div>
  );
}
