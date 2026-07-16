FROM node:22-slim AS builder
WORKDIR /app
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/db-server/package.json apps/db-server/package.json
COPY apps/admin-web/package.json apps/admin-web/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN corepack enable \
  && corepack prepare pnpm@11.7.0 --activate \
  && pnpm install --frozen-lockfile
COPY . .
ARG VITE_APP_VERSION=
ENV VITE_BASE_PATH=/admin/
ENV VITE_PROTECTED_ADMIN_USERNAME=admin
ENV VITE_APP_VERSION=${VITE_APP_VERSION}
RUN pnpm --filter @pkpkdupr/admin-web build

FROM nginx:1.27-alpine

COPY apps/admin-web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/admin-web/dist /usr/share/nginx/html/admin

EXPOSE 80
