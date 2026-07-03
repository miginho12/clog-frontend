import { useEffect, useState } from "react";
import CommentSection from "./CommentSection";

// 댓글 바텀시트 — 하단에서 올라오는 모달.
// 내부에 기존 CommentSection 을 재사용(bare). 피드/상세 공용.
// 배경 클릭 / X / ESC 로 닫기, 슬라이드업 애니메이션.

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

  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    } else {
      setVisible(false);
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
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        onClick={() => onClose(logId)}
        className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      />

      <div
        className={`relative flex max-h-[85vh] w-full max-w-xl flex-col rounded-t-2xl bg-white transition-transform duration-300 ${
          visible ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="relative flex items-center justify-between border-b border-gray-100 px-5 py-3">
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

        <div className="overflow-y-auto pb-4">
          {logId && <CommentSection logId={logId} bare />}
        </div>
      </div>
    </div>
  );
}
