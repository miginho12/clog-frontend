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
      className="flex h-6 min-w-6 items-center justify-center rounded px-1.5 text-[10px] font-medium"
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
      <h1 className="mb-1 text-lg font-semibold text-gray-900">관리자</h1>
      <p className="mb-5 text-xs text-gray-400">
        암장 색체계를 등록하고 난이도 순서를 관리합니다.
      </p>

      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-700">
          암장 관리 {!loading && `(${gyms.length})`}
        </h2>
        <button
          type="button"
          onClick={() => {
            setShowForm((v) => !v);
            if (showForm) resetForm();
          }}
          className="rounded-lg bg-[#D85A30] px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90"
        >
          {showForm ? "취소" : "+ 암장 추가"}
        </button>
      </div>

      {/* 등록 폼 */}
      {showForm && (
        <div className="mb-4 rounded-xl border border-[#D85A30]/30 bg-[#FFF9F6] p-4">
          <label className="mb-1 block text-xs font-medium text-gray-600">
            암장 이름
          </label>
          <input
            value={gymName}
            onChange={(e) => setGymName(e.target.value)}
            placeholder="예: 더클라임 강남"
            className="mb-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#D85A30]"
          />

          <label className="mb-1 block text-xs font-medium text-gray-600">
            브랜드 <span className="text-gray-400">(선택 — 같은 브랜드 지점끼리 묶어보기)</span>
          </label>
          <input
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            placeholder="예: 더클라임"
            className="mb-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#D85A30]"
          />

          <label className="mb-1 block text-xs font-medium text-gray-600">
            색 순서 <span className="text-gray-400">(쉬움 → 어려움, 순서대로 클릭)</span>
          </label>

          {/* 선택된 순서 */}
          <div className="mb-2 flex min-h-8 flex-wrap items-center gap-1 rounded-lg border border-dashed border-gray-300 bg-white p-2">
            {order.length === 0 ? (
              <span className="text-[11px] text-gray-400">
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
                  <span className="text-[10px] text-gray-400">{i + 1}</span>
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

          <label className="mb-3 flex items-center gap-2 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={isOfficial}
              onChange={(e) => setIsOfficial(e.target.checked)}
              className="accent-[#D85A30]"
            />
            공식 암장으로 등록
          </label>

          {formError && (
            <p className="mb-2 text-xs text-red-600">{formError}</p>
          )}

          <button
            type="button"
            onClick={handleCreate}
            disabled={submitting}
            className="w-full rounded-lg bg-[#D85A30] py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "등록 중…" : "등록"}
          </button>
        </div>
      )}

      {loading && (
        <p className="py-8 text-center text-sm text-gray-400">불러오는 중…</p>
      )}
      {error && <p className="py-8 text-center text-sm text-red-500">{error}</p>}

      <div className="space-y-2">
        {gyms.map((g) => (
          <div
            key={g.id}
            className="rounded-xl border border-gray-200 bg-white p-4"
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900">
                {g.gym_name}
              </span>
              {g.brand_name && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500">
                  {g.brand_name}
                </span>
              )}
              {g.is_official ? (
                <span className="rounded-full bg-[#FAECE7] px-2 py-0.5 text-[10px] text-[#D85A30]">
                  공식
                </span>
              ) : (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500">
                  사용자 등록
                </span>
              )}
              <button
                type="button"
                onClick={() =>
                  editId === g.id ? setEditId(null) : startEdit(g)
                }
                className="ml-auto text-xs text-gray-400 transition hover:text-gray-700"
              >
                {editId === g.id ? "취소" : "수정"}
              </button>
              <button
                type="button"
                onClick={() => handleDelete(g)}
                className="text-xs text-gray-400 transition hover:text-red-600"
              >
                삭제
              </button>
            </div>

            {editId === g.id ? (
              <div>
                <label className="mb-1 block text-[11px] font-medium text-gray-500">
                  브랜드 (선택)
                </label>
                <input
                  value={editBrandName}
                  onChange={(e) => setEditBrandName(e.target.value)}
                  placeholder="예: 더클라임"
                  className="mb-2 w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs outline-none focus:border-[#D85A30]"
                />
                <p className="mb-1 text-[11px] text-gray-500">
                  쉬움 → 어려움 순. 위쪽 색을 클릭하면 제거, 아래 팔레트에서 추가.
                </p>
                <div className="mb-2 flex min-h-8 flex-wrap items-center gap-1 rounded-lg border border-dashed border-gray-300 p-2">
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
                      <span className="text-[10px] text-gray-400">{i + 1}</span>
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
                  className="w-full rounded-lg bg-[#D85A30] py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  {editSaving ? "저장 중…" : "저장"}
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-1">
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
