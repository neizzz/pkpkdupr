---
name: commit
description: 커밋하기, 코드 저장, git commit
argument-hint: "[커밋 메시지 / 생략 시 변경사항 분석 후 자동 생성]"
---

# Commit

프로젝트 변경사항을 안전하게 커밋합니다.

## Conventions

- 커밋 제목은 반드시 `feat:`, `fix:`, `refactor:`, `chore:` 중 하나로 시작합니다.
- Prefix는 **파일 위치가 아니라 변경 성격**으로 고릅니다.
- 제목은 구체적으로 씁니다. 모호한 한 단어 메시지는 피합니다.

| Prefix | 사용 기준 |
|--------|----------|
| `feat:` | 새로운 기능 추가, API/컴포넌트 신규 도입 |
| `fix:` | 버그 수정, 오류 해결 |
| `refactor:` | 기능은 그대로, 코드 구조 정리 (리팩토링) |
| `chore:` | 설정 파일, 의존성 업데이트, 빌드 설정 |

예시:
- `feat: 관리자 회원 생성 API 추가`
- `fix: 비활성 계정 로그인 차단 처리`
- `refactor: 인증 로직에서 DB 서버 호출 정리`
- `chore: admin-web 빌드 설정 정리`

## Commit Message Format

커밋 메시지는 **짧지만 구체적**이어야 합니다.

- Title: `<prefix>: <무엇을 변경했는지>`
- 필요 시 body에 변경 이유/영향 범위를 추가합니다.

좋은 예시:
- `feat: 관리자 대시보드에 회원 상태 변경 추가`
- `fix: 로그인 후 사용자 정보 조회 실패 수정`
- `refactor: shared player 타입 사용으로 중복 제거`
- `chore: db-server 개발 스크립트 정리`

나쁜 예시:
- `feat: something` — 너무 모호함
- `fix: bug fix` — 무엇을 고쳤는지 불명확
- `upd` — prefix가 없음

## Instructions

### 1. 변경 범위 확인

```bash
git status --short
git diff --name-only HEAD
```

- 인자로 메시지가 주어지면 우선 사용하되, prefix가 없으면 적절한 prefix를 붙입니다.
- 메시지가 없으면 diff를 보고 prefix와 제목을 제안합니다.
- unrelated change가 섞여 있으면 **한 번에 전부 커밋하지 말고 범위를 먼저 정리**합니다.

### 2. 변경 성격 분류

- `packages/shared` 변경은 web/api/admin/db-server 영향 여부를 확인합니다.
- `apps/api` 변경은 인증/JWT/DB 서버 계약을 확인합니다.
- `apps/web`, `apps/admin-web` 변경은 라우트/인증/UI 회귀를 확인합니다.
- 여러 성격이 섞이면 가능하면 커밋을 분리합니다.

### 3. 검증

변경 범위에 맞는 최소 검증을 실행합니다.

```bash
pnpm lint
pnpm build
```

모든 경우에 전체 검증이 필요한 것은 아닙니다. 변경 범위가 작으면 아래처럼 범위를 좁혀도 됩니다.

```bash
pnpm build:web
pnpm build:api
pnpm build:admin
pnpm --filter @pkpkdupr/db-server build
```

- 검증에 실패하면 원인을 공유하고, 사용자 의도 없이 강행 커밋하지 않습니다.
- lint/build 스크립트가 패키지별로 다르므로, 바뀐 영역 기준으로 현실적인 검증을 선택합니다.

### 4. stage → commit

```bash
git add <의도한 파일들>
git commit -m "feat: ..."
```

- 기본값은 **의도한 파일만 선택적으로 stage** 하는 것입니다.
- 사용자가 명시적으로 전체 커밋을 요청한 경우에만 `git add -A`를 고려합니다.

## 주의사항

- `node_modules/`, build 산출물, 임시 파일이 stage되지 않게 확인합니다.
- prefix는 반드시 `feat:`, `fix:`, `refactor:`, `chore:` 중 하나만 사용합니다.
- 성격이 섞인 변경은 한 커밋으로 뭉개지지 않게 주의합니다.
- 공유 타입 변경은 downstream 앱 영향까지 확인한 뒤 커밋합니다.
