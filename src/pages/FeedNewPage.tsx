import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { colorLabel } from "../lib/colorMap";
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

const today = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD

export default function FeedNewPage() {
  const navigate = useNavigate();
  const { startUpload } = useUpload();
  const { id: editId } = useParams<{ id: string }>();
  const location = useLocation();
  const isEdit = Boolean(editId);
  // 피드에서 넘긴 log (있으면 prefill 즉시, 없으면 단건 GET 폴백)
  const passedLog = (location.state as { log?: ClimbingLog } | null)?.log;

  const [gradeSystem, setGradeSystem] = useState<GradeSystemType>("v_scale");
  const [gradeRaw, setGradeRaw] = useState(""); // v_scale 텍스트 입력용
  const [gymName, setGymName] = useState(""); // v_scale 자유 입력 / color 드롭다운 선택
  const [colorValue, setColorValue] = useState(""); // color 색 선택값
  const [isSuccess, setIsSuccess] = useState(false);
  const [attempts, setAttempts] = useState(1);
  const [climbedAt, setClimbedAt] = useState(today());
  const [categories, setCategories] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [visibility, setVisibility] = useState<VisibilityType>("public");

  const [suggested, setSuggested] = useState<string[]>([]);
  const [gyms, setGyms] = useState<GymGradeSystem[]>([]);
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

  // 선택된 짐의 color_order (color 색 드롭다운용)
  const selectedGym = gyms.find((g) => g.gym_name === gymName);

  async function handleSubmit() {
    // 그레이드 체계별 grade_raw 결정 + 검증
    let finalGradeRaw: string;
    if (gradeSystem === "v_scale") {
      const v = gradeRaw.trim().toUpperCase(); // 드롭다운 값(V0~V17), 안전상 정규화 유지
      if (!v) {
        setError("그레이드를 선택해주세요");
        return;
      }
      finalGradeRaw = v;
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
    <div className="mx-auto max-w-xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-medium text-gray-900">{isEdit ? "기록 수정" : "기록하기"}</h1>
        <button
          onClick={() => navigate("/feed")}
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          취소
        </button>
      </div>

      <div className="space-y-5 rounded-2xl border border-gray-200 bg-white p-6">
        {/* 그레이드 체계 토글 */}
        <Field label="그레이드 체계">
          <div className="flex gap-2">
            {(["v_scale", "color"] as const).map((sys) => (
              <button
                key={sys}
                type="button"
                onClick={() => switchSystem(sys)}
                className={[
                  "flex-1 rounded-lg border px-3 py-2 text-sm transition",
                  gradeSystem === sys
                    ? "border-[#D85A30] bg-[#FAECE7] font-medium text-[#D85A30]"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50",
                ].join(" ")}
              >
                {sys === "v_scale" ? "V 스케일" : "컬러"}
              </button>
            ))}
          </div>
        </Field>

        {gradeSystem === "v_scale" ? (
          <>
            {/* V 스케일: 그레이드 드롭다운 + 바위/장소 자유 입력 (자연암반) */}
            <Field label="그레이드">
              <select
                value={gradeRaw}
                onChange={(e) => setGradeRaw(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#D85A30]"
              >
                <option value="">그레이드를 선택하세요</option>
                {Array.from({ length: 18 }, (_, i) => `V${i}`).map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="바위 / 장소 (선택)">
              <input
                value={gymName}
                onChange={(e) => setGymName(e.target.value)}
                placeholder="예: 흔들바위, 비룡폭포 슬랩"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#D85A30]"
              />
            </Field>
          </>
        ) : (
          <>
            {/* 컬러: 짐 드롭다운 → 그 짐의 색 드롭다운 */}
            <Field label="암장">
              <select
                value={gymName}
                onChange={(e) => {
                  setGymName(e.target.value);
                  setColorValue(""); // 짐 바뀌면 색 초기화
                }}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#D85A30]"
              >
                <option value="">암장을 선택하세요</option>
                {gyms.map((g) => (
                  <option key={g.id} value={g.gym_name}>
                    {g.gym_name}
                  </option>
                ))}
              </select>
              {gyms.length === 0 && (
                <p className="mt-1 text-xs text-gray-400">
                  등록된 암장이 없어요. 암장 색체계를 먼저 등록해야 합니다.
                </p>
              )}
            </Field>
            <Field label="색 (난이도)">
              <select
                value={colorValue}
                onChange={(e) => setColorValue(e.target.value)}
                disabled={!selectedGym}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#D85A30] disabled:bg-gray-50 disabled:text-gray-400"
              >
                <option value="">
                  {selectedGym ? "색을 선택하세요" : "암장 먼저 선택"}
                </option>
                {selectedGym?.color_order.map((c, idx) => (
                  <option key={c} value={c}>
                    {colorLabel(c)}
                    {idx === 0 ? " (가장 쉬움)" : ""}
                    {idx === selectedGym.color_order.length - 1
                      ? " (가장 어려움)"
                      : ""}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-400">
                쉬운 색 → 어려운 색 순서로 나열됩니다.
              </p>
            </Field>
          </>
        )}

        {/* 완등 + 시도수 */}
        <div className="flex gap-4">
          <Field label="완등 여부">
            <button
              type="button"
              onClick={() => setIsSuccess((v) => !v)}
              className={[
                "rounded-lg border px-4 py-2 text-sm transition",
                isSuccess
                  ? "border-green-500 bg-green-50 font-medium text-green-700"
                  : "border-gray-200 text-gray-500 hover:bg-gray-50",
              ].join(" ")}
            >
              {isSuccess ? "완등" : "시도"}
            </button>
          </Field>
          <Field label="시도 횟수">
            <input
              type="number"
              min={1}
              max={9999}
              value={attempts}
              onChange={(e) => setAttempts(Math.max(1, Number(e.target.value)))}
              className="w-24 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#D85A30]"
            />
          </Field>
        </div>

        {/* 날짜 */}
        <Field label="클라이밍 날짜">
          <input
            type="date"
            value={climbedAt}
            onChange={(e) => setClimbedAt(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#D85A30]"
          />
        </Field>

        {/* 카테고리 태그 */}
        <Field label="유형 (선택)">
          <div className="flex flex-wrap gap-1.5">
            {suggested.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleCategory(tag)}
                className={[
                  "rounded-full px-2.5 py-1 text-xs transition",
                  categories.includes(tag)
                    ? "bg-[#D85A30] font-medium text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200",
                ].join(" ")}
              >
                #{tag}
              </button>
            ))}
          </div>
        </Field>

        {/* 미디어 (이미지/영상) */}
        <Field label="사진 / 영상 (선택, 영상 1분 이하)">
          {mediaUrl ? (
            <div className="relative">
              {mediaType === "video" ? (
                <video
                  src={mediaUrl}
                  controls
                  className="w-full rounded-lg border border-gray-200"
                />
              ) : (
                <img
                  src={mediaPreview ?? mediaUrl}
                  alt="첨부 미디어"
                  className="max-h-64 w-full rounded-lg border border-gray-200 object-cover"
                />
              )}
              <button
                type="button"
                onClick={removeMedia}
                className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-xs text-white hover:bg-black/80"
              >
                삭제
              </button>
            </div>
          ) : (
            <label
              className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-gray-300 px-4 py-8 text-sm text-gray-500 transition hover:border-[#D85A30] hover:text-[#D85A30]"
            >
              + 사진 또는 영상 추가
              <input
                type="file"
                accept="image/*,video/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
          )}
        </Field>

        {/* 코멘트 */}
        <Field label="메모 (선택)">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="베타, 느낀 점 등"
            className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#D85A30]"
          />
        </Field>

        {/* 공개 범위 */}
        <Field label="공개 범위">
          <div className="flex gap-2">
            {(["public", "private"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVisibility(v)}
                className={[
                  "flex-1 rounded-lg border px-3 py-2 text-sm transition",
                  visibility === v
                    ? "border-[#D85A30] bg-[#FAECE7] font-medium text-[#D85A30]"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50",
                ].join(" ")}
              >
                {v === "public" ? "공개" : "비공개"}
              </button>
            ))}
          </div>
        </Field>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full rounded-lg bg-[#D85A30] py-3 text-sm font-medium text-white transition hover:bg-[#c14f29] disabled:opacity-50"
        >
          {submitting ? "저장 중..." : isEdit ? "수정 완료" : "기록 저장"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs text-gray-500">{label}</label>
      {children}
    </div>
  );
}
