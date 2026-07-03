import { useEffect, useRef, useState } from "react";
import CommentSection from "./CommentSection";

// 댓글 바텀시트 — 화면 대부분(80vh)을 덮는 모달.
// 내부에 기존 CommentSection 재사용(bare). 피드/상세 공용.
// 닫기: 배경 클릭 / X / ESC / 아래로 스와이프(드래그 다운).

interface CommentBottomSheetProps {
  logId: string | null; // null 이면 닫힌 상태
  onClose: (closedLogId: string | null) => void;
}

export default function CommentBottomSheet({
  logId,
  onClose,
}: CommentBottomSheetProps) {
  const open = logId !== null;
  const [visible, setVisible] = useState(false);

  // 드래그(아래로 스와이프) 상태
  const [dragY, setDragY] = useState(0);
  const dragStartY = useRef<number | null>(null);
  const dragging = useRef(false);

  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    } else {
      setVisible(false);
      setDragY(0);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose(logId);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, logId]);

  if (!open) return null;

  // ── 드래그 다운 닫기 (헤더 영역에서만 시작) ──
  function onDragStart(clientY: number) {
    dragStartY.current = clientY;
    dragging.current = true;
  }
  function onDragMove(clientY: number) {
    if (!dragging.current || dragStartY.current === null) return;
    const delta = clientY - dragStartY.current;
    // 아래로만 (delta > 0)
    setDragY(Math.max(0, delta));
  }
  function onDragEnd() {
    if (!dragging.current) return;
    dragging.current = false;
    // 120px 이상 내리면 닫기, 아니면 원위치
    if (dragY > 120) {
      onClose(logId);
    } else {
      setDragY(0);
    }
    dragStartY.current = null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        onClick={() => onClose(logId)}
        className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      />

      <div
        className="relative flex h-[80vh] w-full max-w-md flex-col rounded-t-2xl bg-white"
        style={{
          transform: visible
            ? `translateY(${dragY}px)`
            : "translateY(100%)",
          transition: dragging.current
            ? "none"
            : "transform 0.3s ease-out",
        }}
      >
        {/* 핸들바 + 헤더 (여기서 드래그 시작) */}
        <div
          className="relative flex shrink-0 cursor-grab items-center justify-between border-b border-gray-100 px-5 py-3 active:cursor-grabbing"
          onTouchStart={(e) => onDragStart(e.touches[0].clientY)}
          onTouchMove={(e) => onDragMove(e.touches[0].clientY)}
          onTouchEnd={onDragEnd}
          onMouseDown={(e) => onDragStart(e.clientY)}
          onMouseMove={(e) => dragging.current && onDragMove(e.clientY)}
          onMouseUp={onDragEnd}
          onMouseLeave={onDragEnd}
        >
          <div className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-gray-300" />
          <span className="text-sm font-medium text-gray-900">댓글</span>
          <button
            onClick={() => onClose(logId)}
            className="flex h-6 w-6 items-center justify-center text-gray-400 hover:text-gray-600"
            aria-label="닫기"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 댓글 본문 (스크롤) */}
        <div className="flex-1 overflow-y-auto pb-4">
          {logId && <CommentSection logId={logId} bare />}
        </div>
      </div>
    </div>
  );
}
