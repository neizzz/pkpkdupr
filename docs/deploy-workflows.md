# 배포 workflow 정리

PkpkDupr 저장소의 GitHub Actions 배포 흐름은 현재 **이미지 빌드/푸시**와 **수동 원격 반영 체크리스트 생성**으로 분리되어 있습니다.

## 1. `build-and-push-images`

파일: `/Users/neiz/pkpkdupr/.github/workflows/deploy.yml`

- 목적: GHCR에 배포용 이미지를 빌드하고 푸시합니다.
- 수행 범위:
  - web/admin-web/api/db-server 이미지 빌드
  - GHCR push
  - 배포 후 수동 반영 절차 summary 출력
- 수행하지 않는 것:
  - GitHub Actions runner에서 서버로 SSH 접속
  - `ssh-keyscan`
  - `scp`
  - 원격 `update-server.sh` 실행

### 필요한 설정

- `PUBLIC_DOMAIN` 또는 `DEPLOY_HOST` 중 하나
  - web 이미지의 `VITE_API_BASE_URL` 빌드 값 계산에 필요
- `DEPLOY_PORT` (선택, 기본값 `22`)

## 2. `manual-remote-deploy`

파일: `/Users/neiz/pkpkdupr/.github/workflows/manual-remote-deploy.yml`

- 목적: 사람이 로컬 터미널에서 따라 할 수 있는 **수동 원격 반영 체크리스트**를 생성합니다.
- 수행 범위:
  - image tag 기준 배포 대상 이미지 요약
  - SSH/scp/서버 반영 명령 예시 출력
  - `deploy_user`, `deploy_host`, `deploy_port`, `public_domain` 입력값 기반 placeholder 치환
- 수행하지 않는 것:
  - 실제 SSH 접속
  - 실제 파일 업로드
  - 실제 서버 반영 실행

### 입력값 fallback

- `deploy_user`: 비어 있으면 `<DEPLOY_USER>`
- `deploy_host`: 비어 있으면 `<DEPLOY_HOST>`
- `deploy_port`: 비어 있으면 `22`
- `public_domain`: 비어 있으면 `deploy_host`, 둘 다 비어 있으면 `<PUBLIC_DOMAIN_OR_DEPLOY_HOST>`

## 현재 운영 원칙

- GitHub Actions 안에서는 더 이상 `DEPLOY_SSH_KEY` 기반 자동 원격 반영을 수행하지 않습니다.
- 서버 반영은 사람이 로컬 SSH 환경에서 직접 수행합니다.
- 추후 자동화가 필요하면 SSH secret 복구가 아니라 별도 self-hosted runner 또는 서버 pull 기반 구조로 다시 설계합니다.
