# PKELO 프로젝트 가이드

## 개요

- 제품명은 **PKELO**이며, 저장소/패키지 식별자는 기존의 `pkpkdupr`를 유지합니다.
- 피클볼 플레이어, 경기 기록, DUPR 유사 평점과 관리자 운영 도구를 관리하는 pnpm 모노레포입니다.
- 변경은 공유 계약(`packages/shared`)부터 API, DB 서버, web/admin 소비처까지 한 흐름으로 확인합니다.

## 아키텍처

```text
apps/web (:8080) ─┐
apps/admin-web (:3100) ─┼─> apps/api (:4000) ─internal HTTP─> apps/db-server (:5001)
                       │
                       └─> packages/shared (player, match, qr domain types)
```

| 영역 | 책임 |
| --- | --- |
| `apps/web` | React 19 사용자 앱. 인증, Match / Members / Me 탭, QR, PWA를 담당합니다. |
| `apps/admin-web` | React 18 관리자 로그인과 회원·경기·평점 운영 화면을 담당합니다. |
| `apps/api` | Express 공개 API, JWT 인증, 관리자 권한 검사, DB 서버 오케스트레이션을 담당합니다. |
| `apps/db-server` | libSQL + Drizzle 저장 계층, 스키마 초기화와 내부 `/internal/*` API를 담당합니다. |
| `packages/shared` | `player.ts`, `match.ts`, `qr.ts`의 공통 도메인 계약을 제공합니다. |

## 개발 명령

```bash
pnpm install
pnpm dev                         # dev mock data와 전체 워크스페이스 실행
pnpm dev:web                     # Vite web :8080
pnpm dev:api                     # API :4000
pnpm dev:admin                   # admin Vite :3100
pnpm --filter @pkpkdupr/db-server dev  # DB server :5001

pnpm build
pnpm build:web
pnpm build:api
pnpm build:admin
pnpm lint

pnpm dev:monitoring              # Uptime Kuma :3300, sqlite-web :3301
pnpm dev:monitoring:down
PKPKDUPR_WEB_URL=https://<DOMAIN> PKPKDUPR_ADMIN_STACK_URL=https://<DOMAIN>:3333 pnpm check:healthy
```

- 루트 `pnpm dev`는 `ENABLE_DEV_MOCK_DATA=true`와 `data/db/db.sqlite`를 사용합니다.
- web Vite proxy는 `/api`, `/uploads`, `/uptime`, `/db`를 각각 API 또는 개발 모니터링 서비스로 연결합니다.
- `apps/web/dist/`는 빌드 산출물이므로 커밋하지 않습니다.

## Web 규칙

- 전역 라우트는 `/`, `/login`, `/force-change-password`, 개발 전용 `/dev/qrs`입니다.
- 로그인 뒤의 Match / Members / Me는 `BottomNav.tsx`의 keep-alive 탭 셸이 소유합니다. 탭 상태와 URL 라우트를 무분별하게 중복하지 않습니다.
- `apps/web/AGENTS.md`의 모바일·PWA·UI 세부 규칙을 함께 따릅니다.
- 모바일 고정 하단 UI는 `env(safe-area-inset-bottom)`과 `--app-keyboard-offset`을 고려합니다. 스크롤 소유자는 `app-tab-panel-scroll-area`입니다.
- PWA 아이콘은 URL 기반입니다. 아이콘을 변경하면 `apps/web/index.html`의 favicon/Apple touch icon과 `apps/web/vite.config.ts`의 manifest·`includeAssets`를 같이 확인합니다.

## API와 도메인 계약

주요 공개 API:

- 상태: `GET /api/health`, `GET /api/ping`
- 인증/프로필: `POST /api/register`, `POST /api/login`, `GET /api/me`, `POST /api/change-password`, `PATCH /api/me/profile`, avatar API
- 플레이어/QR: `GET /api/players`, `GET /api/player-qr-token`, `POST /api/player-qr-token/verify`
- 경기: `GET|POST /api/matches`, 경기 결과·승인 API, `GET /api/match-feed`, 세션 조회 API
- 관리자: 선수/감사 로그, 경기 일괄 등록·메타데이터, 비밀번호 초기화, 평점 재계산, 공식 DUPR 조정 API

도메인 규칙:

- `Player.duprRating`은 단일 숫자가 아니라 singles/doubles 분류와 metric을 포함하는 상태입니다. `null`인 NR 값도 허용합니다.
- API와 DB 서버 사이의 `Date`는 JSON에서 문자열이므로 서비스 계층에서 hydrate 합니다.
- 경기 타입·스코어·세션 계약은 `packages/shared/src/match.ts`가 기준입니다.
- `packages/shared` 변경 시 web, admin-web, api, db-server 전체 소비처를 같은 변경 단위에서 점검합니다.

## 운영과 배포

- GitHub Actions는 GHCR 이미지 빌드/푸시까지만 담당합니다. 서버 반영은 SSH 환경에서 `scripts/manual-deploy.sh --image-tag <tag>`로 실행합니다.
- 운영 proxy는 SWAG이며, 템플릿 원본은 `infra/swag/site-confs/default.conf.template`입니다.
- 운영 경로:
  - Web: `https://<DOMAIN>/`
  - Admin/API/운영 도구: `https://<DOMAIN>:3333/{admin/,api/health,api/ping,uptime/,db/}`
  - Uptime Kuma 초기 설정도 `/uptime/setup-database`를 사용합니다. 루트 `/setup-database`는 이 경로로 리다이렉트됩니다.
- 실제 서버 SWAG 설정은 `/opt/pkpkdupr/data/certs/nginx/site-confs/default.conf`이며, 배포 스크립트가 템플릿에서 생성합니다.
- `/uptime/`, `/db/`은 HTML 응답이므로 상태 코드뿐 아니라 기대 텍스트와 `404 not found` 여부를 함께 확인합니다.

## 작업 및 커밋 규칙

- 먼저 현재 변경과 기존 dirty tree를 확인하고, 관련 없는 변경은 명시적으로 제외합니다.
- `git add .`, `git commit -a`, reset, rebase, force push를 사용하지 않습니다.
- 커밋 제목은 `feat:`, `fix:`, `refactor:`, `chore:` 중 하나로 시작하며 변경 성격으로 선택합니다.
- 변경 후에는 영향 범위에 맞는 빌드/테스트를 실행합니다. web 변경은 기본적으로 `pnpm build:web`를 우선합니다.
