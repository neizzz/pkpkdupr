# Repository Overview

## Project Description
- **Pickleball DUPR System**: 피클볼 경기자 DUPR(골프 Handicap와 유사한 세계 평점)을 관리하는 시스템입니다.
- 주요 목표: 플레이어 등록/프로필 관리, 매칭(1대1 또는 2대2), 경기 결과 기록 및 평점 갱신

## Architecture Overview

```
┌───────────────┐           ┌────────────────────────────┐
│   Frontend     │───/api──▶│       Backend (API)          │
│  React + Vite │ ←JSON←   │     Express + TypeScript      │
│   :3000        │           │      :4000                    │
└──────┬────────┘           └────────────────────────────┘
        │                      ▲
        ├─ /src/pages/         │ shared type interfaces
        ├─ /src/App.tsx        │ (player, match)
        │                      ▼
        └─────────────────────┐ packages/shared (Monorepo)
                               └─ TypeScript 인터페이스 공유
```

- **Frontend** (`apps/web`): Vite + React + TypeScript, 개발 시 `/api` 프록시 → `localhost:4000`
- **Backend** (`apps/api`): Express, CORS 지원, health/ping 엔드포인트
- **Shared** (`packages/shared`): 도메인 타입 — FE와 API가 동일하게 import

## Directory Structure

```
├── package.json              # monorepo root (pnpm workspace)
├── pnpm-workspace.yaml       # apps/* + packages/*로 구성
├── .gitignore                # node_modules, dist, build, env 등
├── .continue/                # Continue CLI 규칙 및 스킬
│   ├── rules.md              # 글로벌 규칙 (소요시간 등)
│   ├── slash_commands/       # 커스텀 슬래시 명령어
│   └── skills/               # 커스텀 스킬
│       └── commit/SKILL.md   # 커밋 컨벤션 자동화 스킬
├── apps/api/                 # API 서버 (Express)
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       └── index.ts          # Express 앱, health & ping endpoint
├── apps/web/                 # Frontend (React + Vite + TypeScript)
│   ├── package.json
│   ├── vite.config.ts        # dev server :3000, API proxy → localhost:4000
│   ├── tsconfig.json         # @ alias = src/
│   └── src/
│       ├── main.tsx          # ReactDOM entry, BrowserRouter
│       ├── App.tsx           # Routes 정의
│       ├── index.css         # Reset style + font
│       └── pages/
│           └── Home.tsx      # Landing page
└── packages/shared/          # 타입 인터페이스 공유 패키지
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── player.ts         # Player, PlayerProfile interface
        └── match.ts          # Match, Team, MatchResult 등 도메인 타입
```

## Development Workflow

### Quick Start
```bash
# Install dependencies (1회)
pnpm install

# Run both API + FE together
pnpm dev              # → API :4000, Web :3000

# 또는 개별 실행
pnpm dev:api          # API만 (tsx watch)
pnpm dev:web          # FE만 (vite HMR)

# Build
pnpm build            # 전체 빌드
pnpm build:api        # tsc → dist/
pnpm build:web        # Vite production build
```

### Environment
- Node.js >= 18, pnpm >= 8.0.0 필요 (패키지 루트 `engines` 설정)
- ESLint 미설치 상태 — `pnpm lint`는 실행 전 설치 필요

## API Endpoints (Current)

| Path | Method | Description |
|------|--------|-------------|
| `/api/health` | GET | 서비스 상태 확인 |
| `/api/ping` | GET | 서버 응답 확인 |

## Technology Stack

| Component | Tech |
|-----------|------|
| Frontend | React 18, Vite 5, TypeScript 5, React Router DOM |
| Backend | Express 4, CORS |
| Package Manager | pnpm workspace (monorepo) |
| Build/Dev | tsx (API watch), vite (FE HMR) |

## Commit Convention

- 커밋 title에 `feat:`, `fix:`, `refactor:`, `chore:` prefix를 붙입니다.
- Prefix 선택 기준은 변경사항의 **성격**에 따라 결정합니다 (경로가 아님).
- `[Agent]` 참고: `.continue/skills/commit/SKILL.md` 참조
