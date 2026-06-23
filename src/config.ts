// API 베이스 URL 설정
//
// - 개발(dev 서버): VITE_API_BASE_URL=http://localhost:8080 (로컬 백엔드 직접)
// - 배포(빌드): "/api" → nginx가 /api를 떼고 백엔드로 프록시
//
// .env.development 와 .env.production 으로 분리 관리.

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";
