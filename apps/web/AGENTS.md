# Frontend (apps/web) 개발 규칙

## 기술 스택
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite 5
- **Routing**: react-router-dom v6
- **Styling**: Tailwind CSS v4 (Vite plugin 방식, 별도 설정 파일 없음)
- **Alias**: `@/` → `src/`

## 디렉토리 구조
- 페이지 컴포넌트: `src/pages/`
- 공통 컴포넌트: `src/components/` (생성 시 이 경로에 배치)
- API 연동 관련: `src/api/`
- 타입 공유는 반드시 `packages/shared/`에서 import (duplicate 금지)

## 코드 컨벤션
1. **파일명**: PascalCase (컴포넌트), camelCase (유틸/Hook 등) — 확장자 `.tsx` 또는 `.ts`
2. **import 순서**: React → third-party → shared 패키지 → local (`@/...`)
3. **공백/정렬**: 4 space indent, 줄 끝 세미콜론 붙임
4. **React 컴포넌트**: Functional component + 명시적 return type (`React.FC` 또는 `ComponentType` 등)

## 라우팅 규칙
- 신규 페이지는 `App.tsx`의 `<Routes>` 안에 등록, path는 영문 소문자 + 케밥-케이스 (예: `/player-profile`)
- 네이그레이션은 `react-router-dom`의 `<Link>` 또는 `useNavigate` 사용

## API 연동
- Dev 서버가 `/api`를 `localhost:4000`로 프록시하므로 FE에서는 `/api/...` 경로 그대로 호출
- 실제 API endpoint는 `apps/api/src/index.ts` 참고

## 스타일링
- Tailwind CSS v4가 도입되어 있습니다 (`@tailwindcss/vite`)
- CSS 파일 맨 위에 `@import "tailwindcss";`로 선언 (v3 이전의 @tailwind directive는 필요 없음)
- 별도 설정 파일(`tailwind.config.js` 등) 불필요 — `vite.config.ts`의 플러그인으로 모든 것 관리

## 규칙

모든 요청에 응답한 후, 답변의 맨 아래에 **소요시간**을 적는다.

- 형식: `⏱️ 소요시간: {분}분 {초}초` 또는 `⏱️ 소요시간: {초}초(<1분인 경우)`