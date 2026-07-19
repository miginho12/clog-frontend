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
import { avatarGradient } from "../lib/avatarGradient";

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
      <div className="rounded-card-lg bg-white px-6 py-16 text-center shadow-[0_2px_10px_rgba(90,70,140,.07)]">
        <p className="text-sm text-muted">불러오는 중...</p>
      </div>
    );
  }

  if (loadError || !me) {
    return (
      <div className="rounded-card-lg bg-white px-6 py-16 text-center shadow-[0_2px_10px_rgba(90,70,140,.07)]">
        <p className="text-sm text-secondary">{loadError ?? "계정 없음"}</p>
        <button
          onClick={() => navigate("/feed")}
          className="mt-3 rounded-pill bg-segment px-4 py-2 text-sm font-bold text-secondary transition"
        >
          피드로 돌아가기
        </button>
      </div>
    );
  }

  const inputCls =
    "w-full rounded-[14px] bg-white px-4 py-3.5 text-[13.5px] font-semibold text-title shadow-[0_2px_10px_rgba(90,70,140,.07)] outline-none placeholder:font-normal placeholder:text-hint";
  const labelCls = "mb-1.5 block text-xs font-bold text-muted";
  const initial = me.nickname.charAt(0).toUpperCase();

  return (
    <div className="mx-auto max-w-xl">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(`/users/${me.id}`)}
          className="text-title"
          aria-label="뒤로"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <span className="text-[16px] font-extrabold text-title">회원정보 수정</span>
      </div>

      <div className="mt-4 space-y-3.5">
        {/* ── 프로필 수정 ── */}
        <div className="text-center">
          {me.profile_image_url ? (
            <img
              src={me.profile_image_url}
              alt={me.nickname}
              className="mx-auto h-[84px] w-[84px] rounded-full object-cover"
            />
          ) : (
            <div
              className="mx-auto flex h-[84px] w-[84px] items-center justify-center rounded-full text-[30px] font-extrabold text-white"
              style={{ background: avatarGradient(me.id) }}
            >
              {initial}
            </div>
          )}
        </div>

        <div>
          <label className={labelCls}>닉네임</label>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={50}
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>소개</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="자기소개를 입력하세요"
            className={`resize-none ${inputCls}`}
          />
        </div>

        <button
          type="button"
          onClick={() => setIsPublic((v) => !v)}
          className="flex w-full items-center gap-3 rounded-[14px] bg-white px-4 py-3.5 text-left shadow-[0_2px_10px_rgba(90,70,140,.07)]"
        >
          <span className="flex-1 text-[13.5px] font-semibold text-title">
            프로필 공개
          </span>
          <span className="text-[11px] text-muted">
            {isPublic ? "전체 공개" : "비공개"}
          </span>
          <span
            className={
              "relative h-[22px] w-[38px] shrink-0 rounded-pill transition " +
              (isPublic ? "bg-primary" : "bg-line")
            }
          >
            <span
              className={
                "absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white transition-all " +
                (isPublic ? "right-0.5" : "left-0.5")
              }
            />
          </span>
        </button>

        {profileErr && (
          <p className="rounded-2xl bg-danger-tint px-4 py-3 text-sm text-danger">
            {profileErr}
          </p>
        )}
        {profileMsg && (
          <p className="rounded-2xl bg-success-tint px-4 py-3 text-sm text-success">
            {profileMsg}
          </p>
        )}

        <button
          type="button"
          onClick={handleSaveProfile}
          disabled={savingProfile}
          className="bg-primary-gradient w-full rounded-2xl py-[15px] text-[14.5px] font-extrabold text-white shadow-[0_8px_20px_rgba(124,92,216,.3)] transition disabled:opacity-60"
        >
          {savingProfile ? "저장 중…" : "저장"}
        </button>

        {/* ── 비밀번호 변경 (local 계정만) ── */}
        {isLocal && (
          <div className="space-y-3.5 border-t border-line pt-4">
            <span className="block text-[13px] font-extrabold text-title">
              비밀번호 변경
            </span>

            <div>
              <label className={labelCls}>현재 비밀번호</label>
              <input
                type="password"
                value={curPw}
                onChange={(e) => setCurPw(e.target.value)}
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>새 비밀번호</label>
              <input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="12자 이상, 영문·숫자·특수문자 포함"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>새 비밀번호 확인</label>
              <input
                type="password"
                value={newPw2}
                onChange={(e) => setNewPw2(e.target.value)}
                className={inputCls}
              />
            </div>

            {pwErr && (
              <p className="rounded-2xl bg-danger-tint px-4 py-3 text-sm text-danger">
                {pwErr}
              </p>
            )}
            {pwMsg && (
              <p className="rounded-2xl bg-success-tint px-4 py-3 text-sm text-success">
                {pwMsg}
              </p>
            )}

            <button
              type="button"
              onClick={handleChangePassword}
              disabled={savingPw || !curPw || !newPw || !newPw2}
              className="w-full rounded-2xl bg-title py-[15px] text-[14.5px] font-extrabold text-white transition disabled:opacity-50"
            >
              {savingPw ? "변경 중…" : "비밀번호 변경"}
            </button>
          </div>
        )}

        {/* ── 회원 탈퇴 ── */}
        <div className="rounded-[18px] border border-danger-line bg-danger-tint p-4">
          <p className="text-[13px] font-extrabold text-danger">회원 탈퇴</p>
          <p className="mt-1 text-[11.5px] leading-[1.55] text-danger/70">
            탈퇴하면 계정이 비활성화되고 다시 로그인할 수 없습니다. 모든 클라이밍
            기록·점수·팔로우 관계는 복구할 수 없어요.
          </p>
          <button
            type="button"
            onClick={() => setShowDelete(true)}
            className="mt-3 w-full rounded-xl border-[1.5px] border-danger/20 bg-white py-[11px] text-[13px] font-extrabold text-danger"
          >
            탈퇴하기
          </button>
        </div>
      </div>

      {/* ── 탈퇴 확인 모달 ── */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-card-lg bg-white p-6">
            <h3 className="mb-2 text-base font-extrabold text-title">
              정말 탈퇴하시겠어요?
            </h3>
            <p className="mb-4 text-sm text-secondary">
              이 작업은 되돌릴 수 없습니다. 계정이 즉시 비활성화되고 모든 기기에서
              로그아웃됩니다.
            </p>

            {deleteErr && (
              <p className="mb-3 text-xs text-danger">{deleteErr}</p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowDelete(false);
                  setDeleteErr(null);
                }}
                disabled={deleting}
                className="flex-1 rounded-2xl bg-segment py-2.5 text-sm font-bold text-secondary transition disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 rounded-2xl bg-danger py-2.5 text-sm font-bold text-white transition disabled:opacity-50"
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
