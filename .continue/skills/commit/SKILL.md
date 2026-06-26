---
name: commit
description: 커밋하기, 코드 저장, git commit
argument-hint: "[커밋 메시지 / 생략 시 변경사항 분석 후 자동 생성]"
---

# Commit

프로젝트 변경사항을 커밋합니다.

## Conventions

- 커밋 title 맨 앞에 반드시 `feat:` 또는 `fix:` 또는 `refactor:` 또는 `chore:` prefix를 붙입니다 (영문 + 콜론 + 공백)
- 나머지 메시지는 자연어 (한국어/영어 모두 가능)
- Prefix는 **변경사항의 성격**에 따라 결정합니다:

| Prefix | 사용 기준 |
|--------|----------|
| `feat:` | 새로운 기능 추가, API/컴포넌트 신규 도입 |
| `fix:` | 버그 수정, 오류 해결 |
| `refactor:` | 기능은 그대로, 코드 구조 정리 (리팩토링) |
| `chore:` | 설정 파일, 의존성 업데이트, 빌드 설정 |

- 예시:
     - `feat: add user login API`
     - `fix: 로그인 시 JWT 토큰 파싱 오류 해결`
     - `refactor: API 라우트 구조 정리`
     - `chore: pnpm workspace 설정`

## Commit Message Format

커밋 메시지는 **명확하고 구체적으로** 작성합니다:
- Title은 ``<prefix>: <어떤 것>을/를 <무엇이름>했다`` 형식을 따릅니다.
- 변경사항이 여러 개면 body로 상세 내용을 나열합니다 (빈 행 1개 삽입).

좋은 예시:
- `feat: Express 기반 API 서버 설정`
- `chore: pnpm workspace monorepo 생성 — api와 web 패키지 분리, 공유 패키지는 packages/에 별도 관리`
- `fix: cors 설정 누락으로 인한 전후단 통신 차단 해결`

나쁜 예시:
- `feat: something` — 너무 모호함
- `fix: bug fix` — 무엇을 고쳤는지 불명확
- `upd` — prefix가 없음

## Instructions

### 1. 변경사항 확인

```bash
git status --short
git diff --name-only HEAD
```

인자로 커밋 메시지가 주어지면 그대로 사용합니다 (prefix가 없으면 자동으로 붙임).  
주어지지 않으면 **변경 내용 (diff) 을 분석**해서 prefix를 결정합니다. 디프의 성격이 모호하면 사용자에게 질문하고 선택받은 prefix로 진행한다.

### 2. 커밋 전 린트 체크

```bash
pnpm lint
```

실패하면 오류를 수정한 후 재시도합니다. 린트가 실패하면 커밋하지 않고 오류 내용을 알려줍니다.

### 3. stage → commit

```bash
git add -A
git commit -m "feat: message"
```

## 주의사항

- `node_modules/` 등 untracked 파일은 `.gitignore`로 제외하는지 확인합니다.
- prefix는 반드시 `feat:` 또는 `fix:` 또는 `refactor:` 또는 `chore:` 중 하나만 사용합니다.
- 여러 가지 성격의 변경이 섞여 있으면 사용자에게 "어떤 prefix로 커밋할까요?"라고 질문합니다.