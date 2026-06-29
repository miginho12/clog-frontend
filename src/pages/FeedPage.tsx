import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  listClimbingLogs,
  deleteClimbingLog,
  getMe,
  ApiError,
  type ClimbingLog,
} from "../api/client";
import ClimbingLogCard from "../components/ClimbingLogCard";
import { isAuthenticated } from "../lib/auth";

const PAGE_SIZE = 20;

export default function FeedPage() {
  const navigate = useNavigate();
  const [myId, setMyId] = useState<string | null>(null);
  const [logs, setLogs] = useState<ClimbingLog[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(
    async (p: number) => {
      setLoading(true);
      setError(null);
      try {
        const res = await listClimbingLogs({ page: p, page_size: PAGE_SIZE });
        setLogs((prev) => (p === 1 ? res.items : [...prev, ...res.items]));
        setHasNext(res.has_next);
        setPage(res.page);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          navigate("/login");
        } else {
          setError("피드를 불러오지 못했습니다");
        }
      } finally {
        setLoading(false);
      }
    },
    [navigate],
  );

  async function handleDelete(id: string) {
    if (!window.confirm("이 기록을 삭제할까요? 되돌릴 수 없어요.")) return;
    try {
      await deleteClimbingLog(id);
      setLogs((prev) => prev.filter((l) => l.id !== id));
    } catch {
      alert("삭제에 실패했습니다");
    }
  }

  useEffect(() => {
    getMe()
      .then((u) => setMyId(u.id))
      .catch(() => {
        // 비로그인/실패 시 mine 판정만 생략 (피드는 공개라 동작)
      });
  }, []);

  useEffect(() => {
    loadPage(1);
  }, [loadPage]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-medium text-gray-900">피드</h1>
        {isAuthenticated() ? (
          <Link
            to="/feed/new"
            className="rounded-lg bg-[#D85A30] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#c14f29]"
          >
            기록하기
          </Link>
        ) : (
          <Link
            to="/login"
            className="rounded-lg bg-[#D85A30] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#c14f29]"
          >
            로그인하고 기록하기
          </Link>
        )}
      </div>

      {error && (
        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {!error && logs.length === 0 && !loading && (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
          <p className="text-sm text-gray-500">아직 공개된 기록이 없어요.</p>
          <Link
            to="/feed/new"
            className="mt-3 inline-block rounded-lg bg-[#D85A30] px-4 py-2 text-sm font-medium text-white"
          >
            첫 기록 남기기
          </Link>
        </div>
      )}

      <div className="space-y-3">
        {logs.map((log) => (
          <ClimbingLogCard
            key={log.id}
            log={log}
            mine={myId === log.user_id}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {loading && (
        <p className="py-4 text-center text-sm text-gray-400">불러오는 중...</p>
      )}

      {hasNext && !loading && (
        <button
          onClick={() => loadPage(page + 1)}
          className="w-full rounded-lg border border-gray-200 bg-white py-3 text-sm text-gray-600 transition hover:bg-gray-50"
        >
          더 보기
        </button>
      )}
    </div>
  );
}
