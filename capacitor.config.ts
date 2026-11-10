import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.climblog.app',
  appName: 'Clog',
  webDir: 'dist',
  // Android 기본 스킴(http)은 CORS 관련 이슈가 알려져 있어 명시적으로 https 지정
  // (iOS는 capacitor://localhost 고정, Android는 https://localhost가 됨)
  server: {
    androidScheme: 'https',
    // allowNavigation 없음 (2026-11-11, 감사 M14): 예전엔 카카오 로그인을 WebView 안에서 하려고
    // kauth/accounts.kakao.com·climb-log.com 을 허용했는데, 콜백 후 WebView 가 원격 사이트
    // (climb-log.com)에 머물러 번들/원격 코드가 섞이고 토큰이 원격 출처에 저장됐다.
    // 이제 로그인은 시스템 브라우저(@capacitor/browser) + 커스텀 스킴 복귀(src/lib/appLogin.ts)라
    // WebView 는 번들 밖으로 나갈 일이 없다.
  },
};

export default config;
