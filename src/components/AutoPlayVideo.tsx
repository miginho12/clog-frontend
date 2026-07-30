import { useEffect, useRef, useState } from "react";

// 인스타 피드 기준: 세로는 4:5, 가로는 1.91:1 까지만 원본 비율을 쓰고
// 그 밖의 극단적 비율은 경계값으로 clamp 한다 (완전히 안 잘리게 하는 게 아니라
// 흔한 비율의 크롭을 없애는 절충안).
const MIN_RATIO = 4 / 5;
const MAX_RATIO = 1.91;

// 뷰포트에 보이면 자동재생, 벗어나면 정지 + 미니멀 커스텀 컨트롤 (인스타 스타일).
// 피드 카드 / 게시물 상세에서 공용으로 사용.
export default function AutoPlayVideo({ src }: { src: string }) {
  // 지연 로딩 트리거 관찰 대상(항상 존재하는 래퍼) — video 엘리먼트 자체를
  // 관찰하면 src 없는 <video> 태그가 미리 DOM에 남아있어야 하는데, 일부
  // WebView(Android, Capacitor 앱)는 src 없는 <video> 를 "깨진 미디어"
  // 아이콘으로 렌더링한다(2026-07-30 실기기에서 발견). 그래서 video 는
  // shouldLoad 되기 전엔 DOM에 아예 안 만든다.
  const wrapperRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0); // 0~100
  // 메타데이터 로드 전 기본값(4:5 placeholder) → loadedmetadata 시 실제 비율로 교체
  const [ratio, setRatio] = useState(MIN_RATIO);
  // 뷰포트 근처에 오기 전에는 video 자체를 마운트하지 않는다.
  // 마운트되는 순간 preload=metadata 로 첫 프레임을 받아오므로, 화면 밖
  // 영상까지 동시에 마운트되면 프록시가 버티지 못한다 (nginx 버퍼 고갈 → 503).
  const [shouldLoad, setShouldLoad] = useState(false);

  // 로딩 트리거: 화면에 들어오기 400px 전에 video 를 마운트한다 (스크롤 매끄럽게)
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || shouldLoad) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [shouldLoad]);

  // 뷰포트 자동재생/정지 (실제로 보일 때만) — video 가 마운트된 이후에만 관찰
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !shouldLoad) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      { threshold: 0.6 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [shouldLoad]);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  }

  function toggleMute(e: React.MouseEvent) {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  }

  function handleSeek(e: React.MouseEvent<HTMLDivElement>) {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video || !video.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const seekRatio = (e.clientX - rect.left) / rect.width;
    video.currentTime = seekRatio * video.duration;
  }

  function handleLoadedMetadata(e: React.SyntheticEvent<HTMLVideoElement>) {
    const video = e.currentTarget;
    if (!video.videoWidth || !video.videoHeight) return;
    const natural = video.videoWidth / video.videoHeight;
    setRatio(Math.min(MAX_RATIO, Math.max(MIN_RATIO, natural)));
  }

  return (
    <div
      ref={wrapperRef}
      className="group relative w-full overflow-hidden rounded-2xl bg-black"
      style={{ aspectRatio: ratio }}
    >
      {shouldLoad && (
        <video
          ref={videoRef}
          src={src}
          preload="metadata"
          muted={muted}
          loop
          playsInline
          onClick={togglePlay}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={(e) => {
            const v = e.currentTarget;
            if (v.duration) setProgress((v.currentTime / v.duration) * 100);
          }}
          className="h-full w-full cursor-pointer object-cover object-top"
        />
      )}

      {shouldLoad && !playing && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label="재생"
          className="absolute inset-0 flex items-center justify-center"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </button>
      )}

      {shouldLoad && (
        <>
          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? "음소거 해제" : "음소거"}
            className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur transition hover:bg-black/70"
          >
            {muted ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
              </svg>
            )}
          </button>

          <div
            onClick={handleSeek}
            role="slider"
            aria-label="재생 위치"
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
            tabIndex={0}
            className="absolute bottom-0 left-0 right-0 h-1 cursor-pointer bg-white/25"
          >
            <div className="h-full bg-white" style={{ width: `${progress}%` }} />
          </div>
        </>
      )}
    </div>
  );
}
