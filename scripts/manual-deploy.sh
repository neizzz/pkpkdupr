#!/usr/bin/env bash

set -euo pipefail

DEPLOY_ROOT="/opt/pkpkdupr"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

ROOT_DIR="${SOURCE_REPO_ROOT}"
ENV_DIR="${DEPLOY_ROOT}/env"
SHARED_ENV_FILE="${ENV_DIR}/shared.env"
PRIMARY_ENV_FILE="${ENV_DIR}/pkpkdupr.env"
PKELO_ENV_FILE="${ENV_DIR}/pkelo.env"
UPDATE_SERVER_SCRIPT="${SOURCE_REPO_ROOT}/scripts/update-server.sh"
MIGRATE_SQLITE_SCRIPT="${SOURCE_REPO_ROOT}/scripts/migrate-sqlite-to-mysql.sh"

IMAGE_TAG=""
GHCR_USERNAME_ARG=""
GHCR_TOKEN_ARG=""
MIGRATE_SQLITE=false
TARGET_STACK="all"

usage() {
  cat <<'EOF'
usage: bash scripts/manual-deploy.sh --image-tag <tag> [options]

서버에 SSH 로그인한 뒤, 배포 서버에서 실행하세요.
이 스크립트는 분리된 env 파일을 수정하지 않고,
필요 시 GHCR 로그인 정보만 export한 뒤 update-server.sh를 실행합니다.

필수:
  --image-tag <tag>               배포할 GHCR 이미지 태그

선택:
  --ghcr-username <value>         update-server.sh용 GHCR_USERNAME export
  --ghcr-token <value>            update-server.sh용 GHCR_TOKEN export
  --migrate-sqlite                SQLite 백업·MySQL 이관 검증 후 배포
  --stack <pkpkdupr|pkelo|all>    배포할 앱 스택 (기본: all)
  -h, --help                      도움말 출력

예시:
  bash scripts/manual-deploy.sh \
    --image-tag 3c966ab54d52e9df7e350b0a8ac9d94f828e37fe \
    --ghcr-username your-user \
    --ghcr-token your-token

  bash scripts/manual-deploy.sh \
    --image-tag 3c966ab54d52e9df7e350b0a8ac9d94f828e37fe
EOF
}

require_file() {
  local path="$1"
  if [[ ! -f "${path}" ]]; then
    echo "❌ 필요한 파일이 없습니다: ${path}" >&2
    exit 1
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --image-tag)
      IMAGE_TAG="${2:-}"
      shift 2
      ;;
    --ghcr-username)
      GHCR_USERNAME_ARG="${2:-}"
      shift 2
      ;;
    --ghcr-token)
      GHCR_TOKEN_ARG="${2:-}"
      shift 2
      ;;
    --migrate-sqlite)
      MIGRATE_SQLITE=true
      shift
      ;;
    --stack)
      TARGET_STACK="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "❌ 알 수 없는 옵션: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "${IMAGE_TAG}" ]]; then
  echo "❌ --image-tag 값이 필요합니다." >&2
  usage >&2
  exit 1
fi

require_file "${UPDATE_SERVER_SCRIPT}"
require_file "${SHARED_ENV_FILE}"
require_file "${PRIMARY_ENV_FILE}"
require_file "${PKELO_ENV_FILE}"
if [[ "${MIGRATE_SQLITE}" == true ]]; then
  require_file "${MIGRATE_SQLITE_SCRIPT}"
  if [[ "${TARGET_STACK}" == "pkelo" ]]; then
    echo "❌ --migrate-sqlite는 pkelo 단독 배포에 사용할 수 없습니다." >&2
    exit 1
  fi
fi

case "${TARGET_STACK}" in
  pkpkdupr|pkelo|all) ;;
  *)
    echo "❌ --stack은 pkpkdupr, pkelo, all 중 하나여야 합니다." >&2
    exit 1
    ;;
esac

cd "${SOURCE_REPO_ROOT}"

echo "ℹ️ 소스 repo 루트: ${SOURCE_REPO_ROOT}"
echo "ℹ️ 배포 루트: ${DEPLOY_ROOT}"

if [[ -n "${GHCR_USERNAME_ARG}" ]]; then
  export GHCR_USERNAME="${GHCR_USERNAME_ARG}"
fi

if [[ -n "${GHCR_TOKEN_ARG}" ]]; then
  export GHCR_TOKEN="${GHCR_TOKEN_ARG}"
fi

export PKPKDUPR_DEPLOY_PATH="${DEPLOY_ROOT}"
export IMAGE_TAG

if [[ "${MIGRATE_SQLITE}" == true ]]; then
  echo "🔁 SQLite → MySQL 이관을 시작합니다. 이 동안 API/DB 쓰기가 중단됩니다."
  bash "${MIGRATE_SQLITE_SCRIPT}"
fi

echo "🚀 서버 배포 스크립트를 실행합니다."
echo "   - IMAGE_TAG=${IMAGE_TAG}"
echo "   - TARGET_STACK=${TARGET_STACK}"
echo "   - ENV_DIR=${ENV_DIR}"

bash "${UPDATE_SERVER_SCRIPT}" "${IMAGE_TAG}" "${TARGET_STACK}"
