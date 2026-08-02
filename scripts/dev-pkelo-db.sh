#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${PKELO_DEV_ENV_FILE:-${ROOT_DIR}/env/pkelo.dev.env}"
MODE="${1:-up}"

cd "${ROOT_DIR}"

if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi

export DOMAIN="${DOMAIN:-pkelo.localhost}"
export JWT_SECRET="${JWT_SECRET:-pkelo-local-dev-jwt-secret}"
export API_ADMIN_USERNAME="${API_ADMIN_USERNAME:-admin}"
export API_ADMIN_PASSWORD="${API_ADMIN_PASSWORD:-admin123qwe}"
export MYSQL_DATABASE="${MYSQL_DATABASE:-pkelo_dev}"
export MYSQL_USER="${MYSQL_USER:-pkelo_dev}"
export MYSQL_PASSWORD="${MYSQL_PASSWORD:-pkelo-dev-password}"
export MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-pkelo-dev-root-password}"
export MYSQL_VIEWER_USER="${MYSQL_VIEWER_USER:-pkelo_dev_viewer}"
export MYSQL_VIEWER_PASSWORD="${MYSQL_VIEWER_PASSWORD:-pkelo-dev-viewer-password}"

compose_pkelo_dev() {
  docker compose --project-name pkelo-dev \
    -f docker-compose.pkelo.yml -f docker-compose.pkelo.dev.yml "$@"
}

wait_for_mysql() {
  for _ in $(seq 1 60); do
    if compose_pkelo_dev exec -T pkelo-mysql sh -ec \
      'mysqladmin ping -h localhost -uroot -p"${MYSQL_ROOT_PASSWORD}" --silent' >/dev/null 2>&1; then
      echo "✅ PKELO 개발 MySQL이 준비되었습니다."
      return 0
    fi
    sleep 1
  done

  echo "❌ PKELO 개발 MySQL 준비 시간이 초과되었습니다." >&2
  return 1
}

case "${MODE}" in
  up)
    compose_pkelo_dev up -d pkelo-mysql
    wait_for_mysql
    ;;
  browser)
    compose_pkelo_dev up -d pkelo-mysql pkelo-adminer
    wait_for_mysql
    echo "✅ PKELO Adminer: http://localhost:${PKELO_DEV_ADMINER_PORT:-3302}"
    ;;
  down)
    compose_pkelo_dev stop pkelo-mysql
    ;;
  browser-down)
    compose_pkelo_dev stop pkelo-adminer
    ;;
  *)
    echo "usage: $0 [up|browser|down|browser-down]" >&2
    exit 1
    ;;
esac
