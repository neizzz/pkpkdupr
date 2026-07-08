#!/usr/bin/env bash

set -euo pipefail

DEPLOY_ROOT="/opt/pkpkdupr"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

ROOT_DIR="${SOURCE_REPO_ROOT}"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "❌ '$1' 명령이 필요합니다." >&2
    exit 1
  fi
}

require_command docker

docker compose version >/dev/null

cd "${SOURCE_REPO_ROOT}"
export PKPKDUPR_DEPLOY_PATH="${DEPLOY_ROOT}"

echo "ℹ️ 소스 repo 루트: ${SOURCE_REPO_ROOT}"
echo "ℹ️ 배포 루트: ${DEPLOY_ROOT}"
echo "🧹 안전 청소를 시작합니다."
echo "   - 프로젝트 컨테이너 및 orphan 컨테이너만 정리"
echo "   - named volume, data 디렉터리, 이미지 tag는 유지"

if [[ -f "${DEPLOY_ROOT}/.env" ]]; then
  docker compose --env-file "${DEPLOY_ROOT}/.env" down --remove-orphans
else
  docker compose down --remove-orphans
fi

echo "📦 현재 compose 상태"
if [[ -f "${DEPLOY_ROOT}/.env" ]]; then
  docker compose --env-file "${DEPLOY_ROOT}/.env" ps --all || true
else
  docker compose ps --all || true
fi

echo "✅ 안전 청소가 완료되었습니다."
