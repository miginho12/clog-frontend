import { useMemo, useState } from "react";
import type { GymGradeSystem } from "../api/client";

interface Props {
  gyms: GymGradeSystem[];
  value: string;
  onChange: (gymName: string) => void;
}

// 컬러 그레이드용 암장 드롭다운 (검색 + 목록). 일괄 업로드 화면에서 사용.
// FeedNewPage 의 같은 UI 와 모양을 맞췄다 — 추후 FeedNewPage 도 이 컴포넌트로 교체 가능.
export default function GymPicker({ gyms, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = gyms.find((g) => g.gym_name === value);
  const filtered = useMemo(
    () => (query.trim() ? gyms.filter((g) => g.gym_name.includes(query.trim())) : gyms),
    [gyms, query],
  );

  return (
    <>
      <div className="relative z-10">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-input border border-line bg-input px-3.5 py-3"
        >
          <span className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7C5CD8" strokeWidth="2" strokeLinecap="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span className="text-[13.5px] font-bold text-title">{value || "암장을 선택하세요"}</span>
          </span>
          <span className="flex items-center gap-2">
            {selected && (
              <span className="text-[11px] text-muted">컬러 {selected.color_order.length}단계</span>
            )}
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9C93B5" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .3s" }}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
        </button>

        {open && (
          <>
            {/* 바깥 클릭하면 닫히는 투명 백드롭 */}
            <button
              type="button"
              aria-label="닫기"
              onClick={() => setOpen(false)}
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
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="등록된 암장 검색…"
                  className="flex-1 bg-transparent text-xs text-body outline-none placeholder:text-muted"
                />
              </div>
              <div className="max-h-52 overflow-y-auto">
                {filtered.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => {
                      onChange(g.gym_name);
                      setOpen(false);
                      setQuery("");
                    }}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition hover:bg-input"
                  >
                    <span className={"text-[13px] text-title " + (g.gym_name === value ? "font-extrabold" : "font-semibold")}>
                      {g.gym_name}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-[11px] text-muted">컬러 {g.color_order.length}단계</span>
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: g.gym_name === value ? "#7C5CD8" : "transparent" }}
                      />
                    </span>
                  </button>
                ))}
                {filtered.length === 0 && (
                  <p className="px-3 py-4 text-center text-xs text-muted">일치하는 암장이 없어요.</p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
      {gyms.length === 0 && (
        <p className="mt-1.5 text-[11px] text-hint">등록된 암장이 없어요. 암장 색체계를 먼저 등록해야 합니다.</p>
      )}
    </>
  );
}
