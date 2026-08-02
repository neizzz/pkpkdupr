#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${PKELO_DEV_ENV_FILE:-${ROOT_DIR}/env/pkelo.dev.env}"

cd "${ROOT_DIR}"

if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi

export NODE_ENV=development
export ENABLE_DEV_MOCK_DATA=true
export DOMAIN="${DOMAIN:-pkelo.localhost}"
export JWT_SECRET="${JWT_SECRET:-pkelo-local-dev-jwt-secret}"
export USER_AUTH_PROVIDER="${USER_AUTH_PROVIDER:-kakao-mock}"
export KAKAO_REDIRECT_URI="${KAKAO_REDIRECT_URI:-http://pkelo.localhost:8081/auth/kakao/callback}"
export KAKAO_WEB_ORIGIN="${KAKAO_WEB_ORIGIN:-http://pkelo.localhost:8081}"
export KAKAO_MOCK_SUBJECT="${KAKAO_MOCK_SUBJECT:-pkelo-local-mock-user}"
export API_ADMIN_USERNAME="${API_ADMIN_USERNAME:-admin}"
export API_ADMIN_PASSWORD="${API_ADMIN_PASSWORD:-admin123qwe}"
export MYSQL_DATABASE="${MYSQL_DATABASE:-pkelo_dev}"
export MYSQL_USER="${MYSQL_USER:-pkelo_dev}"
export MYSQL_PASSWORD="${MYSQL_PASSWORD:-pkelo-dev-password}"
export MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-pkelo-dev-root-password}"
export MYSQL_VIEWER_USER="${MYSQL_VIEWER_USER:-pkelo_dev_viewer}"
export MYSQL_VIEWER_PASSWORD="${MYSQL_VIEWER_PASSWORD:-pkelo-dev-viewer-password}"
export DB_HOST=127.0.0.1
export DB_PORT="${PKELO_DEV_MYSQL_PORT:-3307}"
export DB_NAME="${MYSQL_DATABASE}"
export DB_USER="${MYSQL_USER}"
export DB_PASSWORD="${MYSQL_PASSWORD}"
export AVATAR_UPLOAD_DIR="${ROOT_DIR}/data/pkelo-dev/uploads/avatars"
export DEV_CORS_ORIGINS="http://pkelo.localhost:8081,http://pkelo.localhost:3101"

mkdir -p "${AVATAR_UPLOAD_DIR}"
bash scripts/dev-pkelo-db.sh browser

PIDS=()

start_process() {
  "$@" &
  PIDS+=("$!")
}

cleanup() {
  local exit_code=$?
  trap - EXIT INT TERM

  for pid in "${PIDS[@]}"; do
    kill "${pid}" >/dev/null 2>&1 || true
  done
  for pid in "${PIDS[@]}"; do
    wait "${pid}" >/dev/null 2>&1 || true
  done

  exit "${exit_code}"
}

wait_for_db_server() {
  local db_server_pid="$1"

  for _ in $(seq 1 60); do
    if node -e "fetch('http://127.0.0.1:5002/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"; then
      return 0
    fi
    if ! kill -0 "${db_server_pid}" >/dev/null 2>&1; then
      wait "${db_server_pid}"
      return $?
    fi
    sleep 1
  done

  echo "❌ PKELO 개발 DB 서버 준비 시간이 초과되었습니다." >&2
  return 1
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

start_process env PORT=5002 pnpm --filter @pkpkdupr/db-server dev
wait_for_db_server "${PIDS[0]}"

start_process env PORT=4001 DB_SERVER_URL=http://127.0.0.1:5002 \
  pnpm --filter @pkpkdupr/api dev
start_process env VITE_DEV_PORT=8081 VITE_DEV_API_TARGET=http://127.0.0.1:4001 \
  VITE_DEV_ADMINER_TARGET=http://127.0.0.1:${PKELO_DEV_ADMINER_PORT:-3302} \
  VITE_DEV_ALLOWED_HOSTS=pkelo.localhost VITE_DEV_HMR_HOST=pkelo.localhost \
  pnpm --filter @pkpkdupr/web dev
start_process env VITE_DEV_PORT=3101 VITE_DEV_API_TARGET=http://127.0.0.1:4001 \
  VITE_DEV_ALLOWED_HOSTS=pkelo.localhost \
  pnpm --filter @pkpkdupr/admin-web dev

echo "🚀 PKELO 개발 환경이 실행되었습니다."
echo "   사용자 앱: http://pkelo.localhost:8081/login"
echo "   관리자:   http://pkelo.localhost:3101"
echo "   Adminer:  http://localhost:${PKELO_DEV_ADMINER_PORT:-3302}"

while true; do
  for pid in "${PIDS[@]}"; do
    if ! kill -0 "${pid}" >/dev/null 2>&1; then
      if wait "${pid}"; then
        exit 0
      else
        exit $?
      fi
    fi
  done
  sleep 1
done
