// 프로필 이미지가 없을 때 이니셜 아바타에 쓰는 그라디언트.
// 디자인 시안(design_handoff_clog_redesign)에 등장하는 두 팔레트를 그대로 사용,
// 사용자 id 기준 해시로 결정론적으로 배정 (같은 유저는 항상 같은 그라디언트).
const AVATAR_GRADIENTS = [
  "linear-gradient(135deg,#B49CF0,#7C5CD8)",
  "linear-gradient(135deg,#F5A88F,#E86A5C)",
];

export function avatarGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}
