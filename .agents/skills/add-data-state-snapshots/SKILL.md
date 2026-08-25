---
name: add-data-state-snapshots
description: 모든 사용자 화면을 데이터 있음(with-data)과 데이터 없음(empty) 상태로 분류하고 Playwright 등 기존 E2E 도구의 시각 회귀 스냅샷을 추가·갱신한다. 화면, 탭, 데이터 의존 drawer·sheet·상세 화면의 빈 상태 누락을 점검하거나 데이터 상태별 visual regression coverage를 구축할 때 사용한다.
---

# 데이터 상태 스냅샷

데이터 의존 화면마다 의미 있는 **with-data**와 **empty** 기준 이미지를 추가한다. 로딩·오류·권한 거부는 별도 요청이 없으면 범위에 넣지 않는다.

기준 이미지와 검토용 스냅샷 파일은 이 저장소의 `<repo-root>/tmp/snapshots/` 아래에 저장한다.

## 1. 기존 구조와 범위를 발견한다

1. 작업 트리와 기존 테스트·스냅샷 변경을 먼저 확인하고, 관련 없는 dirty 변경은 건드리지 않는다.
2. `semble search`로 라우트, 탭, 메뉴, drawer/sheet/modal, API 호출, 기존 E2E 설정과 fixture를 찾는다. 전체 파일은 관련 chunk가 부족할 때만 읽는다.
3. 라우트만 세지 않는다. keep-alive 탭, 조건부 화면, 데이터로 열리는 상세 화면과 목록의 빈 화면을 포함한다.
4. 화면별 데이터 상태를 [coverage matrix template](references/snapshot-matrix-template.md)에 기록한다. 데이터가 실제로 화면 구조를 바꾸지 않는 surface는 `N/A`와 근거를 남기고 빈 상태를 억지로 만들지 않는다.
5. 로그인·비밀번호 변경처럼 서버 데이터 유무와 무관한 화면은 한 기준 스냅샷만 추가한다. 인증 리다이렉트는 시각 대상 화면이 아니라 경로 동작으로 별도 검증한다.

"모든 화면"의 완료 기준은 matrix의 모든 행이 `captured` 또는 근거가 있는 `N/A`이며, 단순히 top-level route마다 한 장을 찍은 것이 아니다.

## 2. 결정적인 테스트 상태를 만든다

- 기존 test seed, MSW, Playwright `page.route`, test-only API 중 이미 쓰는 방식을 우선한다. 제품 API를 테스트용 분기에 맞추거나 production 데이터를 쓰지 않는다.
- with-data fixture는 카드·행·차트·아바타·권한별 CTA 등 해당 surface의 실제 정보 밀도를 보이게 최소 2개 이상의 구별 가능한 항목을 제공한다.
- empty fixture는 데이터 배열/페이지 결과를 진짜 빈 값으로 반환한다. 오류 응답, 숨겨진 로딩, CSS로 항목을 감추는 방식으로 대체하지 않는다.
- 날짜, 상대 시간, 난수, 원격 이미지, 애니메이션, viewport를 고정한다. 필요한 경우 fake clock, 로컬/인라인 이미지, `prefers-reduced-motion`, locator mask를 사용한다.
- empty 상태가 상위 화면의 일부일 때에는 그 상태가 보이도록 실제 사용자 흐름으로 이동한 뒤 캡처한다. 내부 state를 직접 조작하지 않는다.

## 3. 스냅샷을 작성한다

- 기존 Playwright 설정과 naming convention을 따른다. 새 설정이 없을 때만 현재 프로젝트의 test runner 선택과 CI 제약을 확인한 뒤 최소 설정을 추가한다.
- 기준 이미지 경로는 저장소 루트를 기준으로 `tmp/snapshots/`에 고정한다. Playwright config가 저장소 루트에 있으면 `snapshotPathTemplate: "tmp/snapshots/{testFilePath}/{arg}{ext}"`를 사용하고, 다른 위치면 같은 절대 경로를 가리키게 설정한다.
- 파일명은 surface와 상태를 함께 포함해 `members--with-data.png`, `members--empty.png`처럼 구별한다. viewport가 둘 이상이면 project명도 자연스럽게 구별되게 한다.
- 데스크톱과 모바일이 모두 제품 지원 범위이면 각 viewport project에서 같은 matrix를 실행한다. 모바일 고정 하단 UI는 safe area와 실제 scroll owner가 보이는 viewport를 사용한다.
- overlay가 독립적으로 데이터에 따라 바뀌면 열려 있는 상태를 별도 snapshot으로 캡처한다. 단, 단순 trigger나 동일 내용의 중복 overlay는 추가하지 않는다.

```ts
await page.emulateMedia({ reducedMotion: "reduce" });
await page.goto("/");
await expect(page.getByRole("heading", { name: "플레이어" })).toBeVisible();
await expect(page).toHaveScreenshot("members--with-data.png", {
  animations: "disabled",
  caret: "hide",
  fullPage: true,
});
```

텍스트, role, `data-testid`처럼 안정적인 locator를 사용한다. 레이아웃을 가리거나 타이밍을 바꾸는 임의 timeout, 광범위한 CSS mask, 모든 snapshot 일괄 갱신을 사용하지 않는다.

## 4. 기준 이미지를 검토하고 검증한다

1. 신규 기준 이미지는 해당 spec만 대상으로 생성하거나 갱신한다. `--update-snapshots`를 전체 workspace에 무차별 적용하지 않는다.
2. with-data와 empty 이미지를 나란히 열어 데이터 의존 영역이 실제로 달라지고 header, nav, safe area, empty copy가 잘리지 않는지 검토한다.
3. 변경한 spec을 재실행한 뒤 가능한 경우 해당 visual test suite와 영향받은 build/lint를 실행한다. 환경 때문에 실행하지 못한 검증은 명시한다.
4. 결과에 matrix, 추가된 spec·baseline 경로, 실행 명령·결과, `N/A` 근거를 짧게 보고한다.

## 금지 사항

- 빈 상태를 생산 데이터 삭제, 공유 개발 DB 변경, 화면 구현 변경으로 만들지 않는다.
- API 실패 화면을 empty 상태로 기록하지 않는다.
- 시간·네트워크·광고·외부 이미지처럼 비결정적인 픽셀 차이를 기준 이미지에 포함하지 않는다.
- 기존 기준 이미지의 의미 없는 대량 변경을 새 coverage에 섞지 않는다.
- `tmp/snapshots/` 밖에 새 기준 이미지나 검토용 스크린샷을 저장하지 않는다.
