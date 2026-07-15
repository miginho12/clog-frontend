import { useCallback, useEffect, useRef, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  listClimbingLogs,
  deleteClimbingLog,
  getClimbingLog,
  getMe,
  listGymGradeSystems,
  ApiError,
  type ClimbingLog,
  type GymGradeSystem,
} from "../api/client";
import ClimbingLogCard from "../components/ClimbingLogCard";
import CommentBottomSheet from "../components/CommentBottomSheet";
import GymRankingPanel from "../components/GymRankingPanel";

const PAGE_SIZE = 20;

export default function FeedPage() {
  const navigate = useNavigate();
  // /users/:userId/posts 로 진입하면 그 사용자 게시물만 필터.
  // /gyms/:gymName 로 진입하면 그 암장(자연암 포함) 게시물만 필터.
  // ?start=:postId 있으면 로드 후 그 카드로 스크롤.
  // react-router 가 파라미터를 이미 디코딩해서 넘겨줌 (재디코딩 금지 — 이중 디코딩 시
  // "%" 가 포함된 암장 이름에서 URIError 발생)
  const { userId, gymName } = useParams<{
    userId?: string;
    gymName?: string;
  }>();
  const [searchParams] = useSearchParams();
  const startId = searchParams.get("start");
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [scrolledTo, setScrolledTo] = useState<string | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [logs, setLogs] = useState<ClimbingLog[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheetLogId, setSheetLogId] = useState<string | null>(null);
  const [siblingBranches, setSiblingBranches] = useState<GymGradeSystem[]>([]);
  const [myGymSystem, setMyGymSystem] = useState<GymGradeSystem | null>(null);
  const [showRanking, setShowRanking] = useState(false);

  const loadPage = useCallback(
    async (p: number) => {
      setLoading(true);
      setError(null);
      try {
        const res = await listClimbingLogs({
          page: p,
          page_size: PAGE_SIZE,
          author_id: userId,
          gym_name: gymName,
        });
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
    [navigate, userId, gymName],
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

  // 암장 피드일 때, 같은 브랜드(체인)의 다른 지점을 찾아 보여준다.
  // gym_grade_systems 는 자연암(V스케일 자유 입력)엔 없으므로 실내 암장일 때만 뜬다.
  useEffect(() => {
    if (!gymName) {
      setSiblingBranches([]);
      setMyGymSystem(null);
      setShowRanking(false);
      return;
    }
    let cancelled = false;
    listGymGradeSystems()
      .then((all) => {
        if (cancelled) return;
        const mine = all.find((g) => g.gym_name === gymName);
        setMyGymSystem(mine ?? null);
        setSiblingBranches(
          mine?.brand_name
            ? all.filter(
                (g) => g.brand_name === mine.brand_name && g.gym_name !== gymName,
              )
            : [],
        );
      })
      .catch(() => {
        // 형제 지점/랭킹 가능 여부 조회 실패는 치명적이지 않음 (섹션만 안 보임)
      });
    return () => {
      cancelled = true;
    };
  }, [gymName]);

  // ?start=:postId 로 진입 시, 해당 카드로 즉시 이동 (움직임 안 보이게).
  // 이미지/영상 로드로 레이아웃이 밀리므로, 로드 후 재보정을 여러 번 시도.
  useEffect(() => {
    if (!startId || scrolledTo === startId) return;
    const el = cardRefs.current[startId];
    if (!el) return;

    // 즉시 1차 이동
    el.scrollIntoView({ behavior: "auto", block: "start" });

    // 이미지 로드로 밀리는 것 보정: 짧은 간격으로 여러 번 재이동
    const timers = [50, 150, 350, 700].map((delay) =>
      window.setTimeout(() => {
        const target = cardRefs.current[startId];
        if (target) {
          target.scrollIntoView({ behavior: "auto", block: "start" });
        }
      }, delay),
    );
    setScrolledTo(startId);
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [startId, scrolledTo, logs]);

  return (
    <div className="space-y-4">
      {/* 필터 피드(사용자 게시물/암장별)일 때만 뒤로가기 헤더. 전체 피드는 상단 헤더의 + 버튼 사용 */}
      {(userId || gymName) && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 transition hover:bg-gray-100"
            aria-label="뒤로"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 className="truncate text-lg font-medium text-gray-900">
            {gymName ?? "게시물"}
          </h1>
          {myGymSystem && (
            <button
              onClick={() => setShowRanking((v) => !v)}
              className="ml-auto shrink-0 rounded-full bg-[#FAECE7] px-3 py-1 text-xs font-medium text-[#D85A30] transition hover:opacity-80"
            >
              {showRanking ? "랭킹 닫기" : "🏆 랭킹"}
            </button>
          )}
        </div>
      )}

      {showRanking && myGymSystem && gymName && (
        <GymRankingPanel gymName={gymName} />
      )}

      {siblingBranches.length > 0 && (
        <div className="-mt-2 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
          <span>같은 브랜드 다른 지점:</span>
          {siblingBranches.map((g) => (
            <button
              key={g.id}
              onClick={() => navigate(`/gyms/${encodeURIComponent(g.gym_name)}`)}
              className="rounded-full bg-[#FAECE7] px-2.5 py-1 font-medium text-[#D85A30] transition hover:opacity-80"
            >
              {g.gym_name}
            </button>
          ))}
        </div>
      )}

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
          <div
            key={log.id}
            ref={(el) => {
              cardRefs.current[log.id] = el;
            }}
          >
            <ClimbingLogCard
              log={log}
              mine={myId === log.user_id}
              onDelete={handleDelete}
              onOpenComments={setSheetLogId}
            />
          </div>
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

      <CommentBottomSheet
        logId={sheetLogId}
        onClose={async (closedLogId) => {
          setSheetLogId(null);
          if (!closedLogId) return;
          // 시트에서 댓글이 바뀌었을 수 있으니 해당 카드만 갱신
          try {
            const fresh = await getClimbingLog(closedLogId);
            setLogs((prev) =>
              prev.map((l) => (l.id === closedLogId ? fresh : l)),
            );
          } catch {
            // 갱신 실패는 조용히 (기존 카드 유지)
          }
        }}
      />
    </div>
  );
}
