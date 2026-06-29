---
name: review
description: Review code changes for this project
argument-hint: "[검토할 파일 경로 / 커밋 / 브랜치명, 생략 시 현재 변경사항]"
---

# Code Review

현재 변경사항(또는 지정된 범위)을 리뷰합니다.

이 저장소는 `apps/web`, `apps/admin-web`, `apps/api`, `apps/db-server`, `packages/shared`로 분리된 모노레포이므로, **한 파일의 수정이라도 다른 앱 계약에 미치는 영향**을 함께 확인합니다.

## 체크리스트

1. **Type Safety / Shared Contract**
   - 공용 도메인 타입이 `packages/shared`에 정의되어 있는가
   - `any`/과도한 type assertion이 불필요하게 늘지 않았는가
   - `Player`, `Match`, 로그 타입 변경이 web/api/admin/db-server 전반에 반영되었는가
   - `Date` 필드가 JSON 왕복 시 문자열/`Date` 변환을 안전하게 처리하는가

2. **API Layer** (`apps/api/src/`)
   - JWT 검증, 관리자 권한 검사, 에러 응답이 일관적인가
   - `apps/db-server`와의 내부 HTTP 계약이 깨지지 않는가
   - 중복된 인증 파싱/권한 로직을 더 안전하게 정리할 여지가 있는가

3. **DB Server / Persistence** (`apps/db-server/src/`)
   - 저장 스키마와 shared 타입이 어긋나지 않는가
   - 스키마 초기화/보정 로직이 기존 데이터에 안전한가
   - 상태 변경 로그, 생성 로그 등 감사성 데이터가 누락되지 않는가

4. **Frontend / Admin UI**
   - `apps/web`: 탭 기반 UI, 로그인 상태, `/api` 프록시 사용이 올바른가
   - `apps/admin-web`: 관리자 로그인, 회원 생성, 상태 변경, 로그 조회 흐름이 맞는가
   - `useEffect` 의존성, 비동기 로딩, 권한 없는 접근 처리에 허점이 없는가

5. **Monorepo / Build / Config**
   - 패키지 스크립트와 실제 사용 경로가 일치하는가
   - `apps/web`는 React 19, `apps/admin-web`는 React 18이라는 차이를 깨지 않는가
   - 환경변수(`DB_SERVER_URL`, `JWT_SECRET`) 가정이 안전한가

6. **Tests / Validation / Maintainability**
   - 변경 범위에 비해 최소한의 검증 포인트가 빠지지 않았는가
   - 플레이스홀더 UI인지 실제 도메인 로직인지에 따라 리뷰 강도가 적절한가
   - 지금은 동작해도 다음 단계 확장 시 문제될 구조적 부채가 있는가

## Output Format

```markdown
## ✅ Good
- [잘된 점]

## ⚠️ Improvements
1. [[파일경로:라인](vscode://file/{절대경로}?line={라인번호})] 문제 설명
   - 영향
   - 제안

## 🔴 Blocker
- [머지 전 반드시 수정해야 하는 사항]
```

## 리뷰 원칙

- 실행 가능한 피드백만 남깁니다.
- 경미한 스타일 이슈보다 **계약 불일치 / 권한 / 데이터 무결성 / 회귀 위험**을 우선합니다.
- 문제를 지적할 때는 가능하면 **왜 문제인지**와 **어떻게 고칠지**를 함께 씁니다.
- 이슈가 없으면 억지로 항목을 만들지 않습니다.

## VS Code 링크 예시

```markdown
[[apps/web/src/App.tsx:6](vscode://file/{절대path}/apps/web/src/App.tsx?line=6)]
[[apps/admin-web/src/pages/AdminDashboard.tsx:120](vscode://file/{절대path}/apps/admin-web/src/pages/AdminDashboard.tsx?line=120)]
[[apps/api/src/services/AuthService.ts:210](vscode://file/{절대path}/apps/api/src/services/AuthService.ts?line=210)]
[[apps/db-server/src/index.ts:45](vscode://file/{절대path}/apps/db-server/src/index.ts?line=45)]
[[packages/shared/src/match.ts:22](vscode://file/{절대path}/packages/shared/src/match.ts?line=22)]
```
