// 관리자 페이지 — admin 전용 (AdminRoute 가드)
// 섹션: 암장 관리 (Step 4c) / 사용자 관리 (Step 4d)

import { useEffect, useState } from "react";
import {
  ApiError,
  createGymGradeSystem,
  deleteGymGradeSystem,
  listGymGradeSystems,
  updateGymGradeSystem,
  type GymGradeSystem,
} from "../api/client";
import { colorInfo, colorLabel } from "../lib/colorMap";

// colorMap 에 정의된 색 코드 (DB 저장값). 쉬움→어려움 순서는 admin 이 클릭으로 결정
const PALETTE = [
  "흰", "노", "주", "초", "연두", "파", "빨",
  "핑", "보", "남", "회", "갈", "검",
];

function ColorChip({ code, ...rest }: { code: string } & React.ComponentProps<"span">) {
  const ci = colorInfo(code);
  return (
    <span
      className="flex h-6 min-w-6 items-center justify-center rounded-[7px] px-1.5 text-[10px] font-bold"
      style={{ background: ci.bg, color: ci.fg }}
      {...rest}
    >
      {colorLabel(code)}
    </span>
  );
}

export default function AdminPage() {
  const [gyms, setGyms] = useState<GymGradeSystem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 등록 폼
  const [showForm, setShowForm] = useState(false);
  const [gymName, setGymName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [order, setOrder] = useState<string[]>([]);
  const [isOfficial, setIsOfficial] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // 색 순서 편집 (카드 인라인)
  const [editId, setEditId] = useState<string | null>(null);
  const [editOrder, setEditOrder] = useState<string[]>([]);
  const [editBrandName, setEditBrandName] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const [query, setQuery] = useState("");
  const filteredGyms = query.trim()
    ? gyms.filter((g) =>
        `${g.gym_name} ${g.brand_name ?? ""}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
      )
    : gyms;

  useEffect(() => {
    let alive = true;
    listGymGradeSystems()
      .then((list) => {
        if (!alive) return;
        setGyms(list);
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setError("암장 목록을 불러오지 못했습니다");
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  function resetForm() {
    setGymName("");
    setBrandName("");
    setOrder([]);
    setIsOfficial(true);
    setFormError(null);
  }

  async function handleCreate() {
    if (!gymName.trim()) {
      setFormError("암장 이름을 입력하세요");
      return;
    }
    if (order.length < 2) {
      setFormError("색은 최소 2단계 이상 선택하세요");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const created = await createGymGradeSystem({
        gym_name: gymName.trim(),
        brand_name: brandName.trim() || null,
        color_order: order,
        is_official: isOfficial,
      });
      setGyms((prev) =>
        [...prev, created].sort((a, b) => a.gym_name.localeCompare(b.gym_name)),
      );
      resetForm();
      setShowForm(false);
    } catch (e) {
      setFormError(
        e instanceof ApiError ? e.message : "등록에 실패했습니다",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(g: GymGradeSystem) {
    const warn = g.is_official
      ? `공식 암장 "${g.gym_name}" 을(를) 삭제합니다.\n이 암장의 색 등급 기준이 사라져 기존 기록의 그레이드 산정에 영향을 줍니다.\n\n계속할까요?`
      : `"${g.gym_name}" 을(를) 삭제할까요?`;
    if (!window.confirm(warn)) return;
    try {
      await deleteGymGradeSystem(g.id);
      setGyms((prev) => prev.filter((x) => x.id !== g.id));
    } catch {
      alert("삭제에 실패했습니다");
    }
  }

  function startEdit(g: GymGradeSystem) {
    setEditId(g.id);
    setEditOrder(g.color_order);
    setEditBrandName(g.brand_name ?? "");
  }

  async function handleUpdate(id: string) {
    if (editOrder.length < 2) {
      alert("색은 최소 2단계 이상이어야 합니다");
      return;
    }
    setEditSaving(true);
    try {
      const updated = await updateGymGradeSystem(
        id,
        editOrder,
        editBrandName.trim() || null,
      );
      setGyms((prev) => prev.map((x) => (x.id === id ? updated : x)));
      setEditId(null);
    } catch (e) {
      alert(e instanceof ApiError ? e.message : "수정에 실패했습니다");
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between rounded-[18px] bg-title px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="rounded-[6px] bg-primary px-2 py-[3px] text-[10px] font-extrabold tracking-[.06em] text-white">
            ADMIN
          </span>
          <span className="text-[15px] font-extrabold text-white">암장 관리</span>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowForm((v) => !v);
            if (showForm) resetForm();
          }}
          className="flex items-center gap-1.5 rounded-[10px] bg-primary px-3.5 py-2 text-white"
        >
          <span className="text-[15px] font-bold leading-none">+</span>
          <span className="text-xs font-bold">{showForm ? "취소" : "암장 추가"}</span>
        </button>
      </div>

      <div className="mt-3.5 flex flex-col gap-3">
        <div className="flex items-center gap-2 rounded-xl bg-white px-3.5 py-2.5 shadow-[0_2px_8px_rgba(58,52,80,.06)]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9C93B5" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4-4" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="암장 검색"
            className="flex-1 bg-transparent text-[12.5px] text-title outline-none placeholder:text-muted"
          />
          <span className="shrink-0 text-[12.5px] text-muted">
            총 {gyms.length}개
          </span>
        </div>

        {/* 등록 폼 */}
        {showForm && (
          <div className="rounded-[18px] bg-white p-4 shadow-[0_2px_12px_rgba(58,52,80,.07)]">
            <label className="mb-1.5 block text-xs font-bold text-muted">
              암장 이름
            </label>
            <input
              value={gymName}
              onChange={(e) => setGymName(e.target.value)}
              placeholder="예: 더클라임 강남"
              className="mb-3 w-full rounded-xl bg-input px-3 py-2.5 text-sm text-title outline-none"
            />

            <label className="mb-1.5 block text-xs font-bold text-muted">
              브랜드 <span className="font-normal text-hint">(선택 — 같은 브랜드 지점끼리 묶어보기)</span>
            </label>
            <input
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="예: 더클라임"
              className="mb-3 w-full rounded-xl bg-input px-3 py-2.5 text-sm text-title outline-none"
            />

            <label className="mb-1.5 block text-xs font-bold text-muted">
              색 순서 <span className="font-normal text-hint">(쉬움 → 어려움, 순서대로 클릭)</span>
            </label>

            {/* 선택된 순서 */}
            <div className="mb-2 flex min-h-8 flex-wrap items-center gap-1 rounded-xl border border-dashed border-primary-light bg-input p-2">
              {order.length === 0 ? (
                <span className="text-[11px] text-muted">
                  아래 팔레트에서 쉬운 색부터 클릭하세요
                </span>
              ) : (
                order.map((c, i) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setOrder((prev) => prev.filter((x) => x !== c))}
                    title="클릭하면 제거"
                    className="flex items-center gap-1"
                  >
                    <span className="text-[10px] text-muted">{i + 1}</span>
                    <ColorChip code={c} />
                  </button>
                ))
              )}
            </div>

            {/* 팔레트 (이미 고른 색은 비활성) */}
            <div className="mb-3 flex flex-wrap gap-1">
              {PALETTE.map((c) => {
                const used = order.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    disabled={used}
                    onClick={() => setOrder((prev) => [...prev, c])}
                    className={used ? "opacity-25" : "transition hover:scale-105"}
                  >
                    <ColorChip code={c} />
                  </button>
                );
              })}
            </div>

            <label className="mb-3 flex items-center gap-2 text-xs text-secondary">
              <input
                type="checkbox"
                checked={isOfficial}
                onChange={(e) => setIsOfficial(e.target.checked)}
                className="accent-primary"
              />
              공식 암장으로 등록
            </label>

            {formError && (
              <p className="mb-2 text-xs text-danger">{formError}</p>
            )}

            <button
              type="button"
              onClick={handleCreate}
              disabled={submitting}
              className="bg-primary-gradient w-full rounded-xl py-2.5 text-sm font-bold text-white transition disabled:opacity-50"
            >
              {submitting ? "등록 중…" : "등록"}
            </button>
          </div>
        )}

        {loading && (
          <p className="py-8 text-center text-sm text-muted">불러오는 중…</p>
        )}
        {error && <p className="py-8 text-center text-sm text-danger">{error}</p>}

        {!loading && !error && filteredGyms.length === 0 && (
          <p className="py-8 text-center text-sm text-muted">
            검색 결과가 없어요
          </p>
        )}

        {filteredGyms.map((g) => (
          <div
            key={g.id}
            className="rounded-[18px] bg-white p-4 shadow-[0_2px_12px_rgba(58,52,80,.07)]"
          >
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[14px] font-extrabold text-title">
                    {g.gym_name}
                  </span>
                  {g.brand_name && (
                    <span className="rounded-full bg-segment px-2 py-0.5 text-[10px] font-bold text-secondary">
                      {g.brand_name}
                    </span>
                  )}
                  {g.is_official ? (
                    <span className="rounded-full bg-primary-tint px-2 py-0.5 text-[10px] font-bold text-primary">
                      공식
                    </span>
                  ) : (
                    <span className="rounded-full bg-segment px-2 py-0.5 text-[10px] font-bold text-secondary">
                      사용자 등록
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] text-muted">
                  컬러 {g.color_order.length}단계
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  editId === g.id ? setEditId(null) : startEdit(g)
                }
                className="shrink-0 rounded-[9px] bg-primary-tint px-3 py-1.5 text-[11.5px] font-bold text-primary"
              >
                {editId === g.id ? "취소" : "수정"}
              </button>
              <button
                type="button"
                onClick={() => handleDelete(g)}
                className="shrink-0 text-[11.5px] font-bold text-muted transition hover:text-danger"
              >
                삭제
              </button>
            </div>

            {editId === g.id ? (
              <div className="mt-3 border-t border-line pt-3">
                <label className="mb-1.5 block text-[11px] font-bold text-muted">
                  브랜드 (선택)
                </label>
                <input
                  value={editBrandName}
                  onChange={(e) => setEditBrandName(e.target.value)}
                  placeholder="예: 더클라임"
                  className="mb-2 w-full rounded-xl bg-input px-3 py-2 text-xs text-title outline-none"
                />
                <p className="mb-1.5 text-[11px] text-muted">
                  쉬움 → 어려움 순. 위쪽 색을 클릭하면 제거, 아래 팔레트에서 추가.
                </p>
                <div className="mb-2 flex min-h-8 flex-wrap items-center gap-1 rounded-xl border border-dashed border-primary-light bg-input p-2">
                  {editOrder.map((c, i) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() =>
                        setEditOrder((prev) => prev.filter((x) => x !== c))
                      }
                      title="클릭하면 제거"
                      className="flex items-center gap-1"
                    >
                      <span className="text-[10px] text-muted">{i + 1}</span>
                      <ColorChip code={c} />
                    </button>
                  ))}
                </div>
                <div className="mb-2 flex flex-wrap gap-1">
                  {PALETTE.map((c) => {
                    const used = editOrder.includes(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        disabled={used}
                        onClick={() => setEditOrder((prev) => [...prev, c])}
                        className={used ? "opacity-25" : "transition hover:scale-105"}
                      >
                        <ColorChip code={c} />
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => handleUpdate(g.id)}
                  disabled={editSaving}
                  className="bg-primary-gradient w-full rounded-xl py-2 text-xs font-bold text-white transition disabled:opacity-50"
                >
                  {editSaving ? "저장 중…" : "저장"}
                </button>
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-line pt-3">
                {g.color_order.map((c, i) => (
                  <ColorChip
                    key={`${g.id}-${c}-${i}`}
                    code={c}
                    title={`${i + 1}번째 (쉬움→어려움)`}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
