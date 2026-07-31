#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source ./.env
  set +a
fi

bash scripts/dev-db.sh

export ENABLE_DEV_MOCK_DATA=true
export DB_HOST=127.0.0.1
export DB_PORT=3306
export DB_NAME="${MYSQL_DATABASE:-pkpkdupr}"
export DB_USER="${MYSQL_USER:-pkpkdupr}"
export DB_PASSWORD="${MYSQL_PASSWORD:-change-me}"

exec pnpm -r --parallel dev
