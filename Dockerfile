# Clog 프론트엔드 멀티스테이지 Dockerfile
#
# Stage 1 (builder): Node 로 Vite 정적 빌드 → dist/ 생성
# Stage 2 (runtime): nginx 로 dist/ 서빙 + /api 프록시
#
# 멀티플랫폼 빌드 (amd64 + arm64) 는 GitHub Actions 의 buildx 가 처리.
# 최종 이미지는 nginx + 정적 파일만 포함 → 작고 안전.

# ─────────────────────────────────────────
# Stage 1: 빌드
# ─────────────────────────────────────────
FROM node:24-alpine AS builder

WORKDIR /app

# 의존성 먼저 복사 → 레이어 캐시 활용
# (package.json 안 바뀌면 npm ci 재실행 안 함)
COPY package.json package-lock.json ./
RUN npm ci

# 소스 복사 후 빌드
COPY . .
# .env.production 이 자동 적용됨 (VITE_API_BASE_URL=/api)
RUN npm run build

# ─────────────────────────────────────────
# Stage 2: 런타임 (nginx)
# ─────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# 기본 nginx 설정 제거 후 커스텀 설정을 envsubst 템플릿으로 복사
# nginx 공식 이미지가 시작 시 /etc/nginx/templates/*.template 을 envsubst 처리해
# 같은 이름으로 /etc/nginx/conf.d/ 에 생성한다 (재빌드 없이 dev/prod 백엔드 주소만 전환).
# NGINX_ENVSUBST_FILTER 로 치환 대상을 CLOG_ 접두 변수로 한정 —
# 안 하면 nginx 자체 변수($host, $request_uri 등)까지 envsubst가 지워버린다.
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf.template /etc/nginx/templates/clog.conf.template
ENV NGINX_ENVSUBST_FILTER=^CLOG_
ENV CLOG_BACKEND_HOST=clog-dev

# 빌드 결과물(dist) 복사
COPY --from=builder /app/dist /usr/share/nginx/html

# 비루트 실행을 위한 권한 (nginx-alpine 은 기본 nginx 유저 존재)
# 80 포트로 서빙
EXPOSE 80

# nginx 포그라운드 실행
CMD ["nginx", "-g", "daemon off;"]
