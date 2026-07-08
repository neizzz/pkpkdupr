#!/usr/bin/env bash

set -euo pipefail

DEPLOY_ROOT="/opt/pkpkdupr"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

ROOT_DIR="${SOURCE_REPO_ROOT}"
ENV_FILE="${DEPLOY_ROOT}/.env"
UPDATE_SERVER_SCRIPT="${SOURCE_REPO_ROOT}/scripts/update-server.sh"

IMAGE_TAG=""
GHCR_USERNAME_ARG=""
GHCR_TOKEN_ARG=""

usage() {
  cat <<'EOF'
usage: bash scripts/manual-deploy.sh --image-tag <tag> [options]

서버에 SSH 로그인한 뒤, 배포 서버에서 실행하세요.
이 스크립트는 기존 .env를 수정하지 않고,
필요 시 GHCR 로그인 정보만 export한 뒤 update-server.sh를 실행합니다.

필수:
  --image-tag <tag>               배포할 GHCR 이미지 태그

선택:
  --ghcr-username <value>         update-server.sh용 GHCR_USERNAME export
  --ghcr-token <value>            update-server.sh용 GHCR_TOKEN export
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
require_file "${ENV_FILE}"

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

echo "🚀 서버 배포 스크립트를 실행합니다."
echo "   - IMAGE_TAG=${IMAGE_TAG}"
echo "   - ENV_FILE=${ENV_FILE}"

bash "${UPDATE_SERVER_SCRIPT}" "${IMAGE_TAG}"
