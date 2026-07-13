# 배포 workflow 정리

PkpkDupr 저장소의 GitHub Actions 배포 흐름은 현재 **이미지 빌드/푸시** 후 **서버에서 `scripts/manual-deploy.sh` 실행**하는 방식입니다.

## 1. `build-and-push-images`

파일: `/Users/neiz/pkpkdupr/.github/workflows/deploy.yml`

- 목적: GHCR에 배포용 이미지를 빌드하고 푸시합니다.
- 수행 범위:
  - web/admin-web/api/db-server 이미지 빌드
  - GHCR push
  - 배포 후 서버 실행용 `scripts/manual-deploy.sh` 기준 수동 반영 절차와 검증 URL summary 출력
- 수행하지 않는 것:
  - GitHub Actions runner에서 서버로 SSH 접속
  - `ssh-keyscan`
  - `scp`
  - 원격 `update-server.sh` 실행

### 필요한 설정

- `PUBLIC_DOMAIN` 또는 `DEPLOY_HOST` 중 하나
  - web 이미지의 `VITE_API_BASE_URL` 빌드 값 계산에 필요
- `DEPLOY_PORT` (선택, 기본값 `22`)

## 현재 운영 원칙

- GitHub Actions 안에서는 더 이상 `DEPLOY_SSH_KEY` 기반 자동 원격 반영을 수행하지 않습니다.
- 서버 반영은 사람이 로컬 SSH 환경에서 직접 수행합니다.
- 서버 접속 후 실제 배포 반영은 `scripts/manual-deploy.sh` 가 담당합니다.
- 추후 자동화가 필요하면 SSH secret 복구가 아니라 별도 self-hosted runner 또는 서버 pull 기반 구조로 다시 설계합니다.

## 현재 운영 구조와 확인 경로

- 기본 웹은 `https://<DOMAIN>/`에서 제공됩니다.
- 관리/운영 스택은 `https://<DOMAIN>:3333` 포트에서 제공합니다.
  - Admin: `/admin/`
  - API health: `/api/health`
  - API ping: `/api/ping`
  - Uptime Kuma: `/uptime/`
  - sqlite-web (read-only): `/db/`
- Grafana는 현재 구성에 포함되지 않습니다. 모니터링 확인은 Uptime Kuma를 사용합니다.

## 서버에서 실행하는 배포 스크립트

파일: `/Users/neiz/pkpkdupr/scripts/manual-deploy.sh`

- 목적: SSH로 서버에 접속한 뒤, 기존 `.env`를 그대로 사용해 `update-server.sh`를 실행합니다.
- 기본 동작:
  - `/opt/pkpkdupr/.env` 파일이 이미 존재하는지 확인
  - 필요 시 GHCR 로그인 정보 export 후 `scripts/update-server.sh <image_tag>` 실행
  - 기존 `.env`는 수정하지 않음

최초 설치 또는 인증서/SWAG 설정 생성·복구가 필요한 경우에는 일반 배포 전에
`scripts/install-server.sh`를 실행합니다. `.env` 값 자체의 변경은 서버에서 별도로
관리해야 합니다.

서버 반영 순서:

```bash
ssh -p <DEPLOY_PORT> <DEPLOY_USER>@<DEPLOY_HOST>
cd /opt/pkpkdupr
chmod +x scripts/manual-deploy.sh scripts/update-server.sh
bash scripts/manual-deploy.sh --image-tag <IMAGE_TAG>
```

배포 스크립트는 web, admin-web, api, db-server, Uptime Kuma, sqlite-web을 기동하고
위 운영 스택 URL을 확인합니다.

예시:

```bash
bash scripts/manual-deploy.sh \
  --image-tag 3c966ab54d52e9df7e350b0a8ac9d94f828e37fe
```
