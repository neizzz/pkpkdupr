# Frontend (apps/web) 개발 규칙

## 현재 역할

- 일반 사용자용 웹 앱입니다.
- 현재 엔트리 라우트는 `/`와 `/login` 두 개입니다.
- `/`에서는 `BottomNav`가 내부 state로 `Match`, `Player`, `Me` 화면을 전환합니다.
- 중앙 QR 버튼은 `react-qr-code` 모달을 띄우는 UI입니다.

## 기술 스택

- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite 5
- **Routing**: react-router-dom v6
- **UI**: HeroUI 3, react-icons, react-qr-code
- **Styling**: Tailwind CSS v4 (`@tailwindcss/vite`)
- **Alias**: `@/` → `src/`

## 구조 가이드

- `src/components/`
  - 재사용 UI와 레이아웃 컴포넌트
  - 예: `BottomNav.tsx`
- `src/context/`
  - 인증/세션 상태
  - 현재 `AuthContext.tsx`가 `token`, `player`, `login`, `logout` 담당
- `src/pages/`
  - 화면 단위 컴포넌트
  - 현재 `Login`, `Match`, `Player`, `Me`, `Home`
- 타입은 반드시 `@pkpkdupr/shared/*`에서 import합니다.

## 현재 UX / 상태 관리 규칙

- 앱 폭은 모바일 프레임 기준 `max-w-[430px]`를 유지합니다.
- 인증 토큰은 `localStorage`의 `token` 키를 사용합니다.
- 앱 시작 시 저장된 토큰이 있으면 `/api/me`로 사용자 정보를 다시 가져옵니다.
- `Match`, `Player`, `Me`는 아직 플레이스홀더 성격이 강하므로, 기능 추가 시 탭 상태와 실제 라우트 분리가 필요한지 먼저 판단합니다.

## 라우팅 규칙

- 전역 URL 라우트가 필요한 화면만 `App.tsx`의 `<Routes>`에 추가합니다.
- 탭 내부 화면처럼 URL이 꼭 필요하지 않은 경우에는 `BottomNav` 내부 상태 전환을 유지해도 됩니다.
- 새 URL path는 영문 소문자 + 케밥 케이스를 기본으로 사용합니다.

## API 연동 규칙

- Vite dev server는 `/api`를 `http://localhost:4000`으로 프록시합니다.
- 프런트 코드에서는 절대 호스트를 하드코딩하지 말고 `/api/...`만 사용합니다.
- 사용자 정보는 `/api/me`, 로그인은 `/api/login`을 사용합니다.
- 공유 타입과 실제 API 응답 간 불일치가 생기면 `packages/shared`와 `apps/api`를 먼저 같이 수정합니다.

## 코드 컨벤션

1. **파일명**
   - 컴포넌트: PascalCase
   - 유틸/헬퍼: camelCase
2. **import 순서**
   - React
   - third-party
   - shared package
   - local (`@/...`, `./...`)
3. **스타일**
   - 세미콜론 유지
   - 기존 파일의 4-space 스타일을 우선 존중
4. **컴포넌트**
   - Functional component 사용
   - 복잡한 props는 명시적 interface/type로 분리

## 스타일링 규칙

- CSS 파일 상단에는 `@import "tailwindcss";`를 사용합니다.
- Tailwind v4 기준이라 별도 `tailwind.config.*` 없이 Vite 플러그인으로 동작합니다.
- 모바일 중심 화면이므로 고정 폭/하단 탭/오버레이가 깨지지 않게 확인합니다.
- HeroUI를 사용할 때도 기존 Tailwind 클래스 기반 레이아웃 규칙과 충돌하지 않게 유지합니다.
