#!/usr/bin/env bash

set -euo pipefail

DEPLOY_ROOT="${PKPKDUPR_DEPLOY_PATH:-/opt/pkpkdupr}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
SHARED_ENV_FILE="${DEPLOY_ROOT}/env/shared.env"
PRIMARY_ENV_FILE="${DEPLOY_ROOT}/env/pkpkdupr.env"
SOURCE_DB_PATH="${PKPKDUPR_SQLITE_SOURCE_PATH:-${DEPLOY_ROOT}/data/db/db.sqlite}"
BACKUP_DIR="${DEPLOY_ROOT}/data/backups"

if [[ ! -f "${SHARED_ENV_FILE}" || ! -f "${PRIMARY_ENV_FILE}" ]]; then
  echo "❌ 분리된 pkpkdupr 운영 env 파일이 없습니다: ${DEPLOY_ROOT}/env/" >&2
  exit 1
fi
if [[ ! -f "${SOURCE_DB_PATH}" ]]; then
  echo "❌ SQLite 원본 파일이 없습니다: ${SOURCE_DB_PATH}" >&2
  exit 1
fi

require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "❌ '$1' 명령이 필요합니다." >&2
    exit 1
  }
}

require_command docker
docker compose version >/dev/null

cd "${SOURCE_REPO_ROOT}"
export PKPKDUPR_DEPLOY_PATH="${DEPLOY_ROOT}"

compose_primary() {
  docker compose --project-name pkpkdupr \
    --env-file "${SHARED_ENV_FILE}" --env-file "${PRIMARY_ENV_FILE}" \
    -f docker-compose.yml "$@"
}

echo "⏸️  SQLite 최종 스냅샷을 위해 API와 기존 DB 서버를 중지합니다..."
compose_primary stop api db-server || true

mkdir -p "${BACKUP_DIR}"
BACKUP_PATH="${BACKUP_DIR}/db.sqlite-before-mysql-$(date +%Y%m%d%H%M%S)"
cp -p "${SOURCE_DB_PATH}" "${BACKUP_PATH}"
echo "✅ SQLite 백업 생성: ${BACKUP_PATH}"

compose_primary pull mysql db-server
compose_primary up -d mysql

for _ in $(seq 1 60); do
  if compose_primary exec -T mysql sh -ec \
    'mysqladmin ping -h localhost -uroot -p"${MYSQL_ROOT_PASSWORD}" --silent' >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! compose_primary exec -T mysql sh -ec \
  'mysqladmin ping -h localhost -uroot -p"${MYSQL_ROOT_PASSWORD}" --silent' >/dev/null 2>&1; then
  echo "❌ MySQL 준비 시간이 초과되었습니다." >&2
  exit 1
fi

compose_primary run --rm --no-deps \
  -v "${BACKUP_PATH}:/legacy/db.sqlite:ro" \
  -e SQLITE_SOURCE_URL=file:/legacy/db.sqlite \
  db-server pnpm --filter @pkpkdupr/db-server exec tsx src/db/importSqlite.ts

echo "✅ SQLite → MySQL 데이터 이관이 완료되었습니다."
echo "   다음으로 새 이미지 tag를 지정해 scripts/manual-deploy.sh를 실행하세요."
