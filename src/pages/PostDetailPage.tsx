import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getClimbingLog, ApiError, type ClimbingLog } from "../api/client";
import { colorInfo } from "../lib/colorMap";
import AutoPlayVideo from "../components/AutoPlayVideo";
import LikeButton from "../components/LikeButton";

// 게시물 상세 (/feed/:id).
// 큰 미디어(피드와 동일한 자동재생) + 작성자 + 정보 + 좋아요 + (댓글은 Phase 3).
// 공개글은 비로그인도 조회 가능.

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [log, setLog] = useState<ClimbingLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getClimbingLog(id)
      .then((l) => {
        if (!cancelled) setLog(l);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setError("게시물을 찾을 수 없어요. 비공개이거나 삭제되었을 수 있어요.");
        } else {
          setError("게시물을 불러오지 못했습니다.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center">
        <p className="text-sm text-gray-400">불러오는 중...</p>
      </div>
    );
  }

  if (error || !log) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center">
        <p className="text-sm text-gray-600">{error ?? "게시물 없음"}</p>
        <button
          onClick={() => navigate("/feed")}
          className="mt-3 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-50"
        >
          피드로 돌아가기
        </button>
      </div>
    );
  }

  const isVScale = log.grade_system === "v_scale";
  const ci = isVScale ? null : colorInfo(log.grade_raw);
  const gradeBg = ci?.bg ?? "#7C5CD8";
  const gradeFg = ci?.fg ?? "#FFFFFF";

  return (
    <div className="mx-auto max-w-xl">
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        {log.author && (
          <button
            onClick={() => navigate(`/users/${log.author!.id}`)}
            className="mb-3 flex items-center gap-2 transition hover:opacity-70"
          >
            {log.author.profile_image_url ? (
              <img
                src={log.author.profile_image_url}
                alt={log.author.nickname}
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-xs text-gray-500">
                {log.author.nickname.slice(0, 1)}
              </span>
            )}
            <span className="text-sm font-medium text-gray-800">
              {log.author.nickname}
            </span>
          </button>
        )}

        <div className="flex items-center gap-2">
          <span
            className="rounded-md px-2.5 py-1 text-sm font-semibold"
            style={{ backgroundColor: gradeBg, color: gradeFg }}
          >
            {isVScale ? log.grade_raw : ci?.label ?? log.grade_raw}
          </span>
          <span
            className={
              log.is_success
                ? "rounded-md bg-green-50 px-2 py-1 text-xs text-green-700"
                : "rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-500"
            }
          >
            {log.is_success ? "완등" : "시도"}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
          {log.gym_name && <span className="text-gray-700">{log.gym_name}</span>}
          <span>{formatDate(log.climbed_at)}</span>
          <span>시도 {log.attempts}회</span>
        </div>

        {log.media_url && (
          <div className="mt-3">
            {log.media_type === "video" ? (
              <AutoPlayVideo src={log.media_url} />
            ) : (
              <img
                src={log.media_url}
                alt="기록 미디어"
                className="max-h-[70vh] w-full rounded-lg border border-gray-200 object-cover"
              />
            )}
          </div>
        )}

        {log.categories.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {log.categories.map((c) => (
              <span
                key={c}
                className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
              >
                #{c}
              </span>
            ))}
          </div>
        )}

        <div className="mt-3">
          <LikeButton
            logId={log.id}
            initialCount={log.like_count}
            initialLiked={log.liked_by_me}
          />
        </div>

        {log.comment && (
          <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">
            {log.comment}
          </p>
        )}
      </div>

      <div className="mt-4 rounded-2xl border border-dashed border-gray-300 bg-white px-5 py-8 text-center">
        <p className="text-sm text-gray-400">댓글 기능은 준비 중이에요.</p>
      </div>
    </div>
  );
}
