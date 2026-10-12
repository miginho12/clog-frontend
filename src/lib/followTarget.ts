import type { FollowTarget } from "../api/client";

// 영상 엘리먼트 안에서 실제 영상이 그려지는 영역 (object-contain 레터박스 제외).
// videoW/H 는 브라우저가 회전 메타데이터를 적용한 '화면 방향' 크기라 서버
// (OpenCV 자동 회전)와 같은 좌표계가 된다.
export function tapToTarget(
  tapX: number, // 엘리먼트 기준 px
  tapY: number,
  elW: number,
  elH: number,
  videoW: number,
  videoH: number,
  t: number,
): FollowTarget | null {
  if (!videoW || !videoH || !elW || !elH) return null;
  const scale = Math.min(elW / videoW, elH / videoH);
  const dispW = videoW * scale;
  const dispH = videoH * scale;
  const offX = (elW - dispW) / 2;
  const offY = (elH - dispH) / 2;
  const x = (tapX - offX) / dispW;
  const y = (tapY - offY) / dispH;
  // 검은 여백(영상 밖)을 탭하면 무시
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  return { t: Math.max(0, t), x, y };
}

// 정규화 좌표 → 마커를 그릴 엘리먼트 기준 % 위치 (tapToTarget 의 역변환)
export function targetToPercent(
  target: FollowTarget,
  elW: number,
  elH: number,
  videoW: number,
  videoH: number,
): { left: string; top: string } {
  const scale = Math.min(elW / videoW, elH / videoH);
  const dispW = videoW * scale;
  const dispH = videoH * scale;
  const left = (elW - dispW) / 2 + target.x * dispW;
  const top = (elH - dispH) / 2 + target.y * dispH;
  return { left: `${(left / elW) * 100}%`, top: `${(top / elH) * 100}%` };
}
