// 새 버전 안내 (감사 M7). 다음 이동 때 자동 적용되지만, 업로드 중·작성 화면에선 미뤄지므로
// 사용자가 원하는 때 직접 반영할 수 있게 버튼을 둔다.
export default function NewVersionBanner({ blocked }: { blocked: boolean }) {
  return (
    <div
      role="status"
      className="mx-5 mb-2 flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3 shadow-card"
    >
      <p className="min-w-0 flex-1 text-[13px]">
        <span className="font-semibold">새 버전이 있어요</span>
        <span className="block text-[11px] text-muted">
          {blocked ? "업로드가 끝나면 적용할 수 있어요" : "다음 화면 이동 때 자동으로 적용돼요"}
        </span>
      </p>
      <button
        type="button"
        disabled={blocked}
        onClick={() => window.location.reload()}
        className="shrink-0 rounded-full bg-[#D85A30] px-4 py-1.5 text-[12px] font-semibold text-white disabled:opacity-40"
      >
        새로고침
      </button>
    </div>
  );
}
