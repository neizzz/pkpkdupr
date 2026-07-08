#!/usr/bin/env bash

set -euo pipefail

DEPLOY_ROOT="/opt/pkpkdupr"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

ROOT_DIR="${SOURCE_REPO_ROOT}"
ENV_FILE="${DEPLOY_ROOT}/.env"
ENV_EXAMPLE_FILE="${SOURCE_REPO_ROOT}/.env.example"
UPSERT_ENV_SCRIPT="${SOURCE_REPO_ROOT}/scripts/upsert-env.sh"
UPDATE_SERVER_SCRIPT="${SOURCE_REPO_ROOT}/scripts/update-server.sh"
DEFAULT_DOMAIN="pkpkdupr.duckdns.org"
DEFAULT_WEB_PUBLIC_PORT="443"
DEFAULT_ADMIN_STACK_PORT="3333"

IMAGE_TAG=""
TARGET_DOMAIN=""
WEB_PUBLIC_PORT="${DEFAULT_WEB_PUBLIC_PORT}"
ADMIN_STACK_PORT="${DEFAULT_ADMIN_STACK_PORT}"
API_ADMIN_USERNAME=""
API_ADMIN_PASSWORD=""
GF_SECURITY_ADMIN_USER=""
GF_SECURITY_ADMIN_PASSWORD=""
GHCR_USERNAME_ARG=""
GHCR_TOKEN_ARG=""

usage() {
  cat <<'EOF'
usage: bash scripts/manual-deploy.sh --image-tag <tag> [options]

서버에 SSH 로그인한 뒤, 배포 서버에서 실행하세요.
이 스크립트는 .env가 없으면 .env.example을 복사하고,
update-server.sh 실행 전에 배포 관련 env 값을 현재 인자 기준으로 동기화합니다.

필수:
  --image-tag <tag>               배포할 GHCR 이미지 태그

선택:
  --public-domain <domain>        .env의 DOMAIN 값으로 사용할 공개 도메인
  --domain <domain>               --public-domain 별칭
  --web-public-port <port>        WEB_PUBLIC_PORT 값 (기본값: 443)
  --admin-stack-port <port>       ADMIN_STACK_PORT 값 (기본값: 3333)
  --api-admin-username <value>    API_ADMIN_USERNAME 덮어쓰기
  --api-admin-password <value>    API_ADMIN_PASSWORD 덮어쓰기
  --gf-admin-user <value>         GF_SECURITY_ADMIN_USER 덮어쓰기
  --gf-admin-password <value>     GF_SECURITY_ADMIN_PASSWORD 덮어쓰기
  --ghcr-username <value>         update-server.sh용 GHCR_USERNAME export
  --ghcr-token <value>            update-server.sh용 GHCR_TOKEN export
  -h, --help                      도움말 출력

예시:
  bash scripts/manual-deploy.sh \
    --image-tag 3c966ab54d52e9df7e350b0a8ac9d94f828e37fe \
    --public-domain pkpkdupr.example.com

  bash scripts/manual-deploy.sh \
    --image-tag 3c966ab54d52e9df7e350b0a8ac9d94f828e37fe \
    --public-domain pkpkdupr.example.com \
    --ghcr-username your-user \
    --ghcr-token your-token

  bash scripts/manual-deploy.sh \
    --image-tag 3c966ab54d52e9df7e350b0a8ac9d94f828e37fe \
    --public-domain pkpkdupr.example.com \
    --web-public-port 443 \
    --admin-stack-port 3333 \
    --api-admin-username admin \
    --gf-admin-user admin
EOF
}

require_script() {
  local path="$1"
  if [[ ! -f "${path}" ]]; then
    echo "❌ 필요한 스크립트가 없습니다: ${path}" >&2
    exit 1
  fi
}

read_env_value() {
  local key="$1"
  if [[ ! -f "${ENV_FILE}" ]]; then
    return 0
  fi

  local value
  value="$(awk -F= -v target="$key" '$1 == target { print substr($0, index($0, "=") + 1) }' "${ENV_FILE}" | tail -n 1)"
  printf '%s' "${value}"
}

upsert_env_value() {
  local key="$1"
  local value="$2"
  bash "${UPSERT_ENV_SCRIPT}" "${ENV_FILE}" "${key}" "${value}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --image-tag)
      IMAGE_TAG="${2:-}"
      shift 2
      ;;
    --public-domain|--domain)
      TARGET_DOMAIN="${2:-}"
      shift 2
      ;;
    --web-public-port)
      WEB_PUBLIC_PORT="${2:-}"
      shift 2
      ;;
    --admin-stack-port)
      ADMIN_STACK_PORT="${2:-}"
      shift 2
      ;;
    --api-admin-username)
      API_ADMIN_USERNAME="${2:-}"
      shift 2
      ;;
    --api-admin-password)
      API_ADMIN_PASSWORD="${2:-}"
      shift 2
      ;;
    --gf-admin-user)
      GF_SECURITY_ADMIN_USER="${2:-}"
      shift 2
      ;;
    --gf-admin-password)
      GF_SECURITY_ADMIN_PASSWORD="${2:-}"
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

