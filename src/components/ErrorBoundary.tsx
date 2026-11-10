import { Component, type ErrorInfo, type ReactNode } from "react";
import { isChunkLoadError, reloadOnceForNewVersion } from "../lib/chunkReload";

// 렌더 오류가 앱 전체를 흰 화면으로 만드는 것을 막는다 (2026-11-10, 감사 M6).
// - variant="root" : 앱 최상단. 전체 화면 안내 + 새로고침.
// - variant="page" : AppLayout 본문. 탭바·헤더는 살아 있고, resetKey(경로)가 바뀌면 자동 복구.
// 이벤트 핸들러·비동기 오류는 잡지 않는다(React 규칙) — 그건 각 페이지의 try/catch 가 처리.

type Props = {
  children: ReactNode;
  variant: "root" | "page";
  /** 바뀌면 오류 상태를 초기화 (page: location.pathname) */
  resetKey?: string;
};

type State = { error: Error | null; resetKey?: string };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    // 다른 화면으로 이동하면 오류 화면을 걷어낸다
    if (props.resetKey !== state.resetKey) {
      return { error: null, resetKey: props.resetKey };
    }
    return null;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 배포 직후 옛 청크 404 → 한 번 새로고침하면 해결 (루프 방지 내장)
    if (isChunkLoadError(error) && reloadOnceForNewVersion()) return;
    console.error("render_error", error, info.componentStack);
  }

  private retry = () => {
    if (this.state.error && isChunkLoadError(this.state.error)) {
      window.location.reload();
      return;
    }
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const chunk = isChunkLoadError(error);
    const title = chunk ? "새 버전을 불러오지 못했어요" : "화면을 표시하는 중 문제가 생겼어요";
    const body = chunk
      ? "네트워크 상태를 확인한 뒤 다시 시도해 주세요."
      : "잠시 후 다시 시도해 주세요. 계속되면 앱을 다시 열어 주세요.";

    if (this.props.variant === "page") {
      return (
        <div role="alert" className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-base font-semibold">{title}</p>
          <p className="text-sm text-muted">{body}</p>
          <button
            type="button"
            onClick={this.retry}
            className="mt-2 rounded-full bg-[#D85A30] px-5 py-2 text-sm font-semibold text-white"
          >
            다시 시도
          </button>
        </div>
      );
    }

    return (
      <div role="alert" className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-lg font-semibold">{title}</p>
        <p className="text-sm text-muted">{body}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-2 rounded-full bg-[#D85A30] px-6 py-2.5 text-sm font-semibold text-white"
        >
          새로고침
        </button>
      </div>
    );
  }
}
