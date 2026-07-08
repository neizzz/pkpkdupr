#!/usr/bin/env bash

set -euo pipefail

DEPLOY_ROOT="/opt/pkpkdupr"

ROOT_DIR="${DEPLOY_ROOT}"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "❌ '$1' 명령이 필요합니다." >&2
    exit 1
  fi
}

require_command docker

docker compose version >/dev/null

cd "${ROOT_DIR}"

echo "ℹ️ 배포 루트: ${ROOT_DIR}"
echo "🧹 안전 청소를 시작합니다."
echo "   - 프로젝트 컨테이너 및 orphan 컨테이너만 정리"
echo "   - named volume, data 디렉터리, 이미지 tag는 유지"

docker compose down --remove-orphans

echo "📦 현재 compose 상태"
docker compose ps --all || true

echo "✅ 안전 청소가 완료되었습니다."
