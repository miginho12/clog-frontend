import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { colorInfo, colorLabel } from "../lib/colorMap";
import { useUpload } from "../lib/upload";
import GymPicker from "../components/GymPicker";
import {
  getSuggestedCategories,
  listGymGradeSystems,
  type ClimbingLogCreateInput,
  type FollowTarget,
  type GradeSystemType,
  type GymGradeSystem,
  type VideoModeType,
  type VisibilityType,
} from "../api/client";

// 상한은 작성 화면(FeedNewPage)·백엔드와 같은 값
const MAX_VIDEO_SECONDS = 60;
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
const MAX_TAGS = 10;
const V_GRADES = Array.from({ length: 18 }, (_, i) => `V${i}`);

const today = () => new Date().toISOString().slice(0, 10);

function formatDateHeader(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  const wd = "일월화수목금토"[new Date(iso + "T00:00:00").getDay()];
  return `${m}월 ${d}일 (${wd})`;
}

// 영상 길이(초). 메타데이터를 못 읽으면 reject.
function readVideoDuration(file: File): Promise<number> {
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

// 카드 한 장 = 게시물 한 건 (영상 1개 = 문제 1개 기록 — 그레이드 집계 단위 유지)
interface BatchItem {
  key: number;
  file: File;
  previewUrl: string;
  isVideo: boolean;
  grade: string; // color 값 또는 V 등급
  isSuccess: boolean;
  attempts: number;
  categories: string[];
  comment: string;
  videoMode: VideoModeType;
  followTarget: FollowTarget | null;
}

// 여러 영상을 한 번에 골라 카드별로 입력 → 대기열(UploadProvider)에 맡기고 피드로.
// 날짜·난이도 기준·암장·공개 범위는 공통값: 한 번에 올리는 영상은 보통 같은 날 같은 암장이고,
// 컬러 그레이드는 암장마다 색 목록이 달라 카드마다 암장을 고르게 하면 입력이 크게 늘어난다.
export default function FeedBatchNewPage() {
  const navigate = useNavigate();
  const { enqueueUploads } = useUpload();

  const [climbedAt, setClimbedAt] = useState(today());
  const [gradeSystem, setGradeSystem] = useState<GradeSystemType>("color");
  const [gymName, setGymName] = useState("");
  const [visibility, setVisibility] = useState<VisibilityType>("public");

  const [items, setItems] = useState<BatchItem[]>([]);
  const [rejected, setRejected] = useState<string[]>([]); // 거부된 파일과 이유
  const [checking, setChecking] = useState(false);
  const [invalidKeys, setInvalidKeys] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const [suggested, setSuggested] = useState<string[]>([]);
  const [gyms, setGyms] = useState<GymGradeSystem[]>([]);
  const nextKey = useRef(1);

  useEffect(() => {
    getSuggestedCategories().then(setSuggested).catch(() => {});
    listGymGradeSystems().then(setGyms).catch(() => {});
  }, []);

  // 화면을 떠날 때 미리보기 blob URL 정리 (파일 자체는 대기열이 들고 있으므로 업로드엔 영향 없음)
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  useEffect(
    () => () => itemsRef.current.forEach((it) => URL.revokeObjectURL(it.previewUrl)),
    [],
  );

  const selectedGym = gyms.find((g) => g.gym_name === gymName);

  // 파일 검증(종류·용량·길이)은 작성 화면과 같은 기준. 통과한 것만 카드로 추가하고
  // 거부된 것은 이유와 함께 목록으로 보여준다 (한 개 때문에 전체가 막히지 않게).
  async function addFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // 같은 파일 재선택 허용
    if (files.length === 0) return;
    setChecking(true);
    setError(null);
    const accepted: BatchItem[] = [];
    const reasons: string[] = [];
    for (const file of files) {
      const isVideo = file.type.startsWith("video/");
      const isImage = file.type.startsWith("image/");
      if (!isVideo && !isImage) {
        reasons.push(`${file.name}: 이미지 또는 영상 파일만 올릴 수 있어요`);
        continue;
      }
      if (isVideo && file.size > MAX_VIDEO_BYTES) {
        reasons.push(`${file.name}: ${MAX_VIDEO_BYTES / 1024 / 1024}MB 초과 (${Math.round(file.size / 1024 / 1024)}MB)`);
        continue;
      }
      if (isVideo) {
        try {
          const duration = await readVideoDuration(file);
          if (duration > MAX_VIDEO_SECONDS) {
            reasons.push(`${file.name}: ${MAX_VIDEO_SECONDS}초 초과 (${Math.round(duration)}초)`);
            continue;
          }
        } catch {
          reasons.push(`${file.name}: 영상 길이를 확인할 수 없어요`);
          continue;
        }
      }
      accepted.push({
        key: nextKey.current++,
        file,
        previewUrl: URL.createObjectURL(file),
        isVideo,
        grade: "",
        isSuccess: true,
        attempts: 1,
        categories: [],
        comment: "",
        videoMode: "normal",
        followTarget: null,
      });
    }
    setItems((prev) => [...prev, ...accepted]);
    setRejected(reasons);
    setChecking(false);
  }

  function patchItem(key: number, changes: Partial<BatchItem>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...changes } : it)));
    if ("grade" in changes) {
      setInvalidKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  function removeItem(key: number) {
    setItems((prev) => {
      const target = prev.find((it) => it.key === key);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((it) => it.key !== key);
    });
  }

  // 체계·암장이 바뀌면 카드의 난이도 값이 새 기준과 안 맞으므로 비운다 (표기 섞임 방지)
  function clearGrades() {
    setItems((prev) => prev.map((it) => ({ ...it, grade: "" })));
  }
  function switchSystem(sys: GradeSystemType) {
    if (sys === gradeSystem) return;
    setGradeSystem(sys);
    setGymName("");
    clearGrades();
    setError(null);
  }
  function changeGym(name: string) {
    if (name !== gymName) clearGrades();
    setGymName(name);
  }

  function handleSubmit() {
    if (items.length === 0) return;
    if (gradeSystem === "color" && !gymName) {
      setError("암장을 선택해주세요");
      return;
    }
    const missing = items.filter((it) => !it.grade);
    if (missing.length > 0) {
      setInvalidKeys(new Set(missing.map((it) => it.key)));
      const nums = missing.map((it) => items.indexOf(it) + 1);
      setError(`${nums.join(", ")}번 기록의 난이도를 선택해주세요`);
      document
        .querySelector(`[data-batch-key="${missing[0].key}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    // 카드 순서대로 대기열에 넣는다 → 업로드·게시도 이 순서 (서버 압축도 같은 순서로 처리)
    enqueueUploads(
      items.map((it) => {
        const payload: ClimbingLogCreateInput = {
          grade_raw: it.grade,
          grade_system: gradeSystem,
          gym_name: gymName.trim() || null,
          is_success: it.isSuccess,
          attempts: it.attempts,
          climbed_at: climbedAt || null,
          categories: it.categories,
          comment: it.comment.trim() || null,
          visibility,
          media_url: null, // Provider 가 업로드 후 채움
          media_type: it.isVideo ? "video" : "image",
          ...(it.isVideo && it.videoMode === "follow"
            ? { video_mode: "follow" as const, follow_target: it.followTarget }
            : {}),
        };
        return { file: it.file, payload };
      }),
    );
    navigate("/feed");
  }

  return (
    <div className="min-h-full rounded-t-sheet bg-white">
      {/* 드래그 핸들 + 헤더 */}
      <div className="flex-none px-[22px] pt-3">
        <div className="mx-auto mb-3.5 h-[5px] w-10 rounded-full bg-line" />
        <div className="flex items-baseline justify-between">
          <span className="text-[18px] font-extrabold text-title">여러 기록 한 번에 올리기</span>
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

      <div className="space-y-[18px] px-[22px] pb-2 pt-3">
        {/* ── 공통값 ── */}
        <Field label="난이도 기준 (모든 기록 공통)">
          <Segment
            options={[
              ["color", "컬러 그레이드"],
              ["v_scale", "V-Scale"],
            ]}
            value={gradeSystem}
            onChange={switchSystem}
          />
        </Field>

        {gradeSystem === "v_scale" ? (
          <Field label="자연 암반 이름">
            <input
              value={gymName}
              onChange={(e) => setGymName(e.target.value)}
              placeholder="예: 불암산 슬랩 바위, 관악산 A볼더"
              className="w-full rounded-input border border-line bg-input px-3.5 py-3 text-[13.5px] font-semibold text-title outline-none placeholder:font-normal placeholder:text-muted"
            />
          </Field>
        ) : (
          <Field label="클라이밍 짐">
            <GymPicker gyms={gyms} value={gymName} onChange={changeGym} />
          </Field>
        )}

        <Field label="공개 범위">
          <Segment
            options={[
              ["public", "전체 공개"],
              ["private", "비공개"],
            ]}
            value={visibility}
            onChange={setVisibility}
          />
        </Field>

        {/* ── 기록별 카드 ── */}
        <Field
          label={`기록 ${items.length}개`}
          trailing={
            checking ? <span className="text-[11px] text-muted">파일 확인 중…</span> : undefined
          }
        >
          <div className="space-y-3">
            {items.map((it, idx) => (
              <BatchCard
                key={it.key}
                item={it}
                index={idx}
                gradeSystem={gradeSystem}
                colors={selectedGym?.color_order ?? null}
                suggested={suggested}
                invalid={invalidKeys.has(it.key)}
                onChange={(changes) => patchItem(it.key, changes)}
                onRemove={() => removeItem(it.key)}
              />
            ))}
          </div>

          <label
            className={
              "mt-3 flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed border-[#D9D3E8] py-[18px] transition hover:opacity-80 " +
              (checking ? "pointer-events-none opacity-50" : "")
            }
          >
            <span className="text-[12.5px] font-semibold text-secondary">
              {items.length === 0 ? "사진/영상 여러 개 선택" : "더 추가하기"}
            </span>
            <span className="text-[11px] text-muted">영상은 최대 60초 · 500MB, 개수 제한 없음</span>
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={addFiles}
              className="hidden"
            />
          </label>

          {rejected.length > 0 && (
            <div className="mt-2 rounded-xl bg-input p-3">
              <p className="mb-1 text-[11px] font-bold text-danger">추가하지 못한 파일 {rejected.length}개</p>
              {rejected.map((r) => (
                <p key={r} className="truncate text-[11px] text-muted">{r}</p>
              ))}
            </div>
          )}
        </Field>

        {items.length > 0 && (
          <p className="text-[11px] text-hint">
            올리기를 누르면 순서대로 하나씩 업로드돼요. 업로드가 끝날 때까지 앱을 닫지 말아 주세요
            (다른 화면으로 이동은 괜찮아요).
          </p>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}
      </div>

      <div className="border-t border-segment px-[22px] pb-28 pt-3">
        <button
          onClick={handleSubmit}
          disabled={items.length === 0 || checking}
          className="w-full rounded-2xl bg-primary py-[15px] text-[15px] font-extrabold text-white transition disabled:opacity-50"
        >
          {items.length === 0 ? "기록을 추가해 주세요" : `기록 ${items.length}개 올리기`}
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

// ── 카드: 기록 한 건 입력 ──
function BatchCard({
  item,
  index,
  gradeSystem,
  colors,
  suggested,
  invalid,
  onChange,
  onRemove,
}: {
  item: BatchItem;
  index: number;
  gradeSystem: GradeSystemType;
  colors: string[] | null; // 선택한 암장의 색 순서 (없으면 암장 미선택)
  suggested: string[];
  invalid: boolean;
  onChange: (changes: Partial<BatchItem>) => void;
  onRemove: () => void;
}) {
  // 해시태그·메모는 자주 쓰지 않아 접어 둔다 (카드가 길어지면 여러 개를 훑어보기 어려움)
  const [moreOpen, setMoreOpen] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [tagError, setTagError] = useState<string | null>(null);

  function toggleTag(tag: string) {
    if (item.categories.includes(tag)) {
      onChange({ categories: item.categories.filter((t) => t !== tag) });
      return;
    }
    if (item.categories.length >= MAX_TAGS) {
      setTagError(`태그는 최대 ${MAX_TAGS}개까지 추가할 수 있어요`);
      return;
    }
    setTagError(null);
    onChange({ categories: [...item.categories, tag] });
  }

  // 서버 검증(최대 30자, 최대 10개, 중복 제거)과 같은 기준
  function addCustomTag() {
    const tag = tagInput.trim().replace(/^#/, "");
    setTagError(null);
    if (!tag) return;
    if (tag.length > 30) return setTagError("태그는 30자 이하로 입력해 주세요");
    if (item.categories.includes(tag)) return setTagError("이미 추가된 태그예요");
    if (item.categories.length >= MAX_TAGS) return setTagError(`태그는 최대 ${MAX_TAGS}개까지 추가할 수 있어요`);
    onChange({ categories: [...item.categories, tag] });
    setTagInput("");
  }

  const gradeLabel = item.grade
    ? gradeSystem === "color"
      ? colorLabel(item.grade)
      : item.grade
    : null;

  return (
    <div
      data-batch-key={item.key}
      className={
        "rounded-2xl border bg-white p-3 " +
        (invalid ? "border-danger" : "border-line")
      }
    >
      {/* 머리: 번호 · 미리보기 · 파일명 · 삭제 */}
      <div className="flex items-start gap-3">
        <div className="relative h-[72px] w-[54px] shrink-0 overflow-hidden rounded-xl bg-black">
          {item.isVideo ? (
            // #t=0.1: 첫 프레임이 검은 화면인 경우가 많아 살짝 뒤 프레임을 썸네일로
            <video
              src={`${item.previewUrl}#t=0.1`}
              preload="metadata"
              muted
              playsInline
              className="h-full w-full object-cover"
            />
          ) : (
            <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
          )}
          <span className="absolute left-1 top-1 rounded-md bg-black/60 px-1.5 text-[10px] font-bold text-white">
            {index + 1}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-semibold text-title">{item.file.name}</p>
          <p className="text-[11px] text-muted">
            {item.isVideo ? "영상" : "사진"} · {Math.max(1, Math.round(item.file.size / 1024 / 1024))}MB
            {gradeLabel && (
              <>
                {" · "}
                <span className="font-extrabold text-title">{gradeLabel}</span>
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 rounded-lg px-2 py-1 text-xs text-muted hover:bg-segment"
          aria-label={`${index + 1}번 기록 삭제`}
        >
          삭제
        </button>
      </div>

      {/* 난이도 */}
      <div className="mt-3">
        {gradeSystem === "color" ? (
          colors ? (
            <div className="flex flex-wrap gap-2.5">
              {colors.map((c) => {
                const active = c === item.grade;
                const ci = colorInfo(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onChange({ grade: c })}
                    className="h-7 w-7 rounded-full"
                    style={{
                      backgroundColor: ci.bg,
                      border: ci.bg === "#F5F5F5" ? "1px solid #D9D3E8" : "none",
                      transform: active ? "scale(1.18)" : "scale(1)",
                      boxShadow: active ? `0 0 0 2px #fff, 0 0 0 4px ${ci.bg}` : "none",
                      transition: "transform .3s cubic-bezier(.2,2,.4,1), box-shadow .3s",
                    }}
                    aria-label={colorLabel(c)}
                    aria-pressed={active}
                  />
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted">위에서 암장을 먼저 선택하세요.</p>
          )
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {V_GRADES.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => onChange({ grade: v })}
                aria-pressed={v === item.grade}
                className={
                  "rounded-lg px-2.5 py-1.5 text-[12px] font-extrabold transition " +
                  (v === item.grade ? "bg-primary text-white" : "bg-input text-secondary")
                }
              >
                {v}
              </button>
            ))}
          </div>
        )}
        {invalid && <p className="mt-1 text-[11px] text-danger">난이도를 선택해주세요</p>}
      </div>

      {/* 결과 · 시도 횟수 */}
      <div className="mt-3 flex items-center gap-2">
        <div className="flex-1">
          <Segment
            options={[
              [true, "완등"],
              [false, "도전"],
            ]}
            value={item.isSuccess}
            onChange={(v) => onChange({ isSuccess: v })}
            small
          />
        </div>
        <div className="flex items-center gap-2 rounded-input bg-segment px-1.5 py-1">
          <button
            type="button"
            onClick={() => onChange({ attempts: Math.max(1, item.attempts - 1) })}
            className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-white text-sm font-bold text-title"
            aria-label="시도 횟수 줄이기"
          >
            −
          </button>
          <span className="min-w-[16px] text-center text-[13px] font-extrabold text-title">{item.attempts}</span>
          <button
            type="button"
            onClick={() => onChange({ attempts: Math.min(9999, item.attempts + 1) })}
            className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-white text-sm font-bold text-title"
            aria-label="시도 횟수 늘리기"
          >
            +
          </button>
        </div>
      </div>

      {/* 들찍 모드 (영상만) */}
      {item.isVideo && (
        <div className="mt-2">
          <Segment
            options={[
              ["normal", "일반 영상"],
              ["follow", "들찍 영상"],
            ]}
            value={item.videoMode}
            onChange={(v) => onChange({ videoMode: v, followTarget: null })}
            small
          />
          {item.videoMode === "follow" && (
            <p className="mt-1 text-[11px] text-muted">따라갈 사람은 자동으로 선정돼요.</p>
          )}
        </div>
      )}

      {/* 해시태그 · 메모 (접힘) */}
      <button
        type="button"
        onClick={() => setMoreOpen((v) => !v)}
        className="mt-2 text-[11.5px] font-bold text-muted"
      >
        {moreOpen ? "▾" : "▸"} 해시태그 · 메모
        {(item.categories.length > 0 || item.comment.trim()) && (
          <span className="ml-1 text-primary">
            ({[item.categories.length > 0 && `태그 ${item.categories.length}`, item.comment.trim() && "메모"]
              .filter(Boolean)
              .join(" · ")})
          </span>
        )}
      </button>
      {moreOpen && (
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {Array.from(new Set([...suggested, ...item.categories])).map((tag) => {
              const active = item.categories.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={
                    "rounded-full px-2.5 py-1 text-[11px] font-bold " +
                    (active ? "border border-[#C9B8F0] bg-primary-tint text-primary" : "border border-transparent bg-input text-muted")
                  }
                >
                  #{tag}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2 rounded-full bg-input px-3 py-1.5">
            <span className="text-xs text-hint">#</span>
            <input
              value={tagInput}
              onChange={(e) => {
                setTagInput(e.target.value);
                setTagError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  addCustomTag();
                }
              }}
              maxLength={30}
              placeholder="태그 직접 입력"
              className="min-w-0 flex-1 bg-transparent text-xs text-title outline-none placeholder:text-hint"
            />
            <button
              type="button"
              onClick={addCustomTag}
              disabled={!tagInput.trim()}
              className="shrink-0 text-xs font-bold text-primary disabled:opacity-40"
            >
              추가
            </button>
          </div>
          {tagError && <p className="text-[11px] text-danger">{tagError}</p>}
          <textarea
            value={item.comment}
            onChange={(e) => onChange({ comment: e.target.value })}
            rows={2}
            placeholder="베타, 무브, 컨디션 등…"
            className="w-full resize-none rounded-xl bg-input p-3 text-[12.5px] text-body outline-none placeholder:text-muted"
          />
        </div>
      )}
    </div>
  );
}

function Segment<T extends string | boolean>({
  options,
  value,
  onChange,
  small,
}: {
  options: [T, string][];
  value: T;
  onChange: (v: T) => void;
  small?: boolean;
}) {
  return (
    <div className="flex rounded-input bg-segment p-1">
      {options.map(([v, label]) => (
        <button
          key={String(v)}
          type="button"
          onClick={() => onChange(v)}
          className={
            "flex-1 rounded-[11px] font-bold transition " +
            (small ? "py-1.5 text-[12px] " : "py-[9px] text-[12.5px] ") +
            (value === v ? "bg-white text-title shadow-[0_1px_4px_rgba(90,70,140,.15)]" : "text-muted")
          }
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Field({
  label,
  trailing,
  children,
}: {
  label: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <label className="text-xs font-bold text-muted">{label}</label>
        {trailing}
      </div>
      {children}
    </div>
  );
}
