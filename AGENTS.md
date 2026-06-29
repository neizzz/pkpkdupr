# Repository Overview

## Project Description

- **PkpkDupr**는 피클볼 플레이어 계정, DUPR 유사 평점, 경기 도메인 타입을 관리하는 pnpm 모노레포입니다.
- 현재 구현의 중심은 **인증/회원 관리**, **관리자 대시보드**, **내부 DB 서버 분리**, **공유 타입 일원화**입니다.

## Current Architecture

```text
┌────────────────────┐      /api       ┌────────────────────┐
│ apps/web           │ ──────────────▶ │ apps/api           │
│ React 19 + Vite    │ ◀────────────── │ Express + JWT      │
│ :3000              │                 │ :4000              │
└────────────────────┘                 └─────────┬──────────┘
                                                 │ internal HTTP
┌────────────────────┐      /api                 │
│ apps/admin-web     │ ──────────────────────────┘
│ React 18 + Vite    │
│ :3100              │                 ┌────────────────────┐
└────────────────────┘                 │ apps/db-server     │
                                       │ Express + libSQL   │
                                       │ + Drizzle          │
                                       │ :5001              │
                                       └─────────┬──────────┘
                                                 │
                                       ┌────────────────────┐
                                       │ packages/shared    │
                                       │ player / match     │
                                       │ domain types       │
                                       └────────────────────┘
```

### App Responsibilities

- **`apps/web`**
  - 일반 사용자용 웹 앱
  - 로그인, `/api/me` 기반 사용자 정보 로드
  - `BottomNav` 기반 Match / Player / Me 탭 셸
  - QR 코드 모달 UI 포함
- **`apps/admin-web`**
  - 관리자 로그인/대시보드
  - 회원 생성
  - 회원 상태(active/inactive) 변경
  - 계정 생성 로그 / 상태 변경 로그 조회
- **`apps/api`**
  - 외부에 노출되는 퍼블릭 API
  - JWT 발급/검증
  - 관리자 권한 검사
  - DB 서버와 HTTP로 통신하는 오케스트레이션 레이어
- **`apps/db-server`**
  - libSQL/Drizzle 기반 내부 저장소 서버
  - 플레이어/로그 저장 및 스키마 초기화
  - 레거시 `dupr_rating` 값 정규화와 기본 스키마 보정 수행
- **`packages/shared`**
  - `player.ts`, `match.ts` 도메인 타입 공유
  - API/FE/Admin/DB 서버가 동일 타입 계약을 참조

## Directory Structure

```text
├── package.json
├── pnpm-workspace.yaml
├── .continue/
│   ├── slash_commands/
│   │   └── review.md
│   └── skills/
│       └── commit/
│           └── SKILL.md
├── apps/
│   ├── api/
│   │   └── src/
│   │       ├── config/
│   │       ├── middleware/
│   │       ├── repositories/
│   │       ├── services/
│   │       └── index.ts
│   ├── db-server/
│   │   └── src/
│   │       ├── db/
│   │       ├── repositories/
│   │       └── index.ts
│   ├── web/
│   │   ├── AGENTS.md
│   │   └── src/
│   │       ├── components/
│   │       ├── context/
│   │       ├── pages/
│   │       └── App.tsx
│   └── admin-web/
│       └── src/
│           ├── context/
│           ├── pages/
│           └── App.tsx
└── packages/
    └── shared/
        └── src/
            ├── player.ts
            └── match.ts
```

## Development Workflow

### Quick Start

```bash
# 의존성 설치
pnpm install

# 전체 개발 서버 실행
pnpm dev
# 실행 대상:
# - apps/web      :3000
# - apps/admin-web:3100
# - apps/api      :4000
# - apps/db-server:5001

# 개별 실행
pnpm dev:web
pnpm dev:api
pnpm dev:admin
pnpm --filter @pkpkdupr/db-server dev

# 빌드
pnpm build
pnpm build:web
pnpm build:admin
pnpm build:api
pnpm --filter @pkpkdupr/db-server build
```

### Runtime Notes

- 루트 `package.json`에는 **`pnpm >= 8.0.0`만 명시**되어 있습니다.
- API는 기본적으로 `DB_SERVER_URL=http://localhost:5001`를 사용합니다.
- JWT secret은 기본값 `dev-secret`을 사용하며, 운영/공유 환경에서는 환경변수로 덮어써야 합니다.
- API 시작 시 기본 관리자 계정 **`admin / admin123`** 을 자동 초기화합니다.

## API Surface

### Public / Client-facing (`apps/api`)

| Path | Method | Description |
|------|--------|-------------|
| `/api/health` | GET | API 상태 확인 |
| `/api/ping` | GET | 단순 응답 확인 |
| `/api/register` | POST | 일반 사용자 회원가입 |
| `/api/login` | POST | 로그인 및 access token 발급 |
| `/api/me` | GET | 현재 사용자 정보 조회 |
| `/api/change-password` | POST | 로그인 사용자 비밀번호 변경 |
| `/api/admin/players` | GET | 관리자용 회원 목록 조회 |
| `/api/admin/register` | POST | 관리자용 회원 생성 |
| `/api/admin/players/:playerId/status` | PATCH | 회원 상태 변경 |
| `/api/admin/player-creation-logs` | GET | 계정 생성 로그 조회 |
| `/api/admin/player-status-logs` | GET | 상태 변경 로그 조회 |

### Internal (`apps/db-server`)

`/internal/*` 엔드포인트는 API 서버가 호출하는 내부 저장 계층입니다.

- `/internal/players`
- `/internal/players/by-username/:username`
- `/internal/players/:id`
- `/internal/players/:id/status`
- `/internal/players/:id/password`
- `/internal/players/init-admin`
- `/internal/player-creation-logs`
- `/internal/player-status-change-logs`

## Shared Domain Model Notes

- `Player.duprRating`은 단일 숫자가 아니라 다음 구조를 사용합니다.
  - `total`
  - `doubles.mixed`
  - `doubles.men`
  - `doubles.women`
  - `singles`
- API ↔ DB 서버 간 JSON 왕복 시 `Date`는 문자열로 전달되므로 서비스 계층에서 다시 `Date`로 hydrate 합니다.
- 레거시 숫자형 `dupr_rating` 값은 DB 서버 시작 시 객체 구조로 정규화됩니다.
- 플레이어 상태는 현재 `active | inactive` 두 가지입니다.

## Technology Stack

| Area | Tech |
|------|------|
| Web | React 19, Vite 5, TypeScript 5, HeroUI 3, Tailwind CSS 4 |
| Admin Web | React 18, Vite 5, TypeScript 5, Tailwind CSS 4 |
| API | Express 4, bcryptjs, jsonwebtoken, TypeScript |
| DB Server | Express 4, libSQL client, Drizzle ORM |
| Shared | TypeScript source export package |
| Workspace | pnpm workspace monorepo |

## Commit Convention

- 커밋 제목은 `feat:`, `fix:`, `refactor:`, `chore:` 중 하나로 시작합니다.
- Prefix는 **파일 경로가 아니라 변경 성격**으로 결정합니다.
- 커밋 전/리뷰 시에는 `packages/shared` 변경이 web/api/admin/db-server 계약에 미치는 영향을 함께 확인합니다.
- 세부 커밋 규칙은 `.continue/skills/commit/SKILL.md`를 따릅니다.
