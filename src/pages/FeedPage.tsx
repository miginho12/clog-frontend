import { useCallback, useEffect, useRef, useState } from "react";
import {
  Link,
  useLocation,
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
// ?start= 게시물이 아직 안 불러온 페이지에 있으면 찾을 때까지 다음 페이지를 이어서 불러온다.
// 프로필 그리드는 내 게시물 전체를 보여주므로 21번째 이후를 누르면 첫 페이지에 없다.
// 상한 = 25페이지(500개) — 그래도 없으면(삭제·비공개 전환 등) 안내 후 맨 위에 둔다.
const MAX_SEEK_PAGES = 25;

export default function FeedPage() {
  const navigate = useNavigate();
  const location = useLocation();
  // 알림에서 삭제된 게시물/댓글로 진입한 경우 안내 토스트 (state로 전달됨)
  const [toast, setToast] = useState<string | null>(
    (location.state as { toast?: string } | null)?.toast ?? null,
  );
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(t);
  }, [toast]);
  // /users/:userId/posts 로 진입하면 그 사용자 게시물만 필터.
  // /gyms/:gymName 로 진입하면 그 암장(자연암 포함) 게시물만 필터.
  // /tags/:tag 로 진입하면 그 해시태그 게시물만 필터.
  // ?start=:postId 있으면 로드 후 그 카드로 스크롤.
  // react-router 가 파라미터를 이미 디코딩해서 넘겨줌 (재디코딩 금지 — 이중 디코딩 시
  // "%" 가 포함된 암장 이름에서 URIError 발생)
  const { userId, gymName, tag } = useParams<{
    userId?: string;
    gymName?: string;
    tag?: string;
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
  const [loaded, setLoaded] = useState(false); // 첫 페이지 응답을 받았는지 (찾기 판단 기준)
  const [sheetLogId, setSheetLogId] = useState<string | null>(null);
  const [siblingBranches, setSiblingBranches] = useState<GymGradeSystem[]>([]);
  const [myGymSystem, setMyGymSystem] = useState<GymGradeSystem | null>(null);
  const [showRanking, setShowRanking] = useState(false);

  // 가장 최근 요청의 응답만 반영 — 늦게 온 이전 응답(예: 1페이지)이 이어 불러온 목록을 덮어쓰면
  // ?start= 찾기가 처음부터 다시 돈다
  const reqSeq = useRef(0);
  const loadPage = useCallback(
    async (p: number) => {
      const seq = ++reqSeq.current;
      setLoading(true);
      setError(null);
      try {
        const res = await listClimbingLogs({
          page: p,
          page_size: PAGE_SIZE,
          author_id: userId,
          gym_name: gymName,
          category: tag,
        });
        if (seq !== reqSeq.current) return;
        setLogs((prev) => (p === 1 ? res.items : [...prev, ...res.items]));
        setHasNext(res.has_next);
        setPage(res.page);
        setLoaded(true);
      } catch (err) {
        if (seq !== reqSeq.current) return;
        if (err instanceof ApiError && err.status === 401) {
          navigate("/login");
        } else {
          setError("피드를 불러오지 못했습니다");
        }
      } finally {
        if (seq === reqSeq.current) setLoading(false);
      }
    },
    [navigate, userId, gymName, tag],
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
    void (async () => {
      await loadPage(1);
    })();
  }, [loadPage]);

  // 암장 피드일 때, 같은 브랜드(체인)의 다른 지점을 찾아 보여준다.
  // gym_grade_systems 는 자연암(V스케일 자유 입력)엔 없으므로 실내 암장일 때만 뜬다.
  useEffect(() => {
    if (!gymName) {
      queueMicrotask(() => {
        setSiblingBranches([]);
        setMyGymSystem(null);
        setShowRanking(false);
      });
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

  // ?start= 게시물이 불러온 목록에 없으면 다음 페이지를 이어서 불러온다 (찾으면 아래 효과가 이동).
  const startLoaded = !!startId && logs.some((l) => l.id === startId);
  useEffect(() => {
    if (!startId || scrolledTo === startId || startLoaded || !loaded || loading || error) return;
    if (hasNext && page < MAX_SEEK_PAGES) {
      void loadPage(page + 1);
      return;
    }
    // 끝까지 찾았는데 없음 — 삭제됐거나 볼 수 없는 게시물
    setScrolledTo(startId);
    setToast("게시물을 찾지 못했어요");
  }, [startId, scrolledTo, startLoaded, loaded, loading, error, hasNext, page, loadPage]);
  // 찾는 동안엔 목록 맨 위가 잠깐 보였다가 튀지 않게 가린다
  const seeking = !!startId && scrolledTo !== startId && !error;

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
      {toast && (
        <div className="fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-full bg-title/90 px-4 py-2 text-sm font-medium text-white shadow-float">
          {toast}
        </div>
      )}
      {/* 필터 피드(사용자 게시물/암장별/태그별)일 때만 뒤로가기 헤더. 전체 피드는 상단 헤더의 + 버튼 사용 */}
      {(userId || gymName || tag) && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-secondary transition hover:bg-segment"
            aria-label="뒤로"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 className="truncate text-lg font-bold text-title">
            {tag ? `#${tag}` : (gymName ?? "게시물")}
          </h1>
          {myGymSystem && (
            <button
              onClick={() => setShowRanking((v) => !v)}
              className="ml-auto shrink-0 rounded-full bg-primary-tint px-3 py-1 text-xs font-medium text-primary transition hover:opacity-80"
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
        <div className="-mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted">
          <span>같은 브랜드 다른 지점:</span>
          {siblingBranches.map((g) => (
            <button
              key={g.id}
              onClick={() => navigate(`/gyms/${encodeURIComponent(g.gym_name)}`)}
              className="rounded-full bg-primary-tint px-2.5 py-1 font-medium text-primary transition hover:opacity-80"
            >
              {g.gym_name}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-card border border-line bg-white px-6 py-16 text-center">
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      {!error && logs.length === 0 && !loading && (
        <div className="flex flex-col items-center px-10 py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-primary-tint">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#B49CF0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
            </svg>
          </div>
          <p className="mt-4 text-[16px] font-extrabold text-title">
            아직 기록이 없어요
          </p>
          <p className="mt-1.5 text-xs leading-[1.6] text-muted">
            오늘 오른 문제를 기록하면
            <br />
            점수와 레벨이 쌓이기 시작해요
          </p>
          <Link
            to="/feed/new"
            state={gymName ? { gymName } : undefined}
            className="bg-primary-gradient mt-[18px] inline-block rounded-pill px-6 py-3 text-[13.5px] font-extrabold text-white shadow-[0_8px_20px_rgba(124,92,216,.3)]"
          >
            + 첫 기록 남기기
          </Link>
        </div>
      )}

      {seeking && logs.length > 0 && (
        <div className="bg-page-gradient fixed inset-0 z-40 flex items-center justify-center">
          <p className="text-sm text-muted">게시물로 이동 중…</p>
        </div>
      )}

      <div className="space-y-3.5">
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

      {loading && logs.length === 0 && (
        <div className="space-y-3.5">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="rounded-card-lg bg-white p-[18px] shadow-[0_4px_20px_rgba(90,70,140,.05)]"
            >
              <div className="mb-3.5 flex items-center gap-2.5">
                <span className="h-[34px] w-[34px] shrink-0 animate-shimmer rounded-full bg-[linear-gradient(90deg,#F0EDF6_25%,#F7F4FB_50%,#F0EDF6_75%)]" />
                <span className="flex flex-col gap-1.5">
                  <span className="h-2.5 w-24 rounded-[6px] bg-[#F0EDF6]" />
                  <span className="h-2 w-[150px] rounded-[6px] bg-[#F5F3FA]" />
                </span>
              </div>
              <div className="mb-3.5 flex gap-1.5">
                <span className="h-6 w-[52px] rounded-pill bg-[#F0EDF6]" />
                <span className="h-6 w-[52px] rounded-pill bg-[#F5F3FA]" />
              </div>
              <div className="aspect-[4/5] animate-shimmer rounded-2xl bg-[linear-gradient(90deg,#F5F3FA_25%,#FAF8FD_50%,#F5F3FA_75%)]" />
            </div>
          ))}
        </div>
      )}

      {loading && logs.length > 0 && (
        <p className="py-4 text-center text-sm text-muted">불러오는 중...</p>
      )}

      {hasNext && !loading && (
        <button
          onClick={() => loadPage(page + 1)}
          className="w-full rounded-input border border-line bg-white py-3 text-sm text-secondary transition hover:bg-segment"
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
