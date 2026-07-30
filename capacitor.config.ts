import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.climblog.app',
  appName: 'Clog',
  webDir: 'dist',
  // Android 기본 스킴(http)은 CORS 관련 이슈가 알려져 있어 명시적으로 https 지정
  // (iOS는 capacitor://localhost 고정, Android는 https://localhost가 됨)
  server: {
    androidScheme: 'https',
    // 카카오 로그인은 WebView가 앱 자체 origin(https://localhost) 밖의
    // kauth.kakao.com 으로 이동해야 하는데, allowNavigation에 없는 도메인으로
    // 나가면 Capacitor가 기본적으로 시스템 브라우저로 튕겨버린다(2026-07-30
    // 실기기 테스트에서 발견). 카카오 인증 + 콜백이 돌아오는 climb-log.com
    // 둘 다 허용해서 전체 로그인 플로우가 앱 안에서 끝나도록 함.
    allowNavigation: [
      'kauth.kakao.com',
      'accounts.kakao.com',
      'climb-log.com',
    ],
  },
};

export default config;
