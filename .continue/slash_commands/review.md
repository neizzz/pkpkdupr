---
name: review
description: Review code changes for this project
argument-hint: "[수정할文件或 브랜칭명 / 생략 시 최신 커밋]"
---

# Code Review

현재 변경사항(또는 지정된 파일)을 리뷰합니다. 아래 체크리스트를 기준으로 구체적이고 실행 가능한 피드백을 제공합니다:

## 체크리스트

1. **Type Safety** (`apps/`, `packages/shared/`)
      - 타입 인터페이스가 `packages/shared`에서 정의되어 있는지 확인
      - `any` 타입 사용 여부 (금지)
      - strict 모드와 충돌하는 코드 있는가
2. **API Endpoint** (`apps/api/src/`)
      - Express 라우트 구조가 명확한가 (router 분리가 필요한지)
      - CORS / middleware 순서가 올바른가
      - error handling이 적절한가 (`try/catch`, 500 응답 등)
3. **Frontend** (`apps/web/src/`)
      - React 컴포넌트 prop 타입 명시적 정의
      - useEffect 의존성 배열 누락 여부
      - API 호출 시 CORS/proxy 설정과 경로 매칭 확인 (vite.config.ts의 `/api` 프록시)
4. **Shared Types** (`packages/shared/src/`)
      - 인터페이스 변경 시 api/web 양측에서 breaking 없는가
      - `Date` 타입 직렬화 처리가 적절한지 (JSON에서는 string 필요)
5. **Commit Message Convention**
      - 커밋 메시지가 `feat:`, `fix:`, `refactor:`, `chore:` prefix를 붙였는가
      - 메시지 구체성: "무엇을 했는지"를 알 수 있는 수준인가

## Output Format

```markdown
## ✅ Good
- [적은 부분]

## ⚠️ Improvements
1. [[파일명](vscode://file/{절대FilePath}?line={라인번호}) — {행번호} — 문제점 설명 → 수정 제안 (code snippet 포함)

## 🔴 Blocker
- [블록되는 사항이 있으면 나열]
```

### VS Code 링크 사용법

피드백 시 파일:라인을 **클릭 가능한 VS Code 링크**로 만듭니다:

```markdown
[[apps/web/src/App.tsx:6](vscode://file/{절대path}/apps/web/src/App.tsx?line=6)]
[[packages/shared/src/match.ts:22](vscode://file/{절대path}/packages/shared/src/match.ts?line=22)]
```

`{절대path}`는 현재 작업 디렉토리(`pwd`)를 사용합니다. 예:
- macOS/homebrew: `~/.nvm/versions/node/.../bin/pwd` 또는 직접 `$(pwd)`로 탐지 가능
