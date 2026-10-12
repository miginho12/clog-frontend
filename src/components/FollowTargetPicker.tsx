import { useEffect, useRef, useState } from "react";
import type { FollowTarget } from "../api/client";
import { tapToTarget, targetToPercent } from "../lib/followTarget";

function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

interface Props {
  src: string; // 로컬 blob URL
  target: FollowTarget | null;
  onChange: (target: FollowTarget | null) => void;
}

// 들찍 대상 선택: 미리보기를 멈추고 따라갈 사람을 탭한다 (선택 사항).
// 기본 controls 를 쓰지 않는 이유: 영상 전체를 탭 영역으로 덮어야 하는데,
// 기본 컨트롤 바 높이가 iOS/Android WebView 마다 달라 그 부분만 피하기 어렵다.
export default function FollowTargetPicker({ src, target, onChange }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  // 미리보기 재생 불가(예: Android 에서 iPhone HEVC) → 탭 불가, 자동 선정으로 진행
  const [unplayable, setUnplayable] = useState(false);
  // 마커 위치 계산용 크기. 렌더 중 ref 를 읽지 않도록 state 로 둔다
  // (영상 원본 크기는 loadedmetadata, 표시 크기는 ResizeObserver — 회전/리사이즈 대응).
  const [videoSize, setVideoSize] = useState({ w: 0, h: 0 });
  const [boxSize, setBoxSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() =>
      setBoxSize({ w: el.clientWidth, h: el.clientHeight }),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  }

  function handleTap(e: React.PointerEvent<HTMLDivElement>) {
    const v = videoRef.current;
    if (!v) return;
    v.pause(); // 탭한 순간의 장면에 고정
    const rect = e.currentTarget.getBoundingClientRect();
    const next = tapToTarget(
      e.clientX - rect.left,
      e.clientY - rect.top,
      rect.width,
      rect.height,
      v.videoWidth,
      v.videoHeight,
      v.currentTime,
    );
    if (next) onChange(next);
  }

  const marker =
    target && videoSize.w && boxSize.w
      ? targetToPercent(target, boxSize.w, boxSize.h, videoSize.w, videoSize.h)
      : null;

  if (unplayable) {
    return (
      <div className="rounded-2xl bg-segment px-4 py-6 text-center text-xs text-muted">
        이 기기에서는 미리보기를 재생할 수 없어요.
        <br />
        따라갈 사람은 자동으로 선택돼요.
      </div>
    );
  }

  return (
    <div>
      <div className="relative">
        <video
          ref={videoRef}
          src={src}
          playsInline
          preload="metadata"
          className="max-h-[60vh] w-full rounded-2xl bg-black object-contain"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => {
            const el = e.currentTarget;
            setDuration(el.duration);
            if (!el.videoWidth) setUnplayable(true);
            setVideoSize({ w: el.videoWidth, h: el.videoHeight });
            setBoxSize({ w: el.clientWidth, h: el.clientHeight });
          }}
          onError={() => setUnplayable(true)}
        />
        {/* 탭 영역: 영상 전체를 덮는다 */}
        <div
          role="button"
          aria-label="따라갈 사람 탭하기"
          onPointerUp={handleTap}
          className="absolute inset-0 cursor-crosshair rounded-2xl"
        />
        {marker && (
          <span
            className="pointer-events-none absolute h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-primary/40 shadow-[0_0_0_2px_rgba(124,92,216,.9)]"
            style={marker}
          />
        )}
      </div>

      {/* 재생 컨트롤 */}
      <div className="mt-2 flex items-center gap-2.5">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? "일시정지" : "재생"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary"
        >
          {playing ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <rect x="5" y="4" width="5" height="16" rx="1" />
              <rect x="14" y="4" width="5" height="16" rx="1" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 4v16l13-8z" />
            </svg>
          )}
        </button>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.05}
          value={current}
          onChange={(e) => {
            const v2 = videoRef.current;
            if (!v2) return;
            v2.pause();
            v2.currentTime = Number(e.target.value);
          }}
          aria-label="재생 위치"
          className="min-w-0 flex-1 accent-[#7C5CD8]"
        />
        <span className="shrink-0 text-[11px] tabular-nums text-muted">
          {formatTime(current)} / {formatTime(duration)}
        </span>
      </div>

      {/* 안내 / 선택 상태 */}
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted">
          {target
            ? `${formatTime(target.t)} 장면에서 선택했어요 · 다시 탭하면 바뀌어요`
            : "영상을 멈추고 따라갈 사람을 탭하세요 (안 하면 자동 선택)"}
        </p>
        {target && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="shrink-0 text-[11px] font-bold text-primary"
          >
            선택 해제
          </button>
        )}
      </div>
    </div>
  );
}