require_script "${UPSERT_ENV_SCRIPT}"
require_script "${UPDATE_SERVER_SCRIPT}"

cd "${SOURCE_REPO_ROOT}"

echo "ℹ️ 소스 repo 루트: ${SOURCE_REPO_ROOT}"
echo "ℹ️ 배포 루트: ${DEPLOY_ROOT}"

if [[ ! -f "${ENV_FILE}" ]]; then
  if [[ ! -f "${ENV_EXAMPLE_FILE}" ]]; then
    echo "❌ .env.example 파일이 없습니다: ${ENV_EXAMPLE_FILE}" >&2
    exit 1
  fi

  cp "${ENV_EXAMPLE_FILE}" "${ENV_FILE}"
  echo "ℹ️ .env 파일이 없어 .env.example을 복사했습니다: ${ENV_FILE}"
fi

if [[ -z "${TARGET_DOMAIN}" ]]; then
  TARGET_DOMAIN="$(read_env_value DOMAIN)"
fi
TARGET_DOMAIN="${TARGET_DOMAIN:-${DEFAULT_DOMAIN}}"

CURRENT_WEB_PUBLIC_PORT="$(read_env_value WEB_PUBLIC_PORT)"
CURRENT_ADMIN_STACK_PORT="$(read_env_value ADMIN_STACK_PORT)"

if [[ "${WEB_PUBLIC_PORT}" == "${DEFAULT_WEB_PUBLIC_PORT}" && -n "${CURRENT_WEB_PUBLIC_PORT}" ]]; then
  WEB_PUBLIC_PORT="${CURRENT_WEB_PUBLIC_PORT}"
fi

if [[ "${ADMIN_STACK_PORT}" == "${DEFAULT_ADMIN_STACK_PORT}" && -n "${CURRENT_ADMIN_STACK_PORT}" ]]; then
  ADMIN_STACK_PORT="${CURRENT_ADMIN_STACK_PORT}"
fi

echo "📝 배포용 .env 값을 동기화합니다."
upsert_env_value DOMAIN "${TARGET_DOMAIN}"
upsert_env_value WEB_PUBLIC_PORT "${WEB_PUBLIC_PORT}"
upsert_env_value ADMIN_STACK_PORT "${ADMIN_STACK_PORT}"
upsert_env_value VITE_API_BASE_URL "https://${TARGET_DOMAIN}:${ADMIN_STACK_PORT}"
upsert_env_value GF_SERVER_ROOT_URL "https://${TARGET_DOMAIN}:${ADMIN_STACK_PORT}/grafana/"

if [[ -n "${API_ADMIN_USERNAME}" ]]; then
  upsert_env_value API_ADMIN_USERNAME "${API_ADMIN_USERNAME}"
fi

if [[ -n "${API_ADMIN_PASSWORD}" ]]; then
  upsert_env_value API_ADMIN_PASSWORD "${API_ADMIN_PASSWORD}"
fi

if [[ -n "${GF_SECURITY_ADMIN_USER}" ]]; then
  upsert_env_value GF_SECURITY_ADMIN_USER "${GF_SECURITY_ADMIN_USER}"
fi

if [[ -n "${GF_SECURITY_ADMIN_PASSWORD}" ]]; then
  upsert_env_value GF_SECURITY_ADMIN_PASSWORD "${GF_SECURITY_ADMIN_PASSWORD}"
fi

if [[ -n "${GHCR_USERNAME_ARG}" ]]; then
  export GHCR_USERNAME="${GHCR_USERNAME_ARG}"
fi

if [[ -n "${GHCR_TOKEN_ARG}" ]]; then
  export GHCR_TOKEN="${GHCR_TOKEN_ARG}"
fi

export PKPKDUPR_DEPLOY_PATH="${DEPLOY_ROOT}"

echo "🚀 서버 배포 스크립트를 실행합니다."
echo "   - IMAGE_TAG=${IMAGE_TAG}"
echo "   - DOMAIN=${TARGET_DOMAIN}"
echo "   - WEB_PUBLIC_PORT=${WEB_PUBLIC_PORT}"
echo "   - ADMIN_STACK_PORT=${ADMIN_STACK_PORT}"

bash "${UPDATE_SERVER_SCRIPT}" "${IMAGE_TAG}"
