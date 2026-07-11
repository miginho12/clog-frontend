import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getMe,
  updateMe,
  changePassword,
  deleteAccount,
  ApiError,
} from "../api/client";
import { clearTokens } from "../lib/auth";
import type { AuthUser } from "../lib/auth";

// 계정 설정 (/profile/edit) — 본인 전용.
// 3개 카드: 프로필 정보 수정 / 비밀번호 변경(local 계정만) / 회원 탈퇴.

export default function AccountSettingsPage() {
  const navigate = useNavigate();

  const [me, setMe] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ── 프로필 폼 ──
  const [nickname, setNickname] = useState("");
  const [bio, setBio] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileErr, setProfileErr] = useState<string | null>(null);

  // ── 비밀번호 폼 ──
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwErr, setPwErr] = useState<string | null>(null);

  // ── 탈퇴 모달 ──
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getMe()
      .then((u) => {
        if (!alive) return;
        setMe(u);
        setNickname(u.nickname);
        setBio(u.bio ?? "");
        setIsPublic(u.is_public);
        setLoading(false);
      })
      .catch((err) => {
        if (!alive) return;
        if (err instanceof ApiError && err.status === 401) {
          clearTokens();
          navigate("/login", { replace: true });
          return;
        }
        setLoadError("계정 정보를 불러오지 못했습니다.");
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [navigate]);

  const isLocal = me?.auth_provider === "local";

  async function handleSaveProfile() {
    setProfileMsg(null);
    setProfileErr(null);
    if (nickname.trim().length < 2) {
      setProfileErr("닉네임은 2자 이상이어야 합니다.");
      return;
    }
    setSavingProfile(true);
    try {
      const updated = await updateMe({
        nickname: nickname.trim(),
        bio: bio.trim() === "" ? null : bio.trim(),
        is_public: isPublic,
      });
      setMe(updated);
      setProfileMsg("저장되었습니다.");
    } catch (e) {
      setProfileErr(e instanceof ApiError ? e.message : "저장에 실패했습니다.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword() {
    setPwMsg(null);
    setPwErr(null);
    if (newPw !== newPw2) {
      setPwErr("새 비밀번호가 서로 일치하지 않습니다.");
      return;
    }
    setSavingPw(true);
    try {
      await changePassword({ current_password: curPw, new_password: newPw });
      setPwMsg("비밀번호가 변경되었습니다. 다른 기기는 다시 로그인해야 합니다.");
      setCurPw("");
      setNewPw("");
      setNewPw2("");
    } catch (e) {
      setPwErr(e instanceof ApiError ? e.message : "변경에 실패했습니다.");
    } finally {
      setSavingPw(false);
    }
  }

  async function handleDelete() {
    setDeleteErr(null);
    setDeleting(true);
    try {
      await deleteAccount();
      clearTokens();
      navigate("/login", { replace: true });
    } catch (e) {
      setDeleteErr(e instanceof ApiError ? e.message : "탈퇴에 실패했습니다.");
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center">
        <p className="text-sm text-gray-400">불러오는 중...</p>
      </div>
    );
  }

  if (loadError || !me) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center">
        <p className="text-sm text-gray-600">{loadError ?? "계정 없음"}</p>
        <button
          onClick={() => navigate("/feed")}
          className="mt-3 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-50"
        >
          피드로 돌아가기
        </button>
      </div>
    );
  }

  const inputCls =
    "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#D85A30]";
  const labelCls = "mb-1 block text-xs font-medium text-gray-600";

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate(`/users/${me.id}`)}
          className="text-sm text-gray-400 transition hover:text-gray-700"
        >
          ← 프로필
        </button>
        <h1 className="text-lg font-semibold text-gray-900">계정 설정</h1>
      </div>

      {/* ── 프로필 수정 ── */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-medium text-gray-700">프로필 정보</h2>

        <label className={labelCls}>닉네임</label>
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={50}
          className={`mb-3 ${inputCls}`}
        />

        <label className={labelCls}>자기소개</label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="자기소개를 입력하세요"
          className={`mb-3 resize-none ${inputCls}`}
        />

        <label className="mb-3 flex items-center gap-2 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="accent-[#D85A30]"
          />
          프로필 공개 (끄면 다른 사용자에게 프로필이 숨겨집니다)
        </label>

        {profileErr && <p className="mb-2 text-xs text-red-600">{profileErr}</p>}
        {profileMsg && (
          <p className="mb-2 text-xs text-green-600">{profileMsg}</p>
        )}

        <button
          type="button"
          onClick={handleSaveProfile}
          disabled={savingProfile}
          className="w-full rounded-lg bg-[#D85A30] py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {savingProfile ? "저장 중…" : "저장"}
        </button>
      </div>

      {/* ── 비밀번호 변경 (local 계정만) ── */}
      {isLocal && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-medium text-gray-700">
            비밀번호 변경
          </h2>

          <label className={labelCls}>현재 비밀번호</label>
          <input
            type="password"
            value={curPw}
            onChange={(e) => setCurPw(e.target.value)}
            className={`mb-3 ${inputCls}`}
          />

          <label className={labelCls}>새 비밀번호</label>
          <input
            type="password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            placeholder="12자 이상, 영문·숫자·특수문자 포함"
            className={`mb-3 ${inputCls}`}
          />

          <label className={labelCls}>새 비밀번호 확인</label>
          <input
            type="password"
            value={newPw2}
            onChange={(e) => setNewPw2(e.target.value)}
            className={`mb-3 ${inputCls}`}
          />

          {pwErr && <p className="mb-2 text-xs text-red-600">{pwErr}</p>}
          {pwMsg && <p className="mb-2 text-xs text-green-600">{pwMsg}</p>}

          <button
            type="button"
            onClick={handleChangePassword}
            disabled={savingPw || !curPw || !newPw || !newPw2}
            className="w-full rounded-lg bg-gray-800 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {savingPw ? "변경 중…" : "비밀번호 변경"}
          </button>
        </div>
      )}

      {/* ── 회원 탈퇴 ── */}
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
        <h2 className="mb-1 text-sm font-medium text-red-700">회원 탈퇴</h2>
        <p className="mb-3 text-xs text-gray-600">
          탈퇴하면 계정이 비활성화되고 다시 로그인할 수 없습니다.
        </p>
        <button
          type="button"
          onClick={() => setShowDelete(true)}
          className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-100"
        >
          회원 탈퇴
        </button>
      </div>

      {/* ── 탈퇴 확인 모달 ── */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6">
            <h3 className="mb-2 text-base font-semibold text-gray-900">
              정말 탈퇴하시겠어요?
            </h3>
            <p className="mb-4 text-sm text-gray-600">
              이 작업은 되돌릴 수 없습니다. 계정이 즉시 비활성화되고 모든 기기에서
              로그아웃됩니다.
            </p>

            {deleteErr && (
              <p className="mb-3 text-xs text-red-600">{deleteErr}</p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowDelete(false);
                  setDeleteErr(null);
                }}
                disabled={deleting}
                className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {deleting ? "처리 중…" : "탈퇴하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
