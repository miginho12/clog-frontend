import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.climblog.app',
  appName: 'Clog',
  webDir: 'dist',
  // Android 기본 스킴(http)은 CORS 관련 이슈가 알려져 있어 명시적으로 https 지정
  // (iOS는 capacitor://localhost 고정, Android는 https://localhost가 됨)
  server: {
    androidScheme: 'https',
  },
};

export default config;
